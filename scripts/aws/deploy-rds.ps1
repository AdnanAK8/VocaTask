<#
.SYNOPSIS
    Deploys a centralized Amazon RDS PostgreSQL database for VocaTask.
.DESCRIPTION
    Uses AWS CloudFormation to create an RDS instance with ingress restricted
    to the supplied IPv4 CIDR. The database password is requested securely.
.PARAMETER Region
    The AWS region to deploy to (default: ap-southeast-2).
.PARAMETER ClientCidr
    Trusted IPv4 CIDR allowed to connect to PostgreSQL, preferably your IP/32.
.PARAMETER StackName
    The CloudFormation stack name (default: vocatask-database-stack).
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$Region = "ap-southeast-2",

    [Parameter(Mandatory = $true)]
    [string]$ClientCidr,

    [Parameter(Mandatory = $false)]
    [string]$StackName = "vocatask-database-stack"
)

if ($ClientCidr -notmatch '^(?:\d{1,3}\.){3}\d{1,3}/(?:[0-9]|[12]\d|3[0-2])$') {
    throw "ClientCidr must be an IPv4 CIDR, preferably your public IP followed by /32."
}

$templatePath = Join-Path $PSScriptRoot "rds-postgres-template.yaml"
if (-not (Test-Path $templatePath)) {
    throw "Template not found at: $templatePath"
}

try {
    aws sts get-caller-identity | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "AWS CLI credentials are unavailable. Run aws login or aws configure."
    }

    $securePassword = Read-Host "Enter a secure database master password" -AsSecureString
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $masterPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)

    try {
        aws cloudformation deploy `
            --template-file $templatePath `
            --stack-name $StackName `
            --region $Region `
            --parameter-overrides "DBMasterPassword=$masterPassword" "AllowedClientCidr=$ClientCidr"

        if ($LASTEXITCODE -ne 0) {
            throw "Deployment failed. Check CloudFormation events in AWS Console."
        }

        $endpoint = aws cloudformation describe-stacks `
            --stack-name $StackName `
            --region $Region `
            --query "Stacks[0].Outputs[?OutputKey=='DBEndpoint'].OutputValue" `
            --output text

        if ($LASTEXITCODE -ne 0) {
            throw "Could not retrieve the RDS endpoint."
        }

        Write-Host "Database successfully provisioned."
        Write-Host "Endpoint: $endpoint"
        Write-Host "Database: vocatask"
        Write-Host "Allowed client CIDR: $ClientCidr"
        Write-Host "Configure DATABASE_URL in your local secret file without sharing it."
    } finally {
        $masterPassword = $null
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
} catch {
    Write-Error $_
    exit 1
}
