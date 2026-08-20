#!/bin/sh
# Runs automatically inside the LocalStack container on startup.
# Creates the SQS queue, S3 bucket, and a sample Secrets Manager secret so
# local dev never needs a real AWS account for anything except Bedrock
# (which LocalStack Community cannot emulate — see docs/known-limitations.md).
set -e

awslocal sqs create-queue --queue-name pentest-jobs
awslocal s3 mb s3://ggt-pentest-artifacts

# A sample AUTHENTICATED-scan credential, so local AUTHENTICATED/WHITE_BOX
# testing has something real to point credentialSecretArn at.
awslocal secretsmanager create-secret \
  --name ggt/sample-test-account \
  --secret-string '{"username":"pentest-bot","password":"replace-me"}'
