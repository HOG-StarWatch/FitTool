import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { rateLimit } from '../../src/middleware/rate-limit';
import { processRouteRequest, generateFitFile, RequestBody } from '../../src/lib';
import { version } from '../../package.json';

type Bindings = {
  ALLOWED_ORIGINS?: string;
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
  return c.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: typeof process !== 'undefined' && process.uptime ? process.uptime() : 0,
  });
});

app.get('/api/status', async (c) => {
  return c.json({
    status: 'available',
    service: 'fit-tool',
    version,
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
    const sensorOptions = {
      includeHeartRate: body.includeHeartRate !== false,
      includePower: body.includePower !== false,
      includeCadence: body.includeCadence !== false,
      includeGaitData: body.includeGaitData !== false,
    };
    return generateFitFile(result, sensorOptions);
  } catch (e) {
    console.error(e);
    return c.json({ error: '生成 FIT 文件失败' }, 500);
  }
});

export const onRequestPost = async (context: { request: Request; params: Record<string, string | string[]>; env: Bindings; waitUntil: (promise: Promise<void>) => void; passThroughOnException: () => void }) => {
  return app.fetch(context.request, context.env, context);
};

export const onRequestGet = async (context: { request: Request; params: Record<string, string | string[]>; env: Bindings; waitUntil: (promise: Promise<void>) => void; passThroughOnException: () => void }) => {
  return app.fetch(context.request, context.env, context);
};
