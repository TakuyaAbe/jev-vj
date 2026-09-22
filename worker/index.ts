// Cloudflare Worker: serves the static build and proxies /api/jev to TypeSafe
// (the API key lives only here as a secret). /api/spotify is local-only
// (AppleScript on the dev machine) and reports itself unavailable.
import { ALLOWED_QUESTION_IDS, requireSameOrigin } from './auth';
import type { Env } from './env';

const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MAX_BODY_BYTES = 256 * 1024;
const NO_STORE = { 'Cache-Control': 'no-store' };

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...NO_STORE, ...headers } });

async function jev(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: NO_STORE });
  if (!env.TYPESAFE_API_KEY) return json({ error: 'TYPESAFE_API_KEY is not set (wrangler secret put TYPESAFE_API_KEY)' }, 500);

  // rate limits: per client IP, then site-wide
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (env.JEV_RL && !(await env.JEV_RL.limit({ key: ip })).success) return json({ error: 'rate limited (per client)' }, 429, { 'Retry-After': '10' });
  if (env.JEV_RL_GLOBAL && !(await env.JEV_RL_GLOBAL.limit({ key: 'site' })).success) return json({ error: 'rate limited (site)' }, 429, { 'Retry-After': '30' });

  // bounded body, read as bytes
  const reader = request.body?.getReader();
  if (!reader) return json({ error: 'empty body' }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return json({ error: 'request too large' }, 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    bytes.set(c, off);
    off += c.byteLength;
  }
  let body: { state?: unknown; questions?: unknown };
  try {
    body = JSON.parse(new TextDecoder().decode(bytes)) as { state?: unknown; questions?: unknown };
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  if (typeof body.state !== 'object' || body.state === null || typeof body.questions !== 'object' || body.questions === null || Array.isArray(body.questions)) {
    return json({ error: 'state and questions are required' }, 400);
  }
  // only this app's questions are relayed, so the proxy cannot be repurposed
  const ids = Object.keys(body.questions as Record<string, unknown>);
  if (ids.length === 0 || ids.some((id) => !ALLOWED_QUESTION_IDS.has(id))) return json({ error: 'unknown question id' }, 400);

  const t0 = Date.now();
  try {
    const upstream = await fetch(JEV_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.TYPESAFE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env.TYPESAFE_MODEL ?? 'jev-latest', state: body.state, questions: body.questions }),
      signal: AbortSignal.timeout(8000),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...NO_STORE, 'X-Jev-Upstream-Ms': String(Date.now() - t0) },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
}

const FILE_LIKE = /\.[a-z0-9]{2,5}$/i;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/jev') {
      const blocked = requireSameOrigin(request, url);
      if (blocked) return blocked;
      return jev(request, env);
    }
    if (url.pathname === '/api/spotify') return json({ running: false, unavailable: true });
    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);

    const res = await env.ASSETS.fetch(request);
    const isHtml = (res.headers.get('Content-Type') ?? '').startsWith('text/html');
    // a missing file-like path must not come back as the SPA shell (and get cached as it)
    if (isHtml && FILE_LIKE.test(url.pathname) && !url.pathname.endsWith('.html')) return new Response('not found', { status: 404, headers: NO_STORE });
    const headers = new Headers(res.headers);
    const cc = isHtml
      ? 'no-cache'
      : url.pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable' // content-hashed by Vite
        : url.pathname.startsWith('/tracks/') && url.pathname.endsWith('.mp3')
          ? 'public, max-age=86400'
          : 'public, max-age=3600';
    headers.set('Cache-Control', cc);
    headers.set('X-Frame-Options', 'DENY');
    headers.set('Referrer-Policy', 'no-referrer');
    return new Response(res.body, { status: res.status, headers });
  },
};
