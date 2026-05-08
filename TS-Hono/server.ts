import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { processRouteRequest, generateFitFile, RequestBody } from './src/lib';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = new Hono();

app.use('/*', serveStatic({ root: join(__dirname, 'public') }));

app.use('/api/*', async (c, next) => {
  const origins = process.env.ALLOWED_ORIGINS;
  if (origins) {
    const originList = origins.split(',').map(s => s.trim());
    if (originList.includes('*')) {
      return cors()(c, next);
    }
    return cors({ origin: originList, allowMethods: ['POST', 'OPTIONS'], allowHeaders: ['Content-Type'], maxAge: 86400 })(c, next);
  }
  await next();
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

const port = Number(process.env.PORT) || 3000;

try {
  serve({
    fetch: app.fetch,
    port,
  });
  console.log(`Server listening on http://localhost:${port}`);
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}
