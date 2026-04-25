// ==================== 项目入口与依赖导入 ====================
// 功能：导入Express框架、路径处理模块和Garmin FIT文件生成SDK

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Encoder, Profile } from "@garmin/fitsdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== Express服务器初始化 ====================
// 功能：创建Express应用实例，配置端口和中间件

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ==================== 地理坐标处理工具函数 ====================
// 功能：提供经纬度坐标转换、距离计算、轨迹处理等功能

function toSemicircles(deg) {
  return Math.round((deg * 2147483648) / 180);
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
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

function offsetPointMeters(point, offsetLatMeters, offsetLonMeters) {
  const metersPerDegLat = 111320;
  const metersPerDegLon =
    111320 * Math.cos((point.lat * Math.PI) / 180);
  return {
    lat: point.lat + offsetLatMeters / metersPerDegLat,
    lng: point.lng + offsetLonMeters / metersPerDegLon
  };
}

function buildClosedBasePoints(points) {
  if (!points || points.length < 2) return points || [];
  const first = points[0];
  const last = points[points.length - 1];
  const d = haversineDistance(first.lat, first.lng, last.lat, last.lng);
  if (d < 5) {
    return points;
  }
  const closed = points.slice();
  closed.push({ lat: first.lat, lng: first.lng });
  return closed;
}

// ==================== 运动数据生成模块 ====================
// 功能：根据输入参数生成步频、功率、触地时间、腾空时间、垂直振幅等运动数据

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function generateCadence(speed, targetAvgCadence, index, totalPoints) {
  const base = targetAvgCadence;
  const speedEffect = (speed - 2.5) * 6;
  const wave = Math.sin((index / totalPoints) * Math.PI * 4) * 4;
  const noise = (Math.random() - 0.5) * 6;
  const cadence = base + speedEffect + wave + noise;
  return Math.round(clamp(cadence, 120, 210));
}

function generatePower(speed, weightKg, powerFactor, cadence) {
  const basePower = weightKg * speed * powerFactor;
  const cadenceEffect = (cadence - 170) * 0.3;
  const noise = (Math.random() - 0.5) * 10;
  return Math.round(basePower + cadenceEffect + noise);
}

function generateGroundTime(speed, cadence) {
  const baseTime = 280 - speed * 25;
  const cadenceEffect = (170 - cadence) * 0.4;
  const noise = (Math.random() - 0.5) * 15;
  return Math.round(clamp(baseTime + cadenceEffect + noise, 180, 320));
}

function generateFlightTime(speed, cadence, groundTime) {
  const strideTime = 60000 / cadence;
  const flightTime = strideTime - groundTime;
  const noise = (Math.random() - 0.5) * 10;
  return Math.round(clamp(flightTime + noise, 80, 200));
}

function generateVerticalOscillation(speed, cadence) {
  const base = 8.5 + speed * 0.5;
  const cadenceEffect = (cadence - 170) * -0.02;
  const noise = (Math.random() - 0.5) * 1.5;
  const cmValue = clamp(base + cadenceEffect + noise, 6, 12);
  return cmValue * 10;
}

// ==================== 运动样本计算模块 ====================
// 功能：根据轨迹点和运动参数计算完整的运动样本数据，包括速度、心率、步频等

function computeSamples(allPoints, distances, totalDist, paceSecondsPerKm, hrRestVal, hrMaxVal, targetAvgCadence, weightKg, powerFactor) {
  const totalDistanceKm = totalDist / 1000;
  const totalDurationSec = totalDistanceKm * paceSecondsPerKm;
  const avgSpeedTarget = totalDist / totalDurationSec;
  const n = allPoints.length;

  const baseSpeedFactor = 0.98 + Math.random() * 0.06;
  const phase1 = Math.random() * Math.PI * 2;
  const phase2 = Math.random() * Math.PI * 2;

  const instSpeedRaw = new Array(n);
  const hrValues = new Array(n);
  const cadenceValues = new Array(n);
  const powerValues = new Array(n);
  const groundTimeValues = new Array(n);
  const flightTimeValues = new Array(n);
  const verticalOscillationValues = new Array(n);

  let currentHr = hrRestVal;
  const warmupDuration = 60;
  let accumulatedTime = 0;
  let breathingWavePhase = 0;

  for (let i = 0; i < n; i++) {
    const frac = distances[i] / totalDist;

    const longWave = 0.04 * Math.sin(frac * Math.PI * 2 + phase1);
    const shortWave = 0.02 * Math.sin(frac * Math.PI * 6 + phase2);
    const speedRaw = avgSpeedTarget * baseSpeedFactor * (1 + longWave + shortWave);
    instSpeedRaw[i] = speedRaw;

    const effort = Math.min(1, Math.max(0.3, speedRaw / (avgSpeedTarget || 1e-6)));

    let intensityTarget;
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

    if (accumulatedTime < warmupDuration) {
      const warmupProgress = accumulatedTime / warmupDuration;
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

    const hrValue = Math.round(
      clamp(currentHr + hrFluctuation, hrRestVal - 5, hrMaxVal + 2)
    );
    hrValues[i] = hrValue;

    const cadence = generateCadence(speedRaw, targetAvgCadence, i, n);
    cadenceValues[i] = cadence;

    const power = generatePower(speedRaw, weightKg, powerFactor, cadence);
    powerValues[i] = power;

    const groundTime = generateGroundTime(speedRaw, cadence);
    groundTimeValues[i] = groundTime;

    const flightTime = generateFlightTime(speedRaw, cadence, groundTime);
    flightTimeValues[i] = flightTime;

    const verticalOscillation = generateVerticalOscillation(speedRaw, cadence);
    verticalOscillationValues[i] = verticalOscillation;

    accumulatedTime += 1;
  }

  const segDurationsRaw = new Array(Math.max(0, n - 1));
  let rawDuration = 0;
  for (let i = 1; i < n; i++) {
    const ds = distances[i] - distances[i - 1];
    const v = instSpeedRaw[i] > 0 ? instSpeedRaw[i] : avgSpeedTarget;
    const dt = ds / v;
    segDurationsRaw[i - 1] = dt;
    rawDuration += dt;
  }

  const scale = rawDuration > 0 ? totalDurationSec / rawDuration : 1;

  const samples = [];
  let t = 0;
  samples.push({
    timeSec: 0,
    distance: distances[0],
    speed: instSpeedRaw[0] / scale,
    heartRate: hrValues[0],
    cadence: cadenceValues[0],
    power: powerValues[0],
    groundTime: groundTimeValues[0],
    flightTime: flightTimeValues[0],
    verticalOscillation: verticalOscillationValues[0],
    lat: allPoints[0].lat,
    lng: allPoints[0].lng
  });

  for (let i = 1; i < n; i++) {
    const dt = segDurationsRaw[i - 1] * scale;
    t += dt;
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
      lng: allPoints[i].lng
    });
  }

  const computedTotalDurationSec = samples.length ? samples[samples.length - 1].timeSec : totalDurationSec;

  return { samples, totalDurationSec: computedTotalDurationSec };
}

// ==================== API端点模块 ====================
// 功能：提供运动预览和FIT文件生成的API接口

app.post("/api/preview", (req, res) => {
  try {
    const {
      startTime,
      points,
      paceSecondsPerKm,
      hrRest,
      hrMax,
      lapCount,
      weightKg,
      powerFactor,
      gpsDrift,
      avgCadence
    } = req.body || {};

    const weight =
      Number.isFinite(Number(weightKg)) && weightKg > 30 && weightKg < 150
      ? Number(weightKg)
      : 65;
    
    const power = Number.isFinite(Number(powerFactor)) && powerFactor > 0 ? Number(powerFactor) : 1.3;
    const drift = Number.isFinite(Number(gpsDrift)) ? Number(gpsDrift) : 0;
    const targetAvgCadence = Number.isFinite(Number(avgCadence)) ? Number(avgCadence) : 170;

    if (!startTime || !points || !Array.isArray(points) || points.length < 2) {
      return res.status(400).json({
        error: "缺少参数：需要 startTime、至少两个轨迹点 points"
      });
    }

    const startDate = new Date(startTime);
    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ error: "startTime 格式不正确" });
    }

    const pace = Number(paceSecondsPerKm) > 0 && Number(paceSecondsPerKm) < 2000 ? Number(paceSecondsPerKm) : 360;
    const hrRestVal = Number.isFinite(Number(hrRest)) ? Number(hrRest) : 60;
    const hrMaxVal = Number.isFinite(Number(hrMax)) ? Math.max(100, Math.min(220, Number(hrMax))) : 180;
    const lapsRaw = Number(lapCount);
    const laps = Number.isFinite(lapsRaw) && lapsRaw > 0 ? lapsRaw : 1;

    const basePoints = buildClosedBasePoints(points);
    const allPoints = [];
    const usedLaps = laps > 0 ? laps : 1;
    const shouldApplyDrift = drift > 0;

    const fullLaps = Math.floor(usedLaps);
    const partialLap = usedLaps - fullLaps;

    for (let lapIndex = 0; lapIndex < fullLaps; lapIndex++) {
      let offsetLatMeters = 0;
      let offsetLonMeters = 0;
      
      if (shouldApplyDrift) {
        const radiusMeters = drift * 10;
        const angle = Math.random() * Math.PI * 2;
        offsetLatMeters = radiusMeters * Math.cos(angle);
        offsetLonMeters = radiusMeters * Math.sin(angle);
      }

      for (let i = 0; i < basePoints.length; i++) {
        const p = basePoints[i];
        const noisyPoint = shouldApplyDrift
          ? offsetPointMeters(p, offsetLatMeters, offsetLonMeters)
          : p;
        allPoints.push(noisyPoint);
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
        const noisyPoint = shouldApplyDrift
          ? offsetPointMeters(p, offsetLatMeters, offsetLonMeters)
          : p;
        allPoints.push(noisyPoint);
      }
    }

    const distances = [0];
    let totalDist = 0;
    for (let i = 1; i < allPoints.length; i++) {
      const d = haversineDistance(
        allPoints[i - 1].lat,
        allPoints[i - 1].lng,
        allPoints[i].lat,
        allPoints[i].lng
      );
      totalDist += d;
      distances.push(totalDist);
    }

    if (totalDist === 0) {
      return res.status(400).json({ error: "轨迹距离为 0，请绘制更长的路线" });
    }

    const calories = Math.round(weight * (totalDist / 1000) * 1.036);

    const { samples, totalDurationSec } = computeSamples(
      allPoints,
      distances,
      totalDist,
      pace,
      hrRestVal,
      hrMaxVal,
      targetAvgCadence,
      weight,
      power
    );

    return res.json({
      totalDistanceMeters: totalDist,
      totalDurationSec,
      samples,
      calories
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "生成预览失败" });
  }
});

app.post("/api/generate-fit", (req, res) => {
  try {
    const {
      startTime,
      points,
      paceSecondsPerKm,
      hrRest,
      hrMax,
      lapCount,
      variantIndex,
      weightKg,
      powerFactor,
      gpsDrift,
      avgCadence
    } = req.body || {};

    const weight =
      Number.isFinite(Number(weightKg)) && weightKg > 30 && weightKg < 150
      ? Number(weightKg)
      : 65;

    if (!startTime || !points || !Array.isArray(points) || points.length < 2) {
      return res.status(400).json({
        error: "缺少参数：需要 startTime、至少两个轨迹点 points"
      });
    }

    const startDate = new Date(startTime);
    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ error: "startTime 格式不正确" });
    }

    const pace = Number(paceSecondsPerKm) > 0 && Number(paceSecondsPerKm) < 2000 ? Number(paceSecondsPerKm) : 360;
    const hrRestVal = Number.isFinite(Number(hrRest)) ? Number(hrRest) : 60;
    const hrMaxVal = Number.isFinite(Number(hrMax)) ? Math.max(100, Math.min(220, Number(hrMax))) : 180;
    const lapsRaw = Number(lapCount);
    const laps = Number.isFinite(lapsRaw) && lapsRaw > 0 ? lapsRaw : 1;
    const variantRaw = Number(variantIndex);
    const variant =
      Number.isFinite(variantRaw) && variantRaw > 0
        ? Math.floor(variantRaw)
        : 1;
    const power = Number.isFinite(Number(powerFactor)) && powerFactor > 0 ? Number(powerFactor) : 1.3;
    const drift = Number.isFinite(Number(gpsDrift)) ? Number(gpsDrift) : 0;
    const targetAvgCadence = Number.isFinite(Number(avgCadence)) ? Number(avgCadence) : 170;

    const basePoints = buildClosedBasePoints(points);
    const allPoints = [];
    const usedLaps = laps > 0 ? laps : 1;

    const fullLaps = Math.floor(usedLaps);
    const partialLap = usedLaps - fullLaps;

    const shouldApplyDrift = drift > 0;

    for (let lapIndex = 0; lapIndex < fullLaps; lapIndex++) {
      let offsetLatMeters = 0;
      let offsetLonMeters = 0;
      
      if (shouldApplyDrift) {
        const radiusMeters = drift * 10;
        const angle = Math.random() * Math.PI * 2;
        offsetLatMeters = radiusMeters * Math.cos(angle);
        offsetLonMeters = radiusMeters * Math.sin(angle);
      }

      for (let i = 0; i < basePoints.length; i++) {
        const p = basePoints[i];
        const noisyPoint = shouldApplyDrift
          ? offsetPointMeters(p, offsetLatMeters, offsetLonMeters)
          : p;
        allPoints.push(noisyPoint);
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
        const noisyPoint = shouldApplyDrift
          ? offsetPointMeters(p, offsetLatMeters, offsetLonMeters)
          : p;
        allPoints.push(noisyPoint);
      }
    }

    const distances = [0];
    let totalDist = 0;
    for (let i = 1; i < allPoints.length; i++) {
      const d = haversineDistance(
        allPoints[i - 1].lat,
        allPoints[i - 1].lng,
        allPoints[i].lat,
        allPoints[i].lng
      );
      totalDist += d;
      distances.push(totalDist);
    }

    if (totalDist === 0) {
      return res.status(400).json({ error: "轨迹距离为 0，请绘制更长的路线" });
    }

    const calories = Math.round(weight * (totalDist / 1000) * 1.036);

    const { samples, totalDurationSec } = computeSamples(
      allPoints,
      distances,
      totalDist,
      pace,
      hrRestVal,
      hrMaxVal,
      targetAvgCadence,
      weight,
      power
    );

    const encoder = new Encoder();

    encoder.onMesg(Profile.MesgNum.FILE_ID, {
      manufacturer: "development",
      product: 1,
      timeCreated: startDate,
      type: "activity"
    });

    encoder.onMesg(Profile.MesgNum.DEVICE_INFO, {
      timestamp: startDate,
      manufacturer: "development",
      product: 1,
      serialNumber: 1
    });

    const avgSpeed = totalDist / totalDurationSec;

    let totalPower = 0;
    let totalGroundTime = 0;
    let totalFlightTime = 0;
    let totalVerticalOscillation = 0;
    let totalCadence = 0;
    let totalHr = 0;

    for (let i = 0; i < samples.length; i++) {
      totalPower += samples[i].power;
      totalGroundTime += samples[i].groundTime;
      totalFlightTime += samples[i].flightTime;
      totalVerticalOscillation += samples[i].verticalOscillation;
      totalCadence += samples[i].cadence;
      totalHr += samples[i].heartRate;
    }

    const avgPower = Math.round(totalPower / samples.length);
    const avgGroundTime = Math.round(totalGroundTime / samples.length);
    const avgFlightTime = Math.round(totalFlightTime / samples.length);
    const avgVerticalOscillation = totalVerticalOscillation / samples.length;
    const calculatedAvgCadence = Math.round(totalCadence / samples.length);
    const avgHr = Math.round(totalHr / samples.length);

    const sessionEnd = new Date(startDate.getTime() + totalDurationSec * 1000);

    encoder.onMesg(Profile.MesgNum.SESSION, {
      timestamp: sessionEnd,
      startTime: startDate,
      totalElapsedTime: totalDurationSec,
      totalTimerTime: totalDurationSec,
      totalDistance: totalDist,
      totalCalories: calories,
      sport: "running",
      subSport: "generic",
      avgSpeed,
      avgHeartRate: avgHr,
      maxHeartRate: hrMaxVal,
      avgCadence: Math.round(calculatedAvgCadence / 2),
      avgPower,
      enhancedAvgPower: avgPower
    });

    encoder.onMesg(Profile.MesgNum.LAP, {
      timestamp: sessionEnd,
      startTime: startDate,
      totalElapsedTime: totalDurationSec,
      totalTimerTime: totalDurationSec,
      totalDistance: totalDist,
      totalCalories: calories,
      sport: "running",
      subSport: "generic",
      avgSpeed,
      avgHeartRate: avgHr,
      maxHeartRate: hrMaxVal,
      avgCadence: Math.round(calculatedAvgCadence / 2),
      avgPower
    });

    encoder.onMesg(Profile.MesgNum.ACTIVITY, {
      timestamp: sessionEnd,
      totalTimerTime: totalDurationSec,
      numSessions: 1,
      type: "manual"
    });

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const timestamp = new Date(startDate.getTime() + s.timeSec * 1000);

      encoder.onMesg(Profile.MesgNum.RECORD, {
        timestamp,
        positionLat: toSemicircles(s.lat),
        positionLong: toSemicircles(s.lng),
        distance: s.distance,
        speed: s.speed,
        heartRate: s.heartRate,
        cadence: Math.round(s.cadence / 2),
        runningCadence: s.cadence,
        power: s.power,
        enhancedSpeed: s.speed,
        stanceTime: s.groundTime,
        stanceTimePercent: clamp((s.groundTime / (s.groundTime + s.flightTime)) * 100, 40, 70),
        verticalOscillation: s.verticalOscillation,
        stepLength: (s.speed * 1000) / (s.cadence / 60) / 100
      });
    }

    const uint8Array = encoder.close();
    const buffer = Buffer.from(uint8Array);

    res.setHeader("Content-Type", "application/vnd.ant.fit");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=run_${variant}.fit`
    );
    return res.send(buffer);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "生成 FIT 文件失败" });
  }
});

// ==================== 服务器启动模块 ====================
// 功能：启动Express服务器并监听指定端口

const server = app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

server.on("error", (err) => {
  console.error("Server listen error:", err);
});
