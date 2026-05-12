# Safe Emulator Startup Script
# Prevents data loss by backing up emulator-data before starting

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
$emulatorData = Join-Path $projectRoot "emulator-data"
$backupDir = Join-Path $projectRoot "emulator-data.backup"

# Step 1: Back up current data (if exists)
if (Test-Path $emulatorData) {
    Write-Host "Backing up emulator-data..." -ForegroundColor Yellow
    if (Test-Path $backupDir) {
        Remove-Item $backupDir -Recurse -Force
    }
    Copy-Item -Path $emulatorData -Destination $backupDir -Recurse
    Write-Host "Backup saved to emulator-data.backup" -ForegroundColor Green
} else {
    Write-Host "No emulator-data found. Starting fresh." -ForegroundColor Yellow
}

# Step 2: Start emulator
Write-Host "Starting Firebase emulators..." -ForegroundColor Cyan
firebase emulators:start --import=$emulatorData --export-on-exit=$emulatorData

# Step 3: If emulator exited with error, restore from backup
if ($LASTEXITCODE -ne 0) {
    Write-Host "Emulator exited with error. Restoring from backup..." -ForegroundColor Red
    if (Test-Path $backupDir) {
        Remove-Item $emulatorData -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item -Path $backupDir -Destination $emulatorData -Recurse
        Write-Host "Data restored from backup." -ForegroundColor Green
    }
}
