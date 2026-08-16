@echo off
setlocal EnableDelayedExpansion

:: Installs MWL Timesheet as two auto-starting Windows services:
::   MWL-Backend  - waitress-serve running the Flask app (app:app)
::   MWL-Tunnel   - update-tunnel.ps1: a Cloudflare Quick Tunnel wrapper that
::                  discovers its own random *.trycloudflare.com hostname on
::                  every start and pushes it as the BACKEND_ORIGIN secret on
::                  the mwl-timesheet-production Worker, automatically.
::
:: Must be run from an elevated (Administrator) Command Prompt — service
:: installation requires admin rights.
::
:: Requires CLOUDFLARE_API_TOKEN to be set as a MACHINE environment variable
:: first (see worker\service\README.md) — without it, MWL-Tunnel will start,
:: run the tunnel, but fail to push BACKEND_ORIGIN and retry indefinitely.

net session >nul 2>&1
if not %errorlevel%==0 (
    echo ERROR: this script must be run as Administrator.
    echo Right-click install-service.bat and choose "Run as administrator".
    exit /b 1
)

set "SERVICE_DIR=%~dp0"
for %%I in ("%SERVICE_DIR%..\..") do set "PROJECT_DIR=%%~fI"
set "ENV_FILE=%PROJECT_DIR%\.env"

if not exist "%ENV_FILE%" (
    echo ERROR: %ENV_FILE% not found.
    exit /b 1
)

if "%CLOUDFLARE_API_TOKEN%"=="" (
    echo WARNING: CLOUDFLARE_API_TOKEN is not set as a machine environment variable.
    echo MWL-Tunnel will run but will NOT be able to update the Worker's BACKEND_ORIGIN
    echo secret until you set it. See worker\service\README.md.
    echo.
)

:: ── Read config from .env (same findstr /b prefix-match convention used by
::    the project's other scripts) ─────────────────────────────────────────
set "APP_PORT="
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b "APP_PORT=" "%ENV_FILE%"`) do set "APP_PORT=%%B"
if "%APP_PORT%"=="" set "APP_PORT=5112"

set "WAITRESS_CHANNEL_TIMEOUT="
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b "WAITRESS_CHANNEL_TIMEOUT=" "%ENV_FILE%"`) do set "WAITRESS_CHANNEL_TIMEOUT=%%B"
if "%WAITRESS_CHANNEL_TIMEOUT%"=="" set "WAITRESS_CHANNEL_TIMEOUT=3600"

set "WAITRESS_MAX_REQUEST_BODY="
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b "WAITRESS_MAX_REQUEST_BODY=" "%ENV_FILE%"`) do set "WAITRESS_MAX_REQUEST_BODY=%%B"
if "%WAITRESS_MAX_REQUEST_BODY%"=="" set "WAITRESS_MAX_REQUEST_BODY=5368709120"

echo Project directory : %PROJECT_DIR%
echo Backend port       : %APP_PORT%
echo.

:: ── Refuse to install if something is already listening on the backend
::    port (e.g. you still have it running manually / from an IDE) ─────────
netstat -ano | findstr /r /c:":%APP_PORT% .*LISTENING" >nul
if %errorlevel%==0 (
    echo ERROR: something is already listening on port %APP_PORT%.
    echo Stop the manually-running backend first, then re-run this script.
    exit /b 1
)

set "NSSM=%SystemRoot%\System32\nssm.exe"
set "WAITRESS_EXE=%PROJECT_DIR%\.venv\Scripts\waitress-serve.exe"
set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

if not exist "%WAITRESS_EXE%" (
    echo ERROR: %WAITRESS_EXE% not found. Is the venv set up? ^(pip install -r requirements.txt^)
    exit /b 1
)

if not exist "%PROJECT_DIR%\logs" mkdir "%PROJECT_DIR%\logs"

:: ── Remove any previous install of these two services so re-running this
::    script is safe/idempotent ──────────────────────────────────────────
"%NSSM%" stop MWL-Tunnel >nul 2>&1
"%NSSM%" remove MWL-Tunnel confirm >nul 2>&1
"%NSSM%" stop MWL-Backend >nul 2>&1
"%NSSM%" remove MWL-Backend confirm >nul 2>&1

:: ── MWL-Backend ────────────────────────────────────────────────────────
echo Installing MWL-Backend...
"%NSSM%" install MWL-Backend "%WAITRESS_EXE%"
:: --trusted-proxy / --trusted-proxy-headers: Waitress strips incoming
:: X-Forwarded-* headers by default (anti-spoofing) unless the peer IP is
:: explicitly marked as a trusted proxy. The Cloudflare Quick Tunnel
:: (cloudflared) always connects from 127.0.0.1, and the reverse-proxy
:: Worker relies on X-Forwarded-Host/Proto reaching Flask's CSRF-origin
:: check (verify_api_csrf_origin in app/__init__.py) — without this, every
:: non-GET /api/* request through the public URL fails CSRF with a 403.
"%NSSM%" set MWL-Backend AppParameters "--host=127.0.0.1 --port=%APP_PORT% --trusted-proxy=127.0.0.1 --trusted-proxy-headers=\"x-forwarded-host x-forwarded-proto x-forwarded-for\" --channel-timeout=%WAITRESS_CHANNEL_TIMEOUT% --max-request-body-size=%WAITRESS_MAX_REQUEST_BODY% --threads=8 app:app"
"%NSSM%" set MWL-Backend AppDirectory "%PROJECT_DIR%"
"%NSSM%" set MWL-Backend DisplayName "MWL Timesheet Backend"
"%NSSM%" set MWL-Backend Description "Waitress-served Flask backend for MWL Timesheet (%PROJECT_DIR%)"
"%NSSM%" set MWL-Backend Start SERVICE_AUTO_START
"%NSSM%" set MWL-Backend AppStdout "%PROJECT_DIR%\logs\backend.log"
"%NSSM%" set MWL-Backend AppStderr "%PROJECT_DIR%\logs\backend.log"
"%NSSM%" set MWL-Backend AppRotateFiles 1
"%NSSM%" set MWL-Backend AppRotateBytes 10485760
"%NSSM%" set MWL-Backend AppExit Default Restart
"%NSSM%" set MWL-Backend AppRestartDelay 5000

:: ── MWL-Tunnel (depends on MWL-Backend being started first) ─────────────
echo Installing MWL-Tunnel...
"%NSSM%" install MWL-Tunnel "%PS_EXE%"
"%NSSM%" set MWL-Tunnel AppParameters "-NoProfile -ExecutionPolicy Bypass -File \"%SERVICE_DIR%update-tunnel.ps1\" -BackendPort %APP_PORT%"
"%NSSM%" set MWL-Tunnel AppDirectory "%SERVICE_DIR%."
"%NSSM%" set MWL-Tunnel DisplayName "MWL Timesheet Cloudflare Tunnel"
"%NSSM%" set MWL-Tunnel Description "Quick Tunnel for MWL Timesheet + auto-updates the Worker's BACKEND_ORIGIN secret on every start"
"%NSSM%" set MWL-Tunnel DependOnService MWL-Backend
"%NSSM%" set MWL-Tunnel Start SERVICE_AUTO_START
"%NSSM%" set MWL-Tunnel AppStdout "%PROJECT_DIR%\logs\tunnel-service.log"
"%NSSM%" set MWL-Tunnel AppStderr "%PROJECT_DIR%\logs\tunnel-service.log"
"%NSSM%" set MWL-Tunnel AppExit Default Restart
"%NSSM%" set MWL-Tunnel AppRestartDelay 5000

echo.
echo Starting services...
"%NSSM%" start MWL-Backend
timeout /t 3 /nobreak >nul
"%NSSM%" start MWL-Tunnel

echo.
echo Done. Both services are set to auto-start on boot.
echo   Backend log : %PROJECT_DIR%\logs\backend.log
echo   Tunnel log  : %PROJECT_DIR%\logs\tunnel-service.log (and cloudflared.log alongside it)
echo   Public URL  : https://mwl-timesheet-production.engoffsite.workers.dev
echo.
echo Check status with: nssm status MWL-Backend  ^&  nssm status MWL-Tunnel

endlocal
