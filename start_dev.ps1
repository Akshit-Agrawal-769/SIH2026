# ========================================================
# INCOIS 3D Ocean Data Visualization System (PS 26067)
# Native Windows PowerShell Full-Stack Development Startup Script
# ========================================================

$ErrorActionPreference = "Continue"
$RootDir = $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  INCOIS 3D OCEAN DATA VISUALIZATION SYSTEM (PS 26067)  " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Clean up existing processes holding ports 8000 and 3000
Write-Host "[0/2] Inspecting and clearing conflicting ports (8000, 3000)..." -ForegroundColor DarkGray
@(8000, 3000) | ForEach-Object {
    $port = $_
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $pids) {
            if ($procId -gt 0 -and $procId -ne $PID) {
                try {
                    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                    Write-Host "  Terminated process $procId occupying port $port" -ForegroundColor Yellow
                } catch {}
            }
        }
    }
}
Start-Sleep -Milliseconds 500

# 2. Check for virtual environment
$PythonCmd = "python"
if (Test-Path "$RootDir\venv\Scripts\python.exe") {
    $PythonCmd = "$RootDir\venv\Scripts\python.exe"
} elseif (Test-Path "$RootDir\.venv\Scripts\python.exe") {
    $PythonCmd = "$RootDir\.venv\Scripts\python.exe"
}

# 3. Start Backend
Write-Host "[1/2] Starting Scientific FastAPI Backend on http://localhost:8000..." -ForegroundColor Green
$backendProc = Start-Process -FilePath $PythonCmd -ArgumentList "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--host", "127.0.0.1", "--port", "8000", "--reload" -WorkingDirectory $RootDir -PassThru

Start-Sleep -Seconds 2

# 4. Start Frontend
Write-Host "[2/2] Starting WebGL Vite Frontend on http://localhost:3000..." -ForegroundColor Green
$frontendProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev" -WorkingDirectory "$RootDir\frontend" -PassThru

Write-Host ""
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "  ✓ INCOIS 3D Ocean Platform is running!" -ForegroundColor Green
Write-Host "  • Primary Web UI:  http://localhost:3000" -ForegroundColor White
Write-Host "  • Backend API:     http://localhost:8000/api/v1/health" -ForegroundColor White
Write-Host "  • API Docs:        http://localhost:8000/docs" -ForegroundColor White
Write-Host "  • Metrics:         http://localhost:8000/metrics" -ForegroundColor White
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "Press Ctrl+C in this console to terminate both services." -ForegroundColor Yellow
Write-Host ""

try {
    while ($true) {
        Start-Sleep -Seconds 1
        if ($backendProc.HasExited -or $frontendProc.HasExited) {
            break
        }
    }
} finally {
    Write-Host "`nStopping INCOIS services gracefully..." -ForegroundColor Yellow
    if ($backendProc -and -not $backendProc.HasExited) {
        Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    }
    if ($frontendProc -and -not $frontendProc.HasExited) {
        Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "All services stopped." -ForegroundColor DarkGray
}
