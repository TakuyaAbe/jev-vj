/** Cloudflare Workers Rate Limiting binding */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  TYPESAFE_API_KEY?: string;
  TYPESAFE_MODEL?: string;
  /** per-client-IP limiter for /api/jev */
  JEV_RL?: RateLimiter;
  /** site-wide limiter for /api/jev (bounds worst-case spend) */
  JEV_RL_GLOBAL?: RateLimiter;
}
