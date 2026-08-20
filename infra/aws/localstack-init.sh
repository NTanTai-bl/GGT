#!/bin/sh
# Runs automatically inside the LocalStack container on startup.
# Creates the SQS queue and S3 bucket the platform expects, so
# local dev never needs a real AWS account.
set -e

awslocal sqs create-queue --queue-name pentest-requests
awslocal s3 mb s3://pentest-artifacts
