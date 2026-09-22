// The site is public (no login). The paid endpoint is protected three ways:
// same-origin POSTs only (browsers), an allow-list of question ids (the proxy
// is useless for anything but this VJ), and rate limits per IP and site-wide.
const forbidden = (): Response => new Response('Cross-site request blocked', { status: 403, headers: { 'Cache-Control': 'no-store' } });

/**
 * Only accept state-changing requests the browser marks as same-origin.
 * Sec-Fetch-Site / Origin are set by the browser and cannot be forged by page
 * script; a non-browser client without either header is refused.
 */
export function requireSameOrigin(request: Request, url: URL): Response | null {
  if (request.method === 'GET' || request.method === 'HEAD') return null;
  const site = request.headers.get('Sec-Fetch-Site');
  if (site) return site === 'same-origin' ? null : forbidden();
  const origin = request.headers.get('Origin');
  if (origin) return origin === url.origin ? null : forbidden();
  return forbidden();
}

/** The question ids this app asks; anything else is not relayed. */
export const ALLOWED_QUESTION_IDS = new Set(['phase', 'drop_soon', 'switch_now', 'scene', 'drop_scene', 'intensity', 'palette', 'transition', 'kime', 'kime_on_drop']);
