import { Stack, aws_s3 as s3, aws_s3_deployment as s3_deployment, aws_cloudfront as cloudfront, aws_cloudfront_origins as cloudfront_origins, StackProps} from "aws-cdk-lib";
import { RemovalPolicy } from "aws-cdk-lib";
import { PolicyStatement, ServicePrincipal, Effect } from "aws-cdk-lib/aws-iam";

import { Construct } from "constructs";


export class StacBrowser extends Stack {
    constructor(scope: Construct, id: string, props: Props) {
        super(scope, id);

        const bucket = new s3.Bucket(this, 'Bucket', {
            accessControl: s3.BucketAccessControl.PRIVATE,
            removalPolicy: RemovalPolicy.DESTROY,
            })

        bucket.addToResourcePolicy(new PolicyStatement({
                    sid: 'AllowCloudFrontServicePrincipal',
                    effect: Effect.ALLOW, 
                    actions: ['s3:GetObject'],
                    principals: [new ServicePrincipal('cloudfront.amazonaws.com')],
                    resources: [bucket.arnForObjects('*')],
                    conditions: {
                        'StringEquals': {
                            'aws:SourceArn': props.cloudFrontDistributionArn
                        }
                    }
                }));
        

        new s3_deployment.BucketDeployment(this, 'BucketDeployment', {
            destinationBucket: bucket,
            sources: [s3_deployment.Source.asset(props.stacBrowserDistPath)]
          });

    }
}

export interface Props extends StackProps {

    // ARN of the cloudfront distribution to which we should grant read access to the browser bucket. 
    cloudFrontDistributionArn: string;

    // location of the stac-browser dist directory in the local filesystem
    stacBrowserDistPath: string;


}
