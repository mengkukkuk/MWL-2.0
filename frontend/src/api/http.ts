// Single choke point for every request to the Flask API.
//
// Two backend behaviours shape this file:
//  * Auth is a same-origin session cookie (HttpOnly, SameSite=Lax). There is no
//    token to attach and no CORS layer, so `credentials: 'same-origin'` is both
//    necessary and sufficient.
//  * Non-GET /api/* requests are checked against Origin/Referer by
//    verify_api_csrf_origin. The browser sets those itself; we must not try to.

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

/** Statuses where retrying cannot possibly succeed. */
export function isTerminalStatus(status: number): boolean {
  return [400, 401, 403, 404, 409, 410, 413, 422, 507].includes(status);
}

let onUnauthorized: (() => void) | null = null;

/** Registered once by the auth provider so http.ts needn't import the router. */
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

function friendlyMessage(status: number, serverMessage: string | null): string {
  if (serverMessage) return serverMessage;
  switch (status) {
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to do that.';
    case 404:
      return 'Not found.';
    case 413:
      // Flask's own handler returns JSON, but when the request dies at the
      // Cloudflare edge the body is an HTML error page instead, so this path
      // is reachable with no parseable server message.
      return 'That file is too large to upload.';
    case 429:
      return 'Too many attempts. Please wait before trying again.';
    case 507:
      return 'The server is out of storage space.';
    default:
      return status >= 500 ? 'The server ran into a problem.' : `Request failed (${status}).`;
  }
}

async function readError(res: Response): Promise<ApiError> {
  let payload: unknown;
  let serverMessage: string | null = null;
  try {
    const text = await res.text();
    if (text) {
      try {
        payload = JSON.parse(text);
        const obj = payload as Record<string, unknown>;
        const candidate = obj?.error ?? obj?.message;
        if (typeof candidate === 'string') serverMessage = candidate;
      } catch {
        // Non-JSON body: an edge/proxy HTML error page. Keep it as the payload
        // for debugging but never surface raw HTML to the user.
        payload = text;
      }
    }
  } catch {
    // Body already consumed or connection dropped; fall through to the generic
    // message rather than masking the original status with a parse error.
  }
  return new ApiError(res.status, friendlyMessage(res.status, serverMessage), payload);
}

type Body = Record<string, unknown> | unknown[] | FormData | undefined;

async function request<T>(method: string, path: string, body?: Body): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin', headers: {} };

  if (body instanceof FormData) {
    // Do not set Content-Type: the browser must add the multipart boundary.
    init.body = body;
  } else if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  const res = await fetch(path, init);

  if (res.status === 401) {
    onUnauthorized?.();
    throw await readError(res);
  }
  if (!res.ok) throw await readError(res);
  if (res.status === 204) return undefined as T;

  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) return (await res.text()) as T;
  return (await res.json()) as T;
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: Body) => request<T>('POST', path, body),
  put: <T>(path: string, body?: Body) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: Body) => request<T>('PATCH', path, body),
  del: <T>(path: string, body?: Body) => request<T>('DELETE', path, body),
};

/** Build a query string, dropping undefined/null so callers can pass sparse objects. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : '';
}

/**
 * Upload with progress. fetch() cannot report upload progress, so this is the
 * one place XMLHttpRequest is still the right tool.
 */
export function uploadWithProgress<T>(
  path: string,
  form: FormData,
  onProgress?: (percent: number) => void,
): { promise: Promise<T>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<T>((resolve, reject) => {
    xhr.open('POST', path);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300;
      let payload: unknown = xhr.responseText;
      let serverMessage: string | null = null;
      try {
        payload = JSON.parse(xhr.responseText);
        const candidate = (payload as Record<string, unknown>)?.error;
        if (typeof candidate === 'string') serverMessage = candidate;
      } catch {
        // Non-JSON response — typical for a 413 rejected at the edge.
      }
      if (ok) resolve(payload as T);
      else {
        if (xhr.status === 401) onUnauthorized?.();
        reject(new ApiError(xhr.status, friendlyMessage(xhr.status, serverMessage), payload));
      }
    };

    xhr.onerror = () =>
      reject(new ApiError(0, 'Network error while uploading. Check your connection.'));
    xhr.onabort = () => reject(new ApiError(0, 'Upload cancelled.'));

    xhr.send(form);
  });

  return { promise, abort: () => xhr.abort() };
}
