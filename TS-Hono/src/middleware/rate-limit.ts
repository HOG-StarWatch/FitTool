import { MiddlewareHandler } from 'hono';

export interface RateLimitConfig {
  limit?: number;
  windowSeconds?: number;
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100;
const WINDOW_SECONDS = 3600;

export const rateLimit: MiddlewareHandler = async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || 
             c.req.header('X-Forwarded-For') || 
             c.req.header('X-Real-IP') || 
             'unknown';
  
  const now = Date.now();
  const windowKey = Math.floor(now / (WINDOW_SECONDS * 1000));
  const cacheKey = `${ip}-${windowKey}`;
  
  const current = rateLimitStore.get(cacheKey) || { 
    count: 0, 
    resetTime: windowKey * WINDOW_SECONDS * 1000 + WINDOW_SECONDS * 1000 
  };
  
  if (current.count >= RATE_LIMIT) {
    const remaining = Math.ceil((current.resetTime - now) / 1000);
    return c.json({ 
      error: '请求过于频繁', 
      retryAfter: remaining,
      message: `请在 ${remaining} 秒后重试` 
    }, 429);
  }
  
  rateLimitStore.set(cacheKey, { count: current.count + 1, resetTime: current.resetTime });
  
  c.res.headers.set('X-RateLimit-Limit', String(RATE_LIMIT));
  c.res.headers.set('X-RateLimit-Remaining', String(RATE_LIMIT - current.count - 1));
  c.res.headers.set('X-RateLimit-Reset', String(Math.ceil(current.resetTime / 1000)));
  
  await next();
};

export function getRateLimitStats(ip: string) {
  const now = Date.now();
  const windowKey = Math.floor(now / (WINDOW_SECONDS * 1000));
  const cacheKey = `${ip}-${windowKey}`;
  
  const current = rateLimitStore.get(cacheKey) || { 
    count: 0, 
    resetTime: windowKey * WINDOW_SECONDS * 1000 + WINDOW_SECONDS * 1000 
  };
  
  return {
    used: current.count,
    remaining: Math.max(0, RATE_LIMIT - current.count),
    limit: RATE_LIMIT,
    resetTime: current.resetTime
  };
}
