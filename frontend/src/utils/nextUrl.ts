/**
 * Validate a `?next=` value before redirecting to it.
 *
 * The login page reflects this parameter straight into a navigation, so an
 * attacker-supplied absolute URL would turn the login form into an open
 * redirect. Only same-origin *relative* paths are allowed through.
 *
 * Rejected: `https://evil.test/x`, `//evil.test/x`, `/\evil.test`, anything not
 * starting with a single `/`.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/')) return fallback;
  // `//host` and `/\host` are both treated as protocol-relative by browsers.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  if (raw.startsWith('/login') || raw.startsWith('/reset-password')) return fallback;
  return raw;
}
