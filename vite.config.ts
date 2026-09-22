import { execFile } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = process.env.JEV_MODEL ?? 'jev-latest';

/**
 * Dev-only proxy: the browser posts { state, questions } to /api/jev and this
 * middleware adds the model and the API key (TYPESAFE_API_KEY from the env).
 * The key never reaches the client bundle.
 */
function jevProxy(): Plugin {
  return {
    name: 'jev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/jev', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('POST only');
          return;
        }
        const apiKey = process.env.TYPESAFE_API_KEY;
        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'TYPESAFE_API_KEY is not set in the dev server environment' }));
          return;
        }
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        let body: { state: unknown; questions: unknown };
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          res.statusCode = 400;
          res.end('bad json');
          return;
        }
        const t0 = performance.now();
        try {
          const upstream = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: MODEL, state: body.state, questions: body.questions }),
            signal: AbortSignal.timeout(8000),
          });
          const text = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('X-Jev-Upstream-Ms', String(Math.round(performance.now() - t0)));
          res.end(text);
        } catch (e) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
        }
      });
    },
  };
}

const SPOTIFY_SCRIPT = `
if application "Spotify" is running then
  tell application "Spotify"
    set t to current track
    return (player state as string) & tab & (player position as string) & tab & (duration of t as string) & tab & (name of t) & tab & (artist of t) & tab & (album of t)
  end tell
else
  return "not running"
end if`;

/** Dev-only: what the local Spotify app is playing, read with AppleScript (macOS). */
function spotifyNowPlaying(): Plugin {
  let cache: { at: number; body: string } | null = null;
  return {
    name: 'spotify-now-playing',
    configureServer(server) {
      server.middlewares.use('/api/spotify', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (cache && Date.now() - cache.at < 1000) {
          res.end(cache.body);
          return;
        }
        execFile('osascript', ['-e', SPOTIFY_SCRIPT], { timeout: 3000 }, (err, stdout, stderr) => {
          let body: string;
          if (err) body = JSON.stringify({ running: false, error: (stderr.trim().split('\n').pop() || 'osascript failed').replace(/^\d+:\d+: /, '').slice(0, 120) });
          else if (stdout.trim() === 'not running') body = JSON.stringify({ running: false });
          else {
            const [state, position, duration, name, artist, album] = stdout.replace(/\n$/, '').split('\t');
            body = JSON.stringify({ running: true, state, position: Number(position), duration: Number(duration) / 1000, name, artist, album });
          }
          cache = { at: Date.now(), body };
          res.end(body);
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [jevProxy(), spotifyNowPlaying()],
  server: { host: '127.0.0.1', fs: { allow: ['.', process.env.HOME ?? '/'] } },
});
