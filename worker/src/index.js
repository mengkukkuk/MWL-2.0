/**
 * Reverse proxy Worker for mwl-timesheet-production.
 *
 * The React SPA is still built and served by the Flask app itself (see
 * frontend/vite.config.ts and app/core.py) — this Worker does not host any
 * assets. It only gives the app a stable public URL
 * (mwl-timesheet-production.engoffsite.workers.dev) in front of a Cloudflare
 * Quick Tunnel whose hostname changes every time it restarts on the Windows
 * host, and forwards X-Forwarded-Host/Proto so Flask's CSRF-origin check
 * (verify_api_csrf_origin in app/__init__.py) trusts this Worker's origin.
 */
export default {
  async fetch(request, env) {
    const backendOrigin = env.BACKEND_ORIGIN;
    if (!backendOrigin) {
      return new Response(
        'BACKEND_ORIGIN is not configured. Set it with: npx wrangler secret put BACKEND_ORIGIN',
        { status: 502 },
      );
    }

    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, backendOrigin);

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.set('X-Forwarded-Host', url.host);
    headers.set('X-Forwarded-Proto', 'https');
    const clientIp = request.headers.get('cf-connecting-ip');
    if (clientIp) headers.set('X-Forwarded-For', clientIp);

    const hasBody = !['GET', 'HEAD'].includes(request.method);

    const response = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: 'manual',
    });

    return response;
  },
};
