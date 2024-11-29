# Setup Environment Variables for chat-with-youtube
$ErrorActionPreference = "Stop"

# Function to ensure secrets directory exists
function Ensure-SecretsDirectory {
    $secretsDir = Join-Path (Join-Path $PSScriptRoot "..") "secrets"
    if (-not (Test-Path $secretsDir)) {
        New-Item -ItemType Directory -Path $secretsDir | Out-Null
    }
    return $secretsDir
}

# Function to save API key to file
function Save-ApiKey {
    param (
        [string]$key,
        [string]$filename
    )
    $secretsDir = Ensure-SecretsDirectory
    $filePath = Join-Path $secretsDir $filename
    $key | Out-File -FilePath $filePath -NoNewline -Encoding UTF8
    Write-Host "Saved API key to $filename"
}

# Read from .env file
$envPath = Join-Path (Join-Path $PSScriptRoot "..") ".env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath
    foreach ($line in $envContent) {
        if ($line -match '^OPENAI_API_KEY=(.*)$') {
            Save-ApiKey -key $matches[1] -filename "openai_api_key.txt"
        }
        elseif ($line -match '^PINECONE_API_KEY=(.*)$') {
            Save-ApiKey -key $matches[1] -filename "pinecone_api_key.txt"
        }
        elseif ($line -match '^PINECONE_INDEX=(.*)$') {
            Save-ApiKey -key $matches[1] -filename "pinecone_index.txt"
        }
    }
    Write-Host "Setup completed successfully!"
} else {
    Write-Host "Error: .env file not found!"
    exit 1
}
