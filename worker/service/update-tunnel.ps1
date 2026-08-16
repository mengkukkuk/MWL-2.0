# Runs as the MWL-Tunnel Windows service (via NSSM). Starts a Cloudflare Quick
# Tunnel pointed at the local Flask backend, discovers the random hostname
# Cloudflare assigns it (via cloudflared's local --metrics /quicktunnel JSON
# endpoint — no log-scraping), and pushes that hostname as the BACKEND_ORIGIN
# secret on the mwl-timesheet-production Worker via the Cloudflare REST API
# directly (no wrangler/npm dependency at runtime, no interactive login).
#
# This script's lifetime == cloudflared's lifetime: it waits on the child
# process and exits when it does. NSSM is configured to restart this script
# on exit (AppExit Default Restart), so a reboot, a crashed tunnel, or a
# dropped connection all result in: new quick tunnel -> new hostname -> fresh
# BACKEND_ORIGIN push, with no manual steps.

param(
    [int]$BackendPort = 5112,
    [int]$MetricsPort = 20250,
    [string]$AccountId = '50ec9d8adf2939e545a88b9f0ed2c1ac',
    [string]$ScriptName = 'mwl-timesheet-production',
    [string]$SecretName = 'BACKEND_ORIGIN'
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $here)
$logDir = Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$logFile = Join-Path $logDir 'tunnel-service.log'
$cloudflaredLog = Join-Path $logDir 'cloudflared.log'
$configPath = Join-Path $here '..\quicktunnel-config.yml'

function Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK') $msg"
    Add-Content -Path $logFile -Value $line
    Write-Output $line
}

# Read the API token from the machine-level environment variable directly
# (not the inherited process environment) so this works regardless of which
# session/order set it relative to when the service started.
$apiToken = [Environment]::GetEnvironmentVariable('CLOUDFLARE_API_TOKEN', 'Machine')
if (-not $apiToken) {
    Log "FATAL: CLOUDFLARE_API_TOKEN is not set as a machine environment variable. Run: setx CLOUDFLARE_API_TOKEN `"<token>`" /M (see worker/service/README.md)"
    exit 1
}

$cloudflaredExe = (Get-Command cloudflared.exe -ErrorAction SilentlyContinue).Source
if (-not $cloudflaredExe) { $cloudflaredExe = 'C:\Program Files (x86)\cloudflared\cloudflared.exe' }
if (-not (Test-Path $cloudflaredExe)) {
    Log "FATAL: cloudflared.exe not found (checked PATH and default install location)."
    exit 1
}

Log "Starting cloudflared: url=http://127.0.0.1:$BackendPort metrics=127.0.0.1:$MetricsPort"

$proc = Start-Process -FilePath $cloudflaredExe -ArgumentList @(
    'tunnel',
    '--config', $configPath,
    '--url', "http://127.0.0.1:$BackendPort",
    '--metrics', "127.0.0.1:$MetricsPort",
    '--no-autoupdate'
) -RedirectStandardOutput $cloudflaredLog -RedirectStandardError "$cloudflaredLog.err" -PassThru -NoNewWindow

Log "cloudflared started, pid=$($proc.Id). Waiting for quick tunnel hostname..."

# Poll the local metrics endpoint for the assigned *.trycloudflare.com hostname.
$hostname = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if ($proc.HasExited) {
        Log "FATAL: cloudflared exited early (code $($proc.ExitCode)) before a tunnel hostname was assigned. Check $cloudflaredLog.err"
        exit 1
    }
    try {
        $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$MetricsPort/quicktunnel" -TimeoutSec 2 -ErrorAction Stop
        if ($resp.hostname) { $hostname = $resp.hostname; break }
    } catch {
        # Metrics server may not be up yet on the first few iterations — expected, keep polling.
    }
}

if (-not $hostname) {
    Log "FATAL: no quick tunnel hostname after 30s. Killing cloudflared and exiting for NSSM to retry."
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

$backendOrigin = "https://$hostname"
Log "Quick tunnel ready: $backendOrigin"

# Push BACKEND_ORIGIN to the Worker via the Cloudflare API directly (PUT is
# idempotent — creates or overwrites the secret). Retries a few times since
# this runs at boot, when outbound networking may not be up yet.
$uri = "https://api.cloudflare.com/client/v4/accounts/$AccountId/workers/scripts/$ScriptName/secrets"
$body = @{ name = $SecretName; text = $backendOrigin; type = 'secret_text' } | ConvertTo-Json
$headers = @{ Authorization = "Bearer $apiToken"; 'Content-Type' = 'application/json' }

$pushed = $false
for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
        $result = Invoke-RestMethod -Uri $uri -Method Put -Headers $headers -Body $body -TimeoutSec 15
        if ($result.success) {
            Log "BACKEND_ORIGIN secret updated successfully (attempt $attempt)."
            $pushed = $true
            break
        } else {
            Log "Cloudflare API returned success=false (attempt $attempt): $($result.errors | ConvertTo-Json -Compress)"
        }
    } catch {
        Log "Failed to push BACKEND_ORIGIN (attempt $attempt): $($_.Exception.Message)"
    }
    Start-Sleep -Seconds (5 * $attempt)
}

if (-not $pushed) {
    Log "WARNING: giving up pushing BACKEND_ORIGIN after 5 attempts. The tunnel is running at $backendOrigin but the public Worker URL will not reach it until this is fixed (check the API token and network)."
}

# The wrapper's lifetime tracks cloudflared's. If cloudflared dies (crash,
# dropped connection, etc.), this script exits too and NSSM restarts it,
# generating a fresh tunnel + secret push.
Wait-Process -Id $proc.Id
$code = $proc.ExitCode
Log "cloudflared exited (code $code)."
exit $code
