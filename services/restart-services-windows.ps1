# Simple Restart Script - Opens each service in separate terminal windows
# This allows you to monitor each service individually

Write-Host "=== Restarting All Microservices ===" -ForegroundColor Yellow

# Stop all Node.js processes
Write-Host "Stopping all Node.js processes..." -ForegroundColor Cyan
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Clear console
Clear-Host

$baseDir = "D:\projects\dev_projects\kafka_microservice_llamadev\ecommerce\services"

# Start Kafka
Write-Host "Starting Kafka..." -ForegroundColor Cyan
Set-Location "$baseDir\kafka"
docker-compose up -d
Start-Sleep -Seconds 5

# Start Payment Service in new terminal
Write-Host "Starting Payment Service..." -ForegroundColor Green
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$baseDir\payment-service'; Write-Host 'Payment Service Starting...' -ForegroundColor Green; node index.js"

# Start Analytic Service in new terminal
Write-Host "Starting Analytic Service..." -ForegroundColor Green
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$baseDir\analytic-service'; Write-Host 'Analytic Service Starting...' -ForegroundColor Green; node --watch index.js"

# Start Order Service in new terminal
Write-Host "Starting Order Service..." -ForegroundColor Green
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$baseDir\order-service'; Write-Host 'Order Service Starting...' -ForegroundColor Green; node index.js"

# Start Email Service in new terminal
Write-Host "Starting Email Service..." -ForegroundColor Green
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$baseDir\email-service'; Write-Host 'Email Service Starting...' -ForegroundColor Green; node index.js"

# Start React Client in new terminal
Write-Host "Starting React Client..." -ForegroundColor Green
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$baseDir\client'; Write-Host 'React Client Starting...' -ForegroundColor Green; npm run dev"

Write-Host "`n=== All Services Started in Separate Windows ===" -ForegroundColor Yellow
Write-Host "Each service is running in its own terminal window for easy monitoring." -ForegroundColor White
Write-Host "Close individual terminal windows to stop specific services." -ForegroundColor White