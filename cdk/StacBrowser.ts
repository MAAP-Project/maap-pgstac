// create a BrowserStack class extending the Stack class

import { Stack, aws_s3 as s3, aws_s3_deployment as s3_deployment, aws_cloudfront as cloudfront, aws_cloudfront_origins as cloudfront_origins} from "aws-cdk-lib";


import { Construct } from "constructs";


export class StacBrowser extends Stack {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        const bucket = new s3.Bucket(this, 'Bucket', {
        accessControl: s3.BucketAccessControl.PRIVATE,
        })

        new s3_deployment.BucketDeployment(this, 'BucketDeployment', {
            destinationBucket: bucket,
            sources: [s3_deployment.Source.asset('/Users/emiletenezakis/devseed/stac-browser/dist')]
          })

        const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity');
        bucket.grantRead(originAccessIdentity);

        new cloudfront.Distribution(this, 'Distribution', {
        defaultRootObject: 'index.html',
        defaultBehavior: {
            origin: new cloudfront_origins.S3Origin(bucket, {originAccessIdentity}),
        },
        });

    }
}
