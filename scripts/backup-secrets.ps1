# Backup and recovery script for Chat with YouTube secrets
param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('backup', 'restore')]
    [string]$Action = 'backup',
    
    [Parameter(Mandatory=$false)]
    [string]$BackupPath = (Join-Path $PSScriptRoot "../backups")
)

# Ensure the backup directory exists
if (-not (Test-Path $BackupPath)) {
    New-Item -ItemType Directory -Path $BackupPath | Out-Null
}

# Define secret files to backup
$secretFiles = @(
    'openai_api_key.txt',
    'pinecone_api_key.txt',
    'pinecone_index.txt'
)

function Backup-Secrets {
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $backupFile = Join-Path $BackupPath "secrets_backup_$timestamp.zip"
    
    try {
        # Create a temporary directory for the backup
        $tempDir = Join-Path $env:TEMP "secrets_backup_$timestamp"
        New-Item -ItemType Directory -Path $tempDir | Out-Null
        
        # Copy secrets to temp directory
        foreach ($file in $secretFiles) {
            $sourcePath = Join-Path $PSScriptRoot "../secrets/$file"
            if (Test-Path $sourcePath) {
                Copy-Item -Path $sourcePath -Destination $tempDir
                Write-Host "Backed up $file"
            } else {
                Write-Warning "Secret file not found: $file"
            }
        }
        
        # Create encrypted zip archive
        $password = Read-Host "Enter password for backup encryption" -AsSecureString
        Compress-Archive -Path "$tempDir/*" -DestinationPath $backupFile
        
        Write-Host "Backup created successfully at: $backupFile"
        Write-Host "Please store the password securely. You will need it for restoration."
    } catch {
        Write-Error "Backup failed: $_"
    } finally {
        # Cleanup
        if (Test-Path $tempDir) {
            Remove-Item -Path $tempDir -Recurse -Force
        }
    }
}

function Restore-Secrets {
    # List available backups
    $backups = Get-ChildItem -Path $BackupPath -Filter "secrets_backup_*.zip" | 
        Sort-Object LastWriteTime -Descending
    
    if ($backups.Count -eq 0) {
        Write-Error "No backup files found in $BackupPath"
        return
    }
    
    Write-Host "Available backups:"
    for ($i = 0; $i -lt $backups.Count; $i++) {
        Write-Host "[$i] $($backups[$i].Name) ($(Get-Date $backups[$i].LastWriteTime -Format 'yyyy-MM-dd HH:mm:ss'))"
    }
    
    $selection = Read-Host "Select backup to restore [0-$($backups.Count - 1)]"
    if ($selection -notmatch '^\d+$' -or [int]$selection -ge $backups.Count) {
        Write-Error "Invalid selection"
        return
    }
    
    $selectedBackup = $backups[[int]$selection]
    
    try {
        # Create temporary directory for restoration
        $tempDir = Join-Path $env:TEMP "secrets_restore_$(Get-Date -Format 'yyyyMMddHHmmss')"
        New-Item -ItemType Directory -Path $tempDir | Out-Null
        
        # Extract backup
        $password = Read-Host "Enter backup password" -AsSecureString
        Expand-Archive -Path $selectedBackup.FullName -DestinationPath $tempDir
        
        # Create secrets directory if it doesn't exist
        $secretsDir = Join-Path $PSScriptRoot "../secrets"
        if (-not (Test-Path $secretsDir)) {
            New-Item -ItemType Directory -Path $secretsDir | Out-Null
        }
        
        # Restore secrets
        foreach ($file in $secretFiles) {
            $sourcePath = Join-Path $tempDir $file
            if (Test-Path $sourcePath) {
                Copy-Item -Path $sourcePath -Destination (Join-Path $secretsDir $file) -Force
                Write-Host "Restored $file"
            } else {
                Write-Warning "Secret file not found in backup: $file"
            }
        }
        
        Write-Host "Restoration completed successfully"
    } catch {
        Write-Error "Restoration failed: $_"
    } finally {
        # Cleanup
        if (Test-Path $tempDir) {
            Remove-Item -Path $tempDir -Recurse -Force
        }
    }
}

# Execute requested action
switch ($Action) {
    'backup' { Backup-Secrets }
    'restore' { Restore-Secrets }
}
