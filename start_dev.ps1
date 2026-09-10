# INCOIS 3D Ocean Data Visualization Platform Startup Script for Windows PowerShell
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  INCOIS 3D OCEAN DATA VISUALIZATION SYSTEM (PS 26067)  " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$ROOT_DIR = $PSScriptRoot

# 1. Check Python virtual environment in data-service
$PYTHON_EXE = Join-Path $ROOT_DIR "data-service\.venv\Scripts\python.exe"
if (-not (Test-Path $PYTHON_EXE)) {
    $PYTHON_EXE = "python"
}

Write-Host "`n[1/3] Launching Python Scientific Data Service (Port 8000)..." -ForegroundColor Yellow
$backend = Start-Process -FilePath $PYTHON_EXE -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8000" -WorkingDirectory (Join-Path $ROOT_DIR "data-service") -PassThru

Start-Sleep -Seconds 2

Write-Host "[2/3] Launching Node.js API Gateway (Port 4000)..." -ForegroundColor Yellow
$gateway = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory (Join-Path $ROOT_DIR "gateway") -PassThru

Start-Sleep -Seconds 2

Write-Host "[3/3] Launching WebGL 3D Globe Frontend (Port 3000)..." -ForegroundColor Yellow
$frontend = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory (Join-Path $ROOT_DIR "frontend") -PassThru

Write-Host "`n--------------------------------------------------------" -ForegroundColor Green
Write-Host "  Platform is running successfully!" -ForegroundColor Green
Write-Host "  * Primary Web UI (3D Globe): http://localhost:3000" -ForegroundColor White
Write-Host "  * API Gateway:              http://localhost:4000" -ForegroundColor White
Write-Host "  * Data Service (Swagger):   http://localhost:8000/docs" -ForegroundColor White
Write-Host "  * Health Check:             http://localhost:4000/health" -ForegroundColor White
Write-Host "--------------------------------------------------------" -ForegroundColor Green
Write-Host "Press Ctrl+C or close the terminal windows to terminate services.`n"
