# MAAP STAC Infrastructure

This repository contains the AWS CDK code (written in typescript) used to deploy the MAAP project STAC infrastructure. This is mostly a thin wrapper that makes use of the [cdk-pgstac](https://github.com/developmentseed/cdk-pgstac) constructs : 

- a database
- an API to add or delete things from the database
- an API to query the database
- a browser front-end to the latter API

This wrapper repository only adds a VPC to add these components in and a 'bastion host' for secure direct connections to the database (see the [asdi repository](https://github.com/developmentseed/aws-asdi-pgstac))

## Deployment

### Requirements

1. `node.js` is installed
2. `docker` is installed and running
3. node dependencies are installed : run `npm install` from the root of this repo. :warning: See below if installing from a local version of `cdk-pgstac`.
4. If deploying on SMCE : make sure you are properly authenticated. Refer to [these instructions](https://github.com/NASA-IMPACT/active-maap-sprint/issues/482#issuecomment-1491475121).
5. An AWS CloudFront distribution exists so that you provide its ARN which will be added to the static browser bucket policies. This distribution could in theory be created as part of this stack and the parameter removed, however, for legacy reasons we need to allow for a distribution created in another AWS account. You will need to update the distribution after the deployment here to add an origin with the newly created bucket name.

### Steps

1. add your information to `userdata.yaml` (see [asdi repository](https://github.com/developmentseed/aws-asdi-pgstac))
2. add your IP address to the IP whitelist in `cdk/app.ts` (see [asdi repository](https://github.com/developmentseed/aws-asdi-pgstac)). The bastion host white list determines who can directly connect to the database.
3. populate the `.env` file. 
4. from the root of this repository, run `./deploy.sh`. Make sure to use `./` and not `source`. 

## Deploy with a local version of `cdk-pgstac`

If a local filesystem version of cdk-pgstac is listed in the `package.json` dependencies, make sure to follow [these instructions](https://github.com/developmentseed/cdk-pgstac/pull/34#issuecomment-1500558124) to have the right setup.
