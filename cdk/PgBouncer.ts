import {
  aws_ec2 as ec2,
  aws_iam as iam,
  aws_secretsmanager as secretsmanager,
  Stack,
} from "aws-cdk-lib";
import { Construct } from "constructs";

import * as fs from "fs";
import * as path from "path";

// used to populate pgbouncer config:
// see https://www.pgbouncer.org/config.html for details
export interface PgBouncerConfigProps {
  poolMode?: "transaction" | "session" | "statement";
  maxClientConn?: number;
  defaultPoolSize?: number;
  minPoolSize?: number;
  reservePoolSize?: number;
  reservePoolTimeout?: number;
  maxDbConnections?: number;
  maxUserConnections?: number;
}

export interface PgBouncerProps {
  /**
   * Name for the pgbouncer instance
   */
  instanceName: string;

  /**
   * VPC to deploy PgBouncer into
   */
  vpc: ec2.IVpc;

  /**
   * The RDS instance to connect to
   */
  database: {
    instanceType: ec2.InstanceType;
    connections: ec2.Connections;
    secret: secretsmanager.ISecret;
  };

  /**
   * Whether to deploy in public subnet
   * @default false
   */
  usePublicSubnet?: boolean;

  /**
   * Instance type for PgBouncer
   * @default t3.micro
   */
  instanceType?: ec2.InstanceType;

  /**
   * PgBouncer configuration options
   */
  pgBouncerConfig?: PgBouncerConfigProps;
}

export class PgBouncer extends Construct {
  public readonly instance: ec2.Instance;
  public readonly endpoint: string;

  // The max_connections parameter in PgBouncer determines the maximum number of
  // connections to open on the actual database instance. We want that number to
  // be slightly smaller than the actual max_connections value on the RDS instance
  // so we perform this calculation.

  // TODO: move this to eoapi-cdk where we already have a complete map of instance
  // type and memory
  private readonly instanceMemoryMapMb: Record<string, number> = {
    "t3.micro": 1024,
    "t3.small": 2048,
    "t3.medium": 4096,
  };

  private calculateMaxConnections(dbInstanceType: ec2.InstanceType): number {
    const memoryMb = this.instanceMemoryMapMb[dbInstanceType.toString()];
    if (!memoryMb) {
      throw new Error(
        `Unsupported instance type: ${dbInstanceType.toString()}`,
      );
    }

    // RDS calculates the available memory as the total instance memory minus some
    // constant for OS overhead
    const memoryInBytes = (memoryMb - 300) * 1024 ** 2;

    // The default max_connections setting follows this formula:
    return Math.min(Math.round(memoryInBytes / 9531392), 5000);
  }

  private getDefaultConfig(
    dbInstanceType: ec2.InstanceType,
  ): Required<PgBouncerConfigProps> {
    // calculate approximate max_connections setting for this RDS instance type
    const maxConnections = this.calculateMaxConnections(dbInstanceType);

    // maxDbConnections (and maxUserConnections) are the only settings that need
    // to be responsive to the database size/max_connections setting
    return {
      poolMode: "transaction",
      maxClientConn: 1000,
      defaultPoolSize: 5,
      minPoolSize: 0,
      reservePoolSize: 5,
      reservePoolTimeout: 5,
      maxDbConnections: maxConnections - 10,
      maxUserConnections: maxConnections - 10,
    };
  }

  constructor(scope: Construct, id: string, props: PgBouncerProps) {
    super(scope, id);

    // Set defaults for optional props
    const defaultInstanceType = ec2.InstanceType.of(
      ec2.InstanceClass.T3,
      ec2.InstanceSize.MICRO,
    );

    const instanceType = props.instanceType ?? defaultInstanceType;
    const defaultConfig = this.getDefaultConfig(props.database.instanceType);

    // Merge provided config with defaults
    const pgBouncerConfig: Required<PgBouncerConfigProps> = {
      ...defaultConfig,
      ...props.pgBouncerConfig,
    };

    // Create role for PgBouncer instance to enable writing to CloudWatch
    const role = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore",
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "CloudWatchAgentServerPolicy",
        ),
      ],
    });

    // Add policy to allow reading RDS credentials from Secrets Manager
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [props.database.secret.secretArn],
      }),
    );

    // Create PgBouncer instance
    this.instance = new ec2.Instance(this, "Instance", {
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: props.usePublicSubnet
          ? ec2.SubnetType.PUBLIC
          : ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      instanceType,
      instanceName: props.instanceName,
      machineImage: ec2.MachineImage.fromSsmParameter(
        "/aws/service/canonical/ubuntu/server/jammy/stable/current/amd64/hvm/ebs-gp2/ami-id",
        { os: ec2.OperatingSystemType.LINUX },
      ),
      role,
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(20, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
            deleteOnTermination: true,
          }),
        },
      ],
      userData: this.loadUserDataScript(pgBouncerConfig, props.database),
      userDataCausesReplacement: true,
    });

    // Allow PgBouncer to connect to RDS
    props.database.connections.allowFrom(
      this.instance,
      ec2.Port.tcp(5432),
      "Allow PgBouncer to connect to RDS",
    );

    // Set the endpoint
    this.endpoint = this.instance.instancePrivateIp;
  }

  private loadUserDataScript(
    pgBouncerConfig: Required<NonNullable<PgBouncerProps["pgBouncerConfig"]>>,
    database: { secret: secretsmanager.ISecret },
  ): ec2.UserData {
    const userDataScript = ec2.UserData.forLinux();

    // Set environment variables with configuration parameters
    userDataScript.addCommands(
      'export SECRET_ARN="' + database.secret.secretArn + '"',
      'export REGION="' + Stack.of(this).region + '"',
      'export POOL_MODE="' + pgBouncerConfig.poolMode + '"',
      'export MAX_CLIENT_CONN="' + pgBouncerConfig.maxClientConn + '"',
      'export DEFAULT_POOL_SIZE="' + pgBouncerConfig.defaultPoolSize + '"',
      'export MIN_POOL_SIZE="' + pgBouncerConfig.minPoolSize + '"',
      'export RESERVE_POOL_SIZE="' + pgBouncerConfig.reservePoolSize + '"',
      'export RESERVE_POOL_TIMEOUT="' +
        pgBouncerConfig.reservePoolTimeout +
        '"',
      'export MAX_DB_CONNECTIONS="' + pgBouncerConfig.maxDbConnections + '"',
      'export MAX_USER_CONNECTIONS="' +
        pgBouncerConfig.maxUserConnections +
        '"',
    );

    // Load the startup script
    const scriptPath = path.join(__dirname, "./scripts/pgbouncer-setup.sh");
    let script = fs.readFileSync(scriptPath, "utf8");

    userDataScript.addCommands(script);

    return userDataScript;
  }
}
