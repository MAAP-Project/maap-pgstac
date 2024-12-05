import {
  aws_ec2 as ec2,
  aws_iam as iam,
  aws_secretsmanager as secretsmanager,
  Stack,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { GenericLinuxImage } from "aws-cdk-lib/aws-ec2";

export interface PgBouncerProps {
  /**
   * VPC to deploy PgBouncer into
   */
  vpc: ec2.IVpc;

  /**
   * The RDS instance to connect to
   */
  database: {
    connections: ec2.Connections;
    secret: secretsmanager.ISecret;
  };

  /**
   * Security groups that need access to PgBouncer
   */
  clientSecurityGroups: ec2.ISecurityGroup[];

  /**
   * Whether to deploy in public subnet
   * @default false
   */
  usePublicSubnet?: boolean;

  /**
   * Instance type for PgBouncer
   * @default t3.small
   */
  instanceType?: ec2.InstanceType;

  /**
   * PgBouncer configuration options
   */
  pgBouncerConfig?: {
    poolMode?: "transaction" | "session" | "statement";
    maxClientConn?: number;
    defaultPoolSize?: number;
    minPoolSize?: number;
    reservePoolSize?: number;
    reservePoolTimeout?: number;
    maxDbConnections?: number;
    maxUserConnections?: number;
  };
}

export class PgBouncer extends Construct {
  public readonly securityGroup: ec2.ISecurityGroup;
  public readonly instance: ec2.Instance;
  public readonly endpoint: string;

  constructor(scope: Construct, id: string, props: PgBouncerProps) {
    super(scope, id);

    const {
      vpc,
      database,
      clientSecurityGroups,
      usePublicSubnet = false,
      instanceType = ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.NANO,
      ),
      pgBouncerConfig = {
        poolMode: "transaction",
        maxClientConn: 1000,
        defaultPoolSize: 20,
        minPoolSize: 10,
        reservePoolSize: 5,
        reservePoolTimeout: 5,
        maxDbConnections: 50,
        maxUserConnections: 50,
      },
    } = props;

    // Create security group for PgBouncer
    this.securityGroup = new ec2.SecurityGroup(this, "SecurityGroup", {
      vpc,
      description: "Security group for PgBouncer instance",
      allowAllOutbound: true,
    });

    // Allow incoming PostgreSQL traffic from client security groups
    clientSecurityGroups.forEach((clientSg, index) => {
      this.securityGroup.addIngressRule(
        clientSg,
        ec2.Port.tcp(5432),
        `Allow PostgreSQL access from client security group ${index + 1}`,
      );
    });

    // Allow PgBouncer to connect to RDS
    database.connections.allowFrom(
      this.securityGroup,
      ec2.Port.tcp(5432),
      "Allow PgBouncer to connect to RDS",
    );

    // Create role for PgBouncer instance
    const role = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore",
        ),
      ],
    });

    // Add policy to allow reading RDS credentials from Secrets Manager
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [database.secret.secretArn],
      }),
    );

    // Create PgBouncer instance
    this.instance = new ec2.Instance(this, "Instance", {
      vpc,
      vpcSubnets: {
        subnetType: usePublicSubnet
          ? ec2.SubnetType.PUBLIC
          : ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      instanceType,
      instanceName: `pgbouncer-${Date.now()}`,
      machineImage: ec2.MachineImage.fromSsmParameter(
        "/aws/service/canonical/ubuntu/server/jammy/stable/current/amd64/hvm/ebs-gp2/ami-id",
        { os: ec2.OperatingSystemType.LINUX },
      ),
      securityGroup: this.securityGroup,
      role,
    });

    // Create user data script
    const userDataScript = ec2.UserData.forLinux();
    userDataScript.addCommands(
      "set -euxo pipefail", // Add error handling and debugging

      // Install required packages
      "apt-get update",
      "DEBIAN_FRONTEND=noninteractive apt-get install -y pgbouncer jq awscli",

      // Create update script
      "#!/bin/bash",
      "set -euxo pipefail",

      `SECRET_ARN=${database.secret.secretArn}`,
      `REGION=${Stack.of(this).region}`,

      "echo 'Fetching secret from ARN: ' ${SECRET_ARN}",
      "SECRET=$(aws secretsmanager get-secret-value --secret-id $SECRET_ARN --region $REGION --query SecretString --output text)",

      "# Parse database credentials",
      "DB_HOST=$(echo $SECRET | jq -r '.host')",
      "DB_PORT=$(echo $SECRET | jq -r '.port')",
      "DB_NAME=$(echo $SECRET | jq -r '.dbname')",
      "DB_USER=$(echo $SECRET | jq -r '.username')",
      "DB_PASSWORD=$(echo $SECRET | jq -r '.password')",

      "echo 'Creating PgBouncer configuration...'",

      "# Create pgbouncer.ini",
      "cat <<EOC > /etc/pgbouncer/pgbouncer.ini",
      "[databases]",
      "* = host=$DB_HOST port=$DB_PORT dbname=$DB_NAME",
      "",
      "[pgbouncer]",
      "listen_addr = 0.0.0.0",
      "listen_port = 5432",
      "auth_type = md5",
      "auth_file = /etc/pgbouncer/userlist.txt",
      `pool_mode = ${pgBouncerConfig.poolMode}`,
      `max_client_conn = ${pgBouncerConfig.maxClientConn}`,
      `default_pool_size = ${pgBouncerConfig.defaultPoolSize}`,
      `min_pool_size = ${pgBouncerConfig.minPoolSize}`,
      `reserve_pool_size = ${pgBouncerConfig.reservePoolSize}`,
      `reserve_pool_timeout = ${pgBouncerConfig.reservePoolTimeout}`,
      `max_db_connections = ${pgBouncerConfig.maxDbConnections}`,
      `max_user_connections = ${pgBouncerConfig.maxUserConnections}`,
      "ignore_startup_parameters = application_name,search_path",
      "EOC",

      "# Create userlist.txt",
      'echo "\\"$DB_USER\\" \\"$DB_PASSWORD\\"" > /etc/pgbouncer/userlist.txt',

      "# Set correct permissions",
      "chown pgbouncer:pgbouncer /etc/pgbouncer/pgbouncer.ini /etc/pgbouncer/userlist.txt",
      "chmod 600 /etc/pgbouncer/pgbouncer.ini /etc/pgbouncer/userlist.txt",

      "# Restart pgbouncer",
      "systemctl restart pgbouncer",

      // Enable and start pgbouncer service
      "systemctl enable pgbouncer",
      "systemctl start pgbouncer",
    );

    this.instance.addUserData(userDataScript.render());

    // Set the endpoint
    this.endpoint = this.instance.instancePrivateIp;
  }
}
