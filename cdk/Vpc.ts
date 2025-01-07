import { Stack, StackProps, aws_ec2 as ec2 } from "aws-cdk-lib";
import { Construct } from "constructs";

export class Vpc extends Stack {
  vpc: ec2.Vpc;
  constructor(scope: Construct, id: string, props?: Props) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "vpc", {
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "ingress",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "application",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: "rds",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      natGateways: props?.natGatewayCount,
    });

    this.vpc.addGatewayEndpoint("DynamoDbEndpoint", {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    this.vpc.addInterfaceEndpoint("SecretsManagerEndpoint", {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });

    this.vpc.addGatewayEndpoint("S3Endpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    this.exportValue(this.vpc.selectSubnets({subnetType: ec2.SubnetType.PUBLIC}).subnets[0].subnetId)
    this.exportValue(this.vpc.selectSubnets({subnetType: ec2.SubnetType.PUBLIC}).subnets[1].subnetId)

  }
}

export interface Props extends StackProps {
  /**
   * Count of natGateways
   *
   * @default - One per availability zone
   */
  natGatewayCount?: ec2.VpcProps["natGateways"];
}

