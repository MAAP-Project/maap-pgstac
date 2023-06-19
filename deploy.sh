#!/bin/bash

# load config from .env, assumed to be in the same directory as this script and a valid bash file
set -a # automatically export all variables
source .env
set +a

# grab the JWKS_URL from auth deployment
export JWKS_URL=$(aws cloudformation describe-stacks --stack-name 'MAAP-STAC-auth-dev' --query 'Stacks[0].Outputs[?OutputKey==`jwksurl`].OutputValue' --output text)
export DATA_ACCESS_ROLE_ARN=$(aws cloudformation describe-stacks --stack-name 'MAAP-STAC-roles-dev' --query 'Stacks[0].Outputs[?ExportName==`data-access-role-arn`].OutputValue' --output text)
# print out the environment variables created here with a nice header
echo "Environment variables set:"
echo "=========================="
echo "JWKS_URL: $JWKS_URL"
echo "DATA_ACCESS_ROLE_ARN: $DATA_ACCESS_ROLE_ARN"
echo "=========================="

# prompt user to continue. If yes, continue. If no, exit.
read -p "Continue? press any key " -n 1 -r
# inform that we are deploying
echo ""
echo "Deploying..."

cdk synth --all
cdk deploy --all --require-approval never