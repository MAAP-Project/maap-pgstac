# MAAP eoapi

This repository contains the AWS CDK code (written in typescript) used to deploy the MAAP project eoapi infrastructure. It is based on the [eoapi-template example](https://github.com/developmentseed/eoapi-template). For the MAAP use case, we use part of these constructs, to define :

- a database (a pgstac database, more precisely)
- an API to add things to the STAC database
- an API to query the STAC database
- a bastion host for secure connections to the database

This wrapper repository creates a VPC to add these components in and a 'bastion host' for secure direct connections to the database (see the [asdi repository](https://github.com/developmentseed/aws-asdi-pgstac))

## Deployment

Deployment happens through a github workflow manually triggered and defined in `.github/workflows/deploy.yaml`.