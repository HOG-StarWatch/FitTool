import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { FitEncoder, toSemicircles } from './src/fit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MAX_POINTS = 10000;
const ROUTE_CLOSURE_THRESHOLD_METERS = 5;
const DEFAULT_WEIGHT_KG = 65;
const DEFAULT_POWER_FACTOR = 1.3;
const DEFAULT_AVG_CADENCE = 170;
const DEFAULT_PACE_SEC_PER_KM = 360;
const DEFAULT_HR_REST = 60;
const DEFAULT_HR_MAX = 180;
const WARMUP_DURATION_SEC = 60;
const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 150;

interface RoutePoint {
  lat: number;
  lng: number;
}

interface SampleData {
  timeSec: number;
  distance: number;
  speed: number;
  heartRate: number;
  cadence: number;
  power: number;
  groundTime: number;
  flightTime: number;
  verticalOscillation: number;
  lat: number;
  lng: number;
}

interface ProcessedRoute {
  startDate: Date;
  totalDist: number;
  pace: number;
  hrRestVal: number;
  hrMaxVal: number;
  targetAvgCadence: number;
  weight: number;
  power: number;
  calories: number;
  laps: number;
  variant: number;
  samples: SampleData[];
  totalDurationSec: number;
}

interface RequestBody {
  startTime?: string;
  points?: RoutePoint[];
  paceSecondsPerKm?: number;
  hrRest?: number;
  hrMax?: number;
  lapCount?: number;
  variantIndex?: number;
  weightKg?: number;
  powerFactor?: number;
  gpsDrift?: number;
  avgCadence?: number;
}

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function offsetPointMeters(point: RoutePoint, offsetLatMeters: number, offsetLonMeters: number): RoutePoint {
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos((point.lat * Math.PI) / 180);
  return {
    lat: point.lat + offsetLatMeters / metersPerDegLat,
    lng: point.lng + offsetLonMeters / metersPerDegLon,
  };
}

function buildClosedBasePoints(points: RoutePoint[]): RoutePoint[] {
  if (!points || points.length < 2) return points || [];
  const first = points[0];
  const last = points[points.length - 1];
  const d = haversineDistance(first.lat, first.lng, last.lat, last.lng);
  if (d < ROUTE_CLOSURE_THRESHOLD_METERS) return points;
  return [...points, { lat: first.lat, lng: first.lng }];
}

function computeCalories(weightKg: number, distanceM: number, paceSecPerKm: number): number {
  const distanceKm = distanceM / 1000;
  const metFactor = 0.9 + (1000 / paceSecPerKm) * 0.25;
  return Math.round(weightKg * distanceKm * metFactor);
}

function generateCadence(speed: number, targetAvgCadence: number, index: number, totalPoints: number): number {
  const base = targetAvgCadence;
  const speedEffect = (speed - 2.5) * 6;
  const wave = Math.sin((index / totalPoints) * Math.PI * 4) * 4;
  const noise = (Math.random() - 0.5) * 6;
  const cadence = base + speedEffect + wave + noise;
  return Math.round(clamp(cadence, 120, 210));
}

function generatePower(speed: number, weightKg: number, powerFactor: number, cadence: number): number {
  const basePower = weightKg * speed * powerFactor;
  const cadenceEffect = (cadence - 170) * 0.3;
  const noise = (Math.random() - 0.5) * 10;
  return Math.round(basePower + cadenceEffect + noise);
}

function generateGroundTime(speed: number, cadence: number): number {
  const baseTime = 280 - speed * 25;
  const cadenceEffect = (170 - cadence) * 0.4;
  const noise = (Math.random() - 0.5) * 15;
  return Math.round(clamp(baseTime + cadenceEffect + noise, 180, 320));
}

function generateFlightTime(speed: number, cadence: number, groundTime: number): number {
  const strideTime = 60000 / cadence;
  const flightTime = strideTime - groundTime;
  const noise = (Math.random() - 0.5) * 10;
  return Math.round(clamp(flightTime + noise, 80, 200));
}

function generateVerticalOscillation(speed: number, cadence: number): number {
  const base = 8.5 + speed * 0.5;
  const cadenceEffect = (cadence - 170) * -0.02;
  const noise = (Math.random() - 0.5) * 1.5;
  const cmValue = clamp(base + cadenceEffect + noise, 6, 12);
  return cmValue * 10;
}

interface ComputeSamplesResult {
  samples: SampleData[];
  totalDurationSec: number;
}

function computeSamples(
  allPoints: RoutePoint[],
  distances: number[],
  totalDist: number,
  paceSecondsPerKm: number,
  hrRestVal: number,
  hrMaxVal: number,
  targetAvgCadence: number,
  weightKg: number,
  powerFactor: number
): ComputeSamplesResult {
  const totalDistanceKm = totalDist / 1000;
  const totalDurationSec = totalDistanceKm * paceSecondsPerKm;
  const avgSpeedTarget = totalDist / totalDurationSec;
  const n = allPoints.length;

  const baseSpeedFactor = 0.98 + Math.random() * 0.06;
  const phase1 = Math.random() * Math.PI * 2;
  const phase2 = Math.random() * Math.PI * 2;

  const instSpeedRaw = new Array<number>(n);
  const hrValues = new Array<number>(n);
  const cadenceValues = new Array<number>(n);
  const powerValues = new Array<number>(n);
  const groundTimeValues = new Array<number>(n);
  const flightTimeValues = new Array<number>(n);
  const verticalOscillationValues = new Array<number>(n);

  let currentHr = hrRestVal;
  let accumulatedTime = 0;
  let breathingWavePhase = 0;

  for (let i = 0; i < n; i++) {
    const frac = distances[i] / totalDist;

    const longWave = 0.04 * Math.sin(frac * Math.PI * 2 + phase1);
    const shortWave = 0.02 * Math.sin(frac * Math.PI * 6 + phase2);
    const speedRaw = avgSpeedTarget * baseSpeedFactor * (1 + longWave + shortWave);
    instSpeedRaw[i] = speedRaw;

    const effort = Math.min(1, Math.max(0.3, speedRaw / (avgSpeedTarget || 1e-6)));

    let intensityTarget: number;
    if (frac < 0.1) {
      const f = frac / 0.1;
      intensityTarget = 0.45 + 0.35 * f;
    } else if (frac < 0.85) {
      const f = (frac - 0.1) / 0.75;
      intensityTarget = 0.78 + 0.06 * Math.sin(f * Math.PI * 4);
    } else {
      const f = (frac - 0.85) / 0.15;
      intensityTarget = 0.82 + 0.15 * f;
    }

    const intensity = Math.min(1, Math.max(0, 0.7 * intensityTarget + 0.3 * effort));
    const hrTarget = hrRestVal + (hrMaxVal - hrRestVal) * intensity;

    if (accumulatedTime < WARMUP_DURATION_SEC) {
      const warmupProgress = accumulatedTime / WARMUP_DURATION_SEC;
      const warmupRate = 0.06 + 0.04 * warmupProgress;
      currentHr += (hrTarget - currentHr) * warmupRate;
    } else {
      const responseRate = 0.025 + 0.015 * intensity;
      currentHr += (hrTarget - currentHr) * responseRate;
    }

    breathingWavePhase += 0.12 + 0.08 * intensity;
    const breathingWave = Math.sin(breathingWavePhase) * (2.5 + 1.5 * intensity);
    const strideNoise = (Math.random() - 0.5) * (1.5 + 2 * intensity);
    const hrFluctuation = breathingWave + strideNoise;

    hrValues[i] = Math.round(clamp(currentHr + hrFluctuation, hrRestVal - 5, hrMaxVal + 2));
    cadenceValues[i] = generateCadence(speedRaw, targetAvgCadence, i, n);
    powerValues[i] = generatePower(speedRaw, weightKg, powerFactor, cadenceValues[i]);
    groundTimeValues[i] = generateGroundTime(speedRaw, cadenceValues[i]);
    flightTimeValues[i] = generateFlightTime(speedRaw, cadenceValues[i], groundTimeValues[i]);
    verticalOscillationValues[i] = generateVerticalOscillation(speedRaw, cadenceValues[i]);

    accumulatedTime += 1;
  }

  const segDurationsRaw = new Array<number>(Math.max(0, n - 1));
  let rawDuration = 0;
  for (let i = 1; i < n; i++) {
    const ds = distances[i] - distances[i - 1];
    const v = instSpeedRaw[i] > 0 ? instSpeedRaw[i] : avgSpeedTarget;
    const dt = ds / v;
    segDurationsRaw[i - 1] = dt;
    rawDuration += dt;
  }

  const scale = rawDuration > 0 ? totalDurationSec / rawDuration : 1;

  const samples: SampleData[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      t += segDurationsRaw[i - 1] * scale;
    }
    samples.push({
      timeSec: t,
      distance: distances[i],
      speed: instSpeedRaw[i] / scale,
      heartRate: hrValues[i],
      cadence: cadenceValues[i],
      power: powerValues[i],
      groundTime: groundTimeValues[i],
      flightTime: flightTimeValues[i],
      verticalOscillation: verticalOscillationValues[i],
      lat: allPoints[i].lat,
      lng: allPoints[i].lng,
    });
  }

  const computedTotalDurationSec = samples.length ? samples[samples.length - 1].timeSec : totalDurationSec;
  return { samples, totalDurationSec: computedTotalDurationSec };
}

function processRouteRequest(body: RequestBody): { error: string } | ProcessedRoute {
  const {
    startTime, points, paceSecondsPerKm, hrRest, hrMax, lapCount, variantIndex,
    weightKg, powerFactor, gpsDrift, avgCadence,
  } = body || {};

  if (!startTime || !points || !Array.isArray(points) || points.length < 2) {
    return { error: '缺少参数：需要 startTime、至少两个轨迹点 points' };
  }

  if (points.length > MAX_POINTS) {
    return { error: `轨迹点数量超过上限 (${MAX_POINTS})` };
  }

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number' ||
        !Number.isFinite(p.lat) || !Number.isFinite(p.lng) ||
        p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
      return { error: `第 ${i + 1} 个轨迹点坐标无效（纬度 -90~90，经度 -180~180）` };
    }
  }

  const startDate = new Date(startTime);
  if (Number.isNaN(startDate.getTime())) {
    return { error: 'startTime 格式不正确' };
  }

  const weight = (Number.isFinite(Number(weightKg)) && weightKg! > MIN_WEIGHT_KG && weightKg! < MAX_WEIGHT_KG)
    ? Number(weightKg) : DEFAULT_WEIGHT_KG;
  const power = (Number.isFinite(Number(powerFactor)) && (powerFactor ?? 0) > 0)
    ? Number(powerFactor) : DEFAULT_POWER_FACTOR;
  const drift = Number.isFinite(Number(gpsDrift)) ? Number(gpsDrift) : 0;
  const targetAvgCadence = Number.isFinite(Number(avgCadence)) ? Number(avgCadence) : DEFAULT_AVG_CADENCE;
  const pace = (Number(paceSecondsPerKm) > 0 && Number(paceSecondsPerKm) < 2000)
    ? Number(paceSecondsPerKm) : DEFAULT_PACE_SEC_PER_KM;
  const hrRestVal = Number.isFinite(Number(hrRest)) ? Number(hrRest) : DEFAULT_HR_REST;
  const hrMaxVal = Number.isFinite(Number(hrMax)) ? Math.max(100, Math.min(220, Number(hrMax))) : DEFAULT_HR_MAX;
  const lapsRaw = Number(lapCount);
  const laps = (Number.isFinite(lapsRaw) && lapsRaw > 0) ? lapsRaw : 1;
  const variantRaw = Number(variantIndex);
  const variant = (Number.isFinite(variantRaw) && variantRaw > 0) ? Math.floor(variantRaw) : 1;

  const basePoints = buildClosedBasePoints(points);
  const allPoints: RoutePoint[] = [];
  const usedLaps = laps > 0 ? laps : 1;
  const shouldApplyDrift = drift > 0;
  const fullLaps = Math.floor(usedLaps);
  const partialLap = usedLaps - fullLaps;

  for (let i = 0; i < fullLaps; i++) {
    let offsetLatMeters = 0;
    let offsetLonMeters = 0;
    if (shouldApplyDrift) {
      const radiusMeters = drift * 10;
      const angle = Math.random() * Math.PI * 2;
      offsetLatMeters = radiusMeters * Math.cos(angle);
      offsetLonMeters = radiusMeters * Math.sin(angle);
    }
    for (const p of basePoints) {
      allPoints.push(shouldApplyDrift ? offsetPointMeters(p, offsetLatMeters, offsetLonMeters) : p);
    }
  }

  if (partialLap > 0) {
    let offsetLatMeters = 0;
    let offsetLonMeters = 0;
    if (shouldApplyDrift) {
      const radiusMeters = drift * 10;
      const angle = Math.random() * Math.PI * 2;
      offsetLatMeters = radiusMeters * Math.cos(angle);
      offsetLonMeters = radiusMeters * Math.sin(angle);
    }
    const partialPointsCount = Math.floor(basePoints.length * partialLap);
    for (let i = 0; i < partialPointsCount; i++) {
      const p = basePoints[i];
      allPoints.push(shouldApplyDrift ? offsetPointMeters(p, offsetLatMeters, offsetLonMeters) : p);
    }
  }

  const distances = [0];
  let totalDist = 0;
  for (let i = 1; i < allPoints.length; i++) {
    const d = haversineDistance(allPoints[i - 1].lat, allPoints[i - 1].lng, allPoints[i].lat, allPoints[i].lng);
    totalDist += d;
    distances.push(totalDist);
  }

  if (totalDist === 0) {
    return { error: '轨迹距离为 0，请绘制更长的路线' };
  }

  const calories = computeCalories(weight, totalDist, pace);

  const { samples, totalDurationSec } = computeSamples(
    allPoints, distances, totalDist, pace, hrRestVal, hrMaxVal, targetAvgCadence, weight, power,
  );

  return {
    startDate, totalDist, pace, hrRestVal, hrMaxVal,
    targetAvgCadence, weight, power, calories, laps, variant, samples, totalDurationSec,
  };
}

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

    const { startDate, totalDist, totalDurationSec, hrMaxVal, variant, samples, calories } = result;
    const avgSpeed = totalDist / totalDurationSec;

    let totalPower = 0;
    let totalCadence = 0;
    let totalHr = 0;
    for (const s of samples) {
      totalPower += s.power;
      totalCadence += s.cadence;
      totalHr += s.heartRate;
    }
    const avgPower = Math.round(totalPower / samples.length);
    const calculatedAvgCadence = Math.round(totalCadence / samples.length);
    const avgHr = Math.round(totalHr / samples.length);

    const sessionEnd = new Date(startDate.getTime() + totalDurationSec * 1000);

    const encoder = new FitEncoder({
      type: 'activity',
      manufacturer: 'development',
      product: 1,
      serialNumber: 1,
      timeCreated: startDate,
      sport: 'running',
      subSport: 'generic',
    });

    encoder.writeFileIdMessage();
    encoder.writeDeviceInfoMessage(startDate);

    for (const s of samples) {
      const timestamp = new Date(startDate.getTime() + s.timeSec * 1000);
      encoder.writeRecordMessage({
        timestamp,
        positionLat: toSemicircles(s.lat),
        positionLong: toSemicircles(s.lng),
        distance: s.distance,
        speed: s.speed,
        heartRate: s.heartRate,
        cadence: Math.round(s.cadence / 2),
        power: s.power,
        enhancedSpeed: s.speed,
        stanceTime: s.groundTime,
        stanceTimePercent: clamp((s.groundTime / (s.groundTime + s.flightTime)) * 100, 40, 70),
        verticalOscillation: s.verticalOscillation,
        stepLength: (s.speed * 1000) / (s.cadence / 60) / 100,
      });
    }

    encoder.writeLapMessage({
      timestamp: sessionEnd,
      startTime: startDate,
      totalElapsedTime: totalDurationSec,
      totalTimerTime: totalDurationSec,
      totalDistance: totalDist,
      totalCalories: calories,
      sport: 'running',
      subSport: 'generic',
      avgSpeed,
      avgHeartRate: avgHr,
      maxHeartRate: hrMaxVal,
      avgCadence: Math.round(calculatedAvgCadence / 2),
      avgPower,
    });

    encoder.writeSessionMessage({
      timestamp: sessionEnd,
      startTime: startDate,
      totalElapsedTime: totalDurationSec,
      totalTimerTime: totalDurationSec,
      totalDistance: totalDist,
      totalCalories: calories,
      sport: 'running',
      subSport: 'generic',
      avgSpeed,
      avgHeartRate: avgHr,
      maxHeartRate: hrMaxVal,
      avgCadence: Math.round(calculatedAvgCadence / 2),
      avgPower,
    });

    encoder.writeActivityMessage({
      timestamp: sessionEnd,
      totalTimerTime: totalDurationSec,
      numSessions: 1,
      type: 'manual',
    });

    const uint8Array = encoder.close();

    return new Response(uint8Array.buffer.slice(
      uint8Array.byteOffset,
      uint8Array.byteOffset + uint8Array.byteLength
    ) as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.ant.fit',
        'Content-Disposition': `attachment; filename=run_${variant}.fit`,
      },
    });
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