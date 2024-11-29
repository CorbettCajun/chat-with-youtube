# PowerShell script to manage Docker secrets

# Function to create a secret file
function Set-DockerSecret {
    param(
        [Parameter(Mandatory=$true)]
        [string]$SecretName,
        
        [Parameter(Mandatory=$true)]
        [string]$SecretValue
    )
    
    $secretPath = "../secrets/$SecretName.txt"
    
    # Create secrets directory if it doesn't exist
    if (-not (Test-Path "../secrets")) {
        New-Item -ItemType Directory -Path "../secrets"
    }
    
    # Write secret to file
    $SecretValue | Out-File -FilePath $secretPath -NoNewline -Encoding UTF8
    Write-Host "Secret $SecretName has been created/updated"
}

# Function to remove a secret file
function Remove-DockerSecret {
    param(
        [Parameter(Mandatory=$true)]
        [string]$SecretName
    )
    
    $secretPath = "../secrets/$SecretName.txt"
    if (Test-Path $secretPath) {
        Remove-Item $secretPath
        Write-Host "Secret $SecretName has been removed"
    } else {
        Write-Host "Secret $SecretName does not exist"
    }
}

# Function to list all secrets
function Get-DockerSecrets {
    if (Test-Path "../secrets") {
        Get-ChildItem "../secrets" -Filter "*.txt" | ForEach-Object {
            Write-Host $_.BaseName
        }
    } else {
        Write-Host "No secrets directory found"
    }
}

# Main menu
function Show-Menu {
    Write-Host "`nDocker Secrets Management"
    Write-Host "1. Create/Update Secret"
    Write-Host "2. Remove Secret"
    Write-Host "3. List Secrets"
    Write-Host "4. Exit"
}

# Main loop
while ($true) {
    Show-Menu
    $choice = Read-Host "`nEnter your choice (1-4)"
    
    switch ($choice) {
        "1" {
            $name = Read-Host "Enter secret name"
            $value = Read-Host "Enter secret value" -AsSecureString
            $plainValue = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($value))
            Set-DockerSecret -SecretName $name -SecretValue $plainValue
        }
        "2" {
            $name = Read-Host "Enter secret name to remove"
            Remove-DockerSecret -SecretName $name
        }
        "3" {
            Write-Host "`nCurrent Secrets:"
            Get-DockerSecrets
        }
        "4" {
            Write-Host "Exiting..."
            exit
        }
        default {
            Write-Host "Invalid choice. Please try again."
        }
    }
}
