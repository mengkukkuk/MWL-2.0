# MWL-Backend / MWL-Tunnel Windows Services

Installs two auto-starting Windows services (via NSSM) so the backend and its
public Cloudflare Quick Tunnel survive reboots with **zero manual steps** —
including re-pointing the Worker at the new tunnel URL, which changes on
every restart.

- **MWL-Backend** — `waitress-serve` running the Flask app (`app:app`) on `127.0.0.1:<APP_PORT>`
- **MWL-Tunnel** — `update-tunnel.ps1`: starts a Cloudflare Quick Tunnel, discovers its
  random `*.trycloudflare.com` hostname via cloudflared's local `--metrics` JSON endpoint,
  and pushes it as the `BACKEND_ORIGIN` secret on the `mwl-timesheet-production` Worker via
  the Cloudflare REST API — automatically, on every start.

## 1. Create a scoped Cloudflare API Token

The tunnel service needs a token to push the `BACKEND_ORIGIN` secret non-interactively
(it can't use your `wrangler login` browser session). Create one scoped as narrowly as
possible:

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. **Create Token** → **Create Custom Token**
3. Permissions: **Account** → **Workers Scripts** → **Edit**
4. Account Resources: **Include** → the account containing `mwl-timesheet-production`
   (account ID `50ec9d8adf2939e545a88b9f0ed2c1ac`)
5. Zone Resources: **None needed** — leave default/none
6. Create the token and copy it (shown once)

## 2. Set it as a machine environment variable

In an **elevated** (Administrator) terminal:

```
setx CLOUDFLARE_API_TOKEN "paste-your-token-here" /M
```

The `/M` flag makes this machine-wide, which is required since the services run
outside your user session. Close and reopen any terminal after this for it to take
effect there — the Windows services themselves will pick it up on their own start
since `update-tunnel.ps1` reads it directly from the Machine environment scope.

## 3. Install the services

From an **elevated** Command Prompt:

```
cd G:\Code\MWL-2.0\worker\service
install-service.bat
```

This is idempotent — safe to re-run any time (e.g. after editing `.env`), it removes
and reinstalls both services.

## 4. Verify

```
nssm status MWL-Backend
nssm status MWL-Tunnel
```

Check logs:
- `logs\backend.log` — Flask/waitress output
- `logs\tunnel-service.log` — update-tunnel.ps1's own log (look for "BACKEND_ORIGIN secret updated successfully")
- `logs\cloudflared.log` (+ `.err`) — raw cloudflared output

Confirm the public site: https://mwl-timesheet-production.engoffsite.workers.dev/login should return 200.

## Forcing a fresh tunnel/hostname manually

```
nssm restart MWL-Tunnel
```

This kills the current cloudflared process, and NSSM's `AppExit Default Restart`
plus this script's own logic will spin up a brand new Quick Tunnel, discover its
new hostname, and push it as `BACKEND_ORIGIN` again — same as what happens
automatically on every reboot.

## Uninstalling

```
nssm stop MWL-Tunnel
nssm remove MWL-Tunnel confirm
nssm stop MWL-Backend
nssm remove MWL-Backend confirm
```
