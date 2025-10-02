# Stop All Microservices Script

Write-Host "=== Stopping All Microservices ===" -ForegroundColor Red

# Stop all Node.js processes
Write-Host "Stopping all Node.js processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

# Stop all background jobs
Write-Host "Stopping all PowerShell jobs..." -ForegroundColor Yellow
Get-Job -ErrorAction SilentlyContinue | Stop-Job
Get-Job -ErrorAction SilentlyContinue | Remove-Job

# Stop Docker containers (optional - uncomment if you want to stop Kafka too)
# Write-Host "Stopping Kafka containers..." -ForegroundColor Yellow
# Set-Location "D:\projects\dev_projects\kafka_microservice_llamadev\ecommerce\services\kafka"
# docker-compose down

Write-Host "All microservices stopped!" -ForegroundColor Green