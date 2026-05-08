import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { processRouteRequest, generateFitFile, RequestBody } from './lib';
import { rateLimit, getRateLimitStats } from './middleware/rate-limit';

type Bindings = {
  ALLOWED_ORIGINS?: string;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/api/*', async (c, next) => {
  const origins = c.env.ALLOWED_ORIGINS;
  if (origins) {
    const originList = origins.split(',').map(s => s.trim());
    if (originList.includes('*')) {
      return cors()(c, next);
    }
    return cors({ origin: originList, allowMethods: ['POST', 'OPTIONS', 'GET'], allowHeaders: ['Content-Type'], maxAge: 86400 })(c, next);
  }
  await next();
});

app.use('/api/*', rateLimit);

app.get('/api/health', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 
             c.req.header('X-Forwarded-For') || 
             c.req.header('X-Real-IP') || 
             'unknown';
  
  const stats = getRateLimitStats(ip);
  
  return c.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: typeof process !== 'undefined' && process.uptime ? process.uptime() : 0,
    rateLimit: stats
  });
});

app.get('/api/status', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 
             c.req.header('X-Forwarded-For') || 
             c.req.header('X-Real-IP') || 
             'unknown';
  
  const stats = getRateLimitStats(ip);
  
  return c.json({
    status: 'available',
    service: 'fit-tool',
    version: '1.6.0',
    rateLimit: {
      used: stats.used,
      remaining: stats.remaining,
      limit: stats.limit,
      resetTime: stats.resetTime
    }
  });
});

app.post('/api/preview', async (c) => {
  try {
    const body = await c.req.json<RequestBody>();
    const result = processRouteRequest(body || {});
    if ('error' in result) return c.json({ error: result.error }, 400);

    return c.json({
      totalDistanceMeters: result.totalDist,
      totalDurationSec: result.totalDurationSec,
      samples: result.samples,
      calories: result.calories,
    });
  } catch (e) {
    console.error(e);
    return c.json({ error: '生成预览失败' }, 500);
  }
});

app.post('/api/generate-fit', async (c) => {
  try {
    const body = await c.req.json<RequestBody>();
    const result = processRouteRequest(body || {});
    if ('error' in result) return c.json({ error: result.error }, 400);
    return generateFitFile(result);
  } catch (e) {
    console.error(e);
    return c.json({ error: '生成 FIT 文件失败' }, 500);
  }
});

export default {
  fetch: async (request: Request, env: Bindings, ctx: ExecutionContext) => {
    const url = new URL(request.url);
    
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }
    
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    
    return new Response('Not Found', { status: 404 });
  },
};
