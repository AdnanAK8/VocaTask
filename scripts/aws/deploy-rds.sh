#!/usr/bin/env bash
set -euo pipefail

REGION="${1:-${AWS_REGION:-ap-southeast-2}}"
STACK_NAME="${STACK_NAME:-vocatask-database-stack}"
CLIENT_CIDR="${2:-}"

if [[ -z "$CLIENT_CIDR" ]]; then
    read -r -p "Allowed client IPv4 CIDR (preferably your public IP/32): " CLIENT_CIDR
fi

if [[ ! "$CLIENT_CIDR" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$ ]]; then
    echo "Provide a valid IPv4 CIDR, preferably your public IP followed by /32." >&2
    exit 1
fi

read -r -s -p "Database master password: " PASSWORD
echo
if [[ -z "$PASSWORD" ]]; then
    echo "A database master password is required." >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/rds-postgres-template.yaml"

echo "Deploying CloudFormation stack: $STACK_NAME in region: $REGION..."
aws cloudformation deploy \
    --template-file "$TEMPLATE_FILE" \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --parameter-overrides "DBMasterPassword=$PASSWORD" "AllowedClientCidr=$CLIENT_CIDR"
unset PASSWORD

ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='DBEndpoint'].OutputValue" \
    --output text)

echo "Database successfully provisioned."
echo "Endpoint: $ENDPOINT"
echo "Database: vocatask"
echo "Allowed client CIDR: $CLIENT_CIDR"
echo "Configure DATABASE_URL in your local secret file without sharing it."
