import { Hono } from 'hono';
import { cors } from 'hono/cors';

interface FitFileOptions {
  type?: string;
  manufacturer?: string;
  product?: number;
  serialNumber?: number;
  timeCreated?: Date;
  sport?: string;
  subSport?: string;
}

interface RecordData {
  timestamp: Date;
  positionLat?: number;
  positionLong?: number;
  distance?: number;
  speed?: number;
  heartRate?: number;
  cadence?: number;
  power?: number;
  enhancedSpeed?: number;
  stanceTime?: number;
  stanceTimePercent?: number;
  verticalOscillation?: number;
  stepLength?: number;
}

interface SessionData {
  timestamp: Date;
  startTime: Date;
  totalElapsedTime: number;
  totalTimerTime: number;
  totalDistance: number;
  totalCalories: number;
  sport: string;
  subSport: string;
  avgSpeed: number;
  avgHeartRate: number;
  maxHeartRate: number;
  avgCadence: number;
  avgPower: number;
}

interface LapData {
  timestamp: Date;
  startTime: Date;
  totalElapsedTime: number;
  totalTimerTime: number;
  totalDistance: number;
  totalCalories: number;
  sport: string;
  subSport: string;
  avgSpeed: number;
  avgHeartRate: number;
  maxHeartRate: number;
  avgCadence: number;
  avgPower: number;
}

interface ActivityData {
  timestamp: Date;
  totalTimerTime: number;
  numSessions: number;
  type: string;
}

const FIT_TYPES: Record<string, { baseType: number; size: number }> = {
  enum: { baseType: 0x00, size: 1 },
  sint8: { baseType: 0x01, size: 1 },
  uint8: { baseType: 0x02, size: 1 },
  sint16: { baseType: 0x83, size: 2 },
  uint16: { baseType: 0x84, size: 2 },
  sint32: { baseType: 0x85, size: 4 },
  uint32: { baseType: 0x86, size: 4 },
  float32: { baseType: 0x89, size: 4 },
  float64: { baseType: 0x90, size: 8 },
  uint8z: { baseType: 0x0A, size: 1 },
  uint16z: { baseType: 0x8B, size: 2 },
  uint32z: { baseType: 0x8C, size: 4 },
  byte: { baseType: 0x0D, size: 1 },
  sint64: { baseType: 0x8F, size: 8 },
  uint64: { baseType: 0x90, size: 8 },
  uint64z: { baseType: 0x91, size: 8 },
};

const MESG_NUM: Record<string, number> = {
  file_id: 0,
  file_creator: 1,
  event: 21,
  record: 20,
  session: 18,
  lap: 19,
  activity: 34,
  device_info: 23,
};

const SPORT_MAP: Record<string, number> = {
  running: 1,
  cycling: 2,
  transition: 3,
  swimming: 5,
  basketball: 9,
  soccer: 10,
  tennis: 12,
  hiking: 15,
  dancing: 19,
  snowboarding: 22,
  climbing: 28,
  rowing: 24,
  kayaking: 21,
  gymnastics: 31,
};

interface FieldDef {
  size: number;
  baseType: number;
}

const TIMESTAMP_FIELD: FieldDef = { size: 4, baseType: FIT_TYPES.uint32.baseType };

const FIELD_REGISTRY: Record<string, Record<number, FieldDef>> = {
  file_id: {
    0: { size: 1, baseType: FIT_TYPES.enum.baseType },
    1: { size: 2, baseType: FIT_TYPES.uint16.baseType },
    2: { size: 2, baseType: FIT_TYPES.uint16.baseType },
    3: { size: 4, baseType: FIT_TYPES.uint32z.baseType },
    4: { size: 4, baseType: FIT_TYPES.uint32.baseType },
    5: { size: 1, baseType: FIT_TYPES.enum.baseType },
  },
  device_info: {
    2: { size: 2, baseType: FIT_TYPES.uint16.baseType },
    3: { size: 4, baseType: FIT_TYPES.uint32z.baseType },
    4: { size: 2, baseType: FIT_TYPES.uint16.baseType },
    253: { size: 4, baseType: FIT_TYPES.uint32.baseType },
  },
  session: {
    2: { size: 4, baseType: FIT_TYPES.uint32.baseType },
    5: { size: 1, baseType: FIT_TYPES.enum.baseType },
    6: { size: 1, baseType: FIT_TYPES.enum.baseType },
    7: { size: 4, baseType: FIT_TYPES.uint32.baseType },
    8: { size: 4, baseType: FIT_TYPES.uint32.baseType },
    9: { size: 4, baseType: FIT_TYPES.uint32.baseType },
    11: { size: 2, baseType: FIT_TYPES.uint16.baseType },
    14: { size: 2, baseType: FIT_TYPES.uint16.baseType },
    16: { size: 1, baseType: FIT_TYPES.uint8.baseType },
    17: { size: 1, baseType: FIT_TYPES.uint8.baseType },
    18: { size: 1, baseType: FIT_TYPES.uint8.baseType },
    20: { size: 2, baseType: FIT_TYPES.uint16.baseType },
  },
  lap: {
    2: { size: 4, baseType: FIT_TYPES.uint32.baseType },
    7: { size: 4, baseType: FIT_TYPES.uint32.baseType },
    8: { size: 4, baseType: FIT_TYPES.uint32.baseType },
    9: { size: 4, baseType: FIT_TYPES.uint32.baseType },
    11: { size: 2, baseType: FIT_TYPES.uint16.baseType },
    13: { size: 2, baseType: FIT_TYPES.uint16.baseType },
    15: { size: 1, baseType: FIT_TYPES.uint8.baseType },
    16: { size: 1, baseType: FIT_TYPES.uint8.baseType },
    17: { size: 1, baseType: FIT_TYPES.uint8.baseType },
    19: { size: 2, baseType: FIT_TYPES.uint16.baseType },
    25: { size: 1, baseType: FIT_TYPES.enum.baseType },
    39: { size: 1, baseType: FIT_TYPES.enum.baseType },
  },
  activity: {
    0: { size: 4, baseType: FIT_TYPES.uint32.baseType },
    1: { size: 2, baseType: FIT_TYPES.uint16.baseType },
    2: { size: 1, baseType: FIT_TYPES.enum.baseType },
  },
  record: {
    0: { size: 4, baseType: FIT_TYPES.sint32.baseType },
    1: { size: 4, baseType: FIT_TYPES.sint32.baseType },
    3: { size: 1, baseType: FIT_TYPES.uint8.baseType },
    4: { size: 1, baseType: FIT_TYPES.uint8.baseType },
    5: { size: 4, baseType: FIT_TYPES.uint32.baseType },
    6: { size: 2, baseType: FIT_TYPES.uint16.baseType },
    7: { size: 2, baseType: FIT_TYPES.uint16.baseType },
    39: { size: 2, baseType: FIT_TYPES.uint16.baseType },
    40: { size: 2, baseType: FIT_TYPES.uint16.baseType },
    41: { size: 2, baseType: FIT_TYPES.uint16.baseType },
    73: { size: 4, baseType: FIT_TYPES.uint32.baseType },
    85: { size: 2, baseType: FIT_TYPES.uint16.baseType },
  },
};

function toSemicircles(deg: number): number {
  return Math.round((deg * 2147483648) / 180);
}

function crc16(data: Uint8Array): number {
  const crcTable = [
    0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401,
    0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
  ];
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    let tmp = crcTable[crc & 0x0f];
    crc = ((crc >> 4) & 0x0fff) ^ tmp ^ crcTable[data[i] & 0x0f];
    tmp = crcTable[crc & 0x0f];
    crc = ((crc >> 4) & 0x0fff) ^ tmp ^ crcTable[(data[i] >> 4) & 0x0f];
  }
  return crc & 0xffff;
}

class FitEncoder {
  private buffers: Uint8Array[] = [];
  private definitionMessages: Map<number, Uint8Array> = new Map();
  private localMesgNum = 0;
  private localMesgNumMap: Map<number, number> = new Map();
  private options: Required<FitFileOptions>;

  constructor(options: FitFileOptions = {}) {
    this.options = {
      type: options.type || 'activity',
      manufacturer: options.manufacturer || 'development',
      product: options.product || 1,
      serialNumber: options.serialNumber || 1,
      timeCreated: options.timeCreated || new Date(),
      sport: options.sport || 'running',
      subSport: options.subSport || 'generic',
    };
  }

  writeFileIdMessage(): void {
    const fields: Array<{ num: number; value: number }> = [
      { num: 0, value: 1 },
      { num: 1, value: this.options.manufacturer === 'development' ? 1 : this.getManufacturerId() },
      { num: 2, value: this.options.product },
      { num: 3, value: this.options.serialNumber === 1 ? 0xffffffff : this.options.serialNumber },
      { num: 4, value: this.getDateValue(this.options.timeCreated) },
      { num: 5, value: this.options.type === 'activity' ? 4 : 0 },
    ];
    this.writeDefinitionMessage(MESG_NUM['file_id'], 'file_id', fields, true);
  }

  writeDeviceInfoMessage(timestamp: Date): void {
    const fields: Array<{ num: number; value: number }> = [
      { num: 253, value: this.getDateValue(timestamp) },
      { num: 2, value: this.options.manufacturer === 'development' ? 1 : this.getManufacturerId() },
      { num: 3, value: this.options.serialNumber === 1 ? 0xffffffff : this.options.serialNumber },
      { num: 4, value: this.options.product },
    ];
    this.writeDefinitionMessage(MESG_NUM['device_info'], 'device_info', fields, true);
    this.writeDataMessage(MESG_NUM['device_info'], fields);
  }

  writeSessionMessage(data: SessionData): void {
    const fields: Array<{ num: number; value: number }> = [
      { num: 253, value: this.getDateValue(data.timestamp) },
      { num: 2, value: this.getDateValue(data.startTime) },
      { num: 5, value: SPORT_MAP[data.sport] || 1 },
      { num: 6, value: data.subSport === 'generic' ? 0 : SPORT_MAP[data.subSport] || 0 },
      { num: 7, value: Math.round(data.totalElapsedTime * 1000) },
      { num: 8, value: Math.round(data.totalTimerTime * 1000) },
      { num: 9, value: Math.round(data.totalDistance * 100) },
      { num: 11, value: data.totalCalories },
      { num: 14, value: Math.round(data.avgSpeed * 1000) },
      { num: 16, value: Math.round(data.avgHeartRate) },
      { num: 17, value: Math.round(data.maxHeartRate) },
      { num: 18, value: Math.round(data.avgCadence) },
      { num: 20, value: Math.round(data.avgPower) },
    ];
    this.writeDefinitionMessage(MESG_NUM['session'], 'session', fields, true);
    this.writeDataMessage(MESG_NUM['session'], fields);
  }

  writeLapMessage(data: LapData): void {
    const fields: Array<{ num: number; value: number }> = [
      { num: 253, value: this.getDateValue(data.timestamp) },
      { num: 2, value: this.getDateValue(data.startTime) },
      { num: 7, value: Math.round(data.totalElapsedTime * 1000) },
      { num: 8, value: Math.round(data.totalTimerTime * 1000) },
      { num: 9, value: Math.round(data.totalDistance * 100) },
      { num: 11, value: data.totalCalories },
      { num: 13, value: Math.round(data.avgSpeed * 1000) },
      { num: 15, value: Math.round(data.avgHeartRate) },
      { num: 16, value: Math.round(data.maxHeartRate) },
      { num: 17, value: Math.round(data.avgCadence) },
      { num: 19, value: Math.round(data.avgPower) },
      { num: 25, value: SPORT_MAP[data.sport] || 1 },
      { num: 39, value: data.subSport === 'generic' ? 0 : SPORT_MAP[data.subSport] || 0 },
    ];
    this.writeDefinitionMessage(MESG_NUM['lap'], 'lap', fields, true);
    this.writeDataMessage(MESG_NUM['lap'], fields);
  }

  writeActivityMessage(data: ActivityData): void {
    const fields: Array<{ num: number; value: number }> = [
      { num: 253, value: this.getDateValue(data.timestamp) },
      { num: 0, value: Math.round(data.totalTimerTime * 1000) },
      { num: 1, value: data.numSessions },
      { num: 2, value: data.type === 'manual' ? 0 : 2 },
    ];
    this.writeDefinitionMessage(MESG_NUM['activity'], 'activity', fields, true);
    this.writeDataMessage(MESG_NUM['activity'], fields);
  }

  writeRecordMessage(data: RecordData): void {
    const fields: Array<{ num: number; value: number }> = [
      { num: 253, value: this.getDateValue(data.timestamp) },
    ];
    if (data.positionLat !== undefined) fields.push({ num: 0, value: data.positionLat });
    if (data.positionLong !== undefined) fields.push({ num: 1, value: data.positionLong });
    if (data.distance !== undefined) fields.push({ num: 5, value: Math.round(data.distance * 100) });
    if (data.speed !== undefined) fields.push({ num: 6, value: Math.round(data.speed * 1000) });
    if (data.heartRate !== undefined) fields.push({ num: 3, value: Math.round(data.heartRate) });
    if (data.cadence !== undefined) fields.push({ num: 4, value: Math.round(data.cadence) });
    if (data.power !== undefined) fields.push({ num: 7, value: Math.round(data.power) });
    if (data.enhancedSpeed !== undefined) fields.push({ num: 73, value: Math.round(data.enhancedSpeed * 1000) });
    if (data.stanceTime !== undefined) fields.push({ num: 41, value: Math.round(data.stanceTime * 10) });
    if (data.stanceTimePercent !== undefined) fields.push({ num: 40, value: Math.round(data.stanceTimePercent * 100) });
    if (data.verticalOscillation !== undefined) fields.push({ num: 39, value: Math.round(data.verticalOscillation * 10) });
    if (data.stepLength !== undefined) fields.push({ num: 85, value: Math.round(data.stepLength * 1000) });

    const mesgNum = MESG_NUM['record'];
    if (!this.definitionMessages.has(mesgNum)) {
      this.writeDefinitionMessage(mesgNum, 'record', fields, false);
    }
    this.writeDataMessage(mesgNum, fields);
  }

  private writeDefinitionMessage(globalMesgNum: number, mesgName: string, fields: Array<{ num: number; value: number }>, isGlobal: boolean): void {
    if (!this.localMesgNumMap.has(globalMesgNum)) {
      const num = this.localMesgNum++;
      if (num > 15) throw new Error(`Too many message types defined (local message number overflow at ${num})`);
      this.localMesgNumMap.set(globalMesgNum, num);
    }
    const localNum = this.localMesgNumMap.get(globalMesgNum)!;
    const registry = FIELD_REGISTRY[mesgName] || {};
    const fieldDefSize = 3;
    const totalSize = 1 + 1 + 1 + 2 + 1 + fields.length * fieldDefSize;
    const buffer = new Uint8Array(totalSize);
    const view = new DataView(buffer.buffer);

    let offset = 0;
    buffer[offset++] = 0x40 | (localNum & 0x0f);
    buffer[offset++] = 0x00;
    buffer[offset++] = 0x00;
    view.setUint16(offset, globalMesgNum, true);
    offset += 2;
    buffer[offset++] = fields.length;

    for (const field of fields) {
      buffer[offset++] = field.num;
      let size: number;
      let baseType: number;
      if (field.num === 253) {
        size = TIMESTAMP_FIELD.size;
        baseType = TIMESTAMP_FIELD.baseType;
      } else {
        const def = registry[field.num];
        if (def) {
          size = def.size;
          baseType = def.baseType;
        } else {
          size = 1;
          baseType = FIT_TYPES.uint8.baseType;
        }
      }
      buffer[offset++] = size;
      buffer[offset++] = baseType;
    }

    this.buffers.push(buffer);
    this.definitionMessages.set(globalMesgNum, buffer);
  }

  private writeDataMessage(globalMesgNum: number, fields: Array<{ num: number; value: number }>): void {
    const localNum = this.localMesgNumMap.get(globalMesgNum);
    if (localNum === undefined) return;
    const defBuffer = this.definitionMessages.get(globalMesgNum);
    if (!defBuffer) return;

    let defOffset = 5;
    const numFields = defBuffer[defOffset++];
    let dataSize = 0;
    const fieldDefs: Array<{ num: number; size: number; baseType: number }> = [];
    for (let i = 0; i < numFields; i++) {
      const fieldNum = defBuffer[defOffset++];
      const fieldSize = defBuffer[defOffset++];
      const baseType = defBuffer[defOffset++];
      fieldDefs.push({ num: fieldNum, size: fieldSize, baseType });
      dataSize += fieldSize;
    }

    const buffer = new Uint8Array(1 + dataSize);
    const view = new DataView(buffer.buffer);
    buffer[0] = 0x00 | (localNum & 0x0f);
    let dataOffset = 1;

    for (const fieldDef of fieldDefs) {
      const fieldData = fields.find(f => f.num === fieldDef.num);
      if (!fieldData) {
        this.writeInvalidValue(view, buffer, dataOffset, fieldDef.size);
        dataOffset += fieldDef.size;
        continue;
      }
      this.writeValue(view, buffer, dataOffset, fieldDef.size, fieldDef.baseType, fieldData.value);
      dataOffset += fieldDef.size;
    }

    this.buffers.push(buffer);
  }

  private writeValue(view: DataView, buffer: Uint8Array, offset: number, size: number, baseType: number, value: number): void {
    if (size === 4) {
      if (baseType === FIT_TYPES.sint32.baseType) {
        view.setInt32(offset, value, true);
      } else {
        view.setUint32(offset, value >>> 0, true);
      }
    } else if (size === 2) {
      view.setUint16(offset, value & 0xffff, true);
    } else {
      buffer[offset] = value & 0xff;
    }
  }

  private writeInvalidValue(view: DataView, buffer: Uint8Array, offset: number, size: number): void {
    if (size === 4) {
      view.setUint32(offset, 0xffffffff, true);
    } else if (size === 2) {
      view.setUint16(offset, 0xffff, true);
    } else {
      buffer[offset] = 0xff;
    }
  }

  private getManufacturerId(): number {
    const mfgName = this.options.manufacturer.toLowerCase();
    if (mfgName.includes('garmin')) return 1;
    if (mfgName.includes('suunto')) return 34;
    if (mfgName.includes('polar')) return 77;
    if (mfgName.includes('wahoo')) return 88;
    return 255;
  }

  private getDateValue(date: Date): number {
    const fitEpoch = new Date('1989-12-31T00:00:00Z').getTime();
    return Math.floor((date.getTime() - fitEpoch) / 1000);
  }

  close(): Uint8Array {
    const dataSize = this.buffers.reduce((sum, b) => sum + b.length, 0);
    const headerSize = 14;
    const crcSize = 2;
    const fileSize = headerSize + dataSize + crcSize;
    const fileBuffer = new Uint8Array(fileSize);
    const view = new DataView(fileBuffer.buffer);

    fileBuffer[0] = headerSize;
    fileBuffer[1] = 0x10;
    view.setUint16(2, 0x0865, true);
    view.setUint32(4, dataSize, true);
    fileBuffer[8] = 0x2e;
    fileBuffer[9] = 0x46;
    fileBuffer[10] = 0x49;
    fileBuffer[11] = 0x54;
    view.setUint16(12, crc16(fileBuffer.subarray(0, 12)), true);

    let offset = 14;
    for (const buffer of this.buffers) {
      fileBuffer.set(buffer, offset);
      offset += buffer.length;
    }

    const dataForCrc = fileBuffer.subarray(0, fileSize - 2);
    view.setUint16(fileSize - 2, crc16(dataForCrc), true);
    return fileBuffer;
  }
}

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
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
): { samples: SampleData[]; totalDurationSec: number } {
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
    if (i > 0) t += segDurationsRaw[i - 1] * scale;
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
  const { startTime, points, paceSecondsPerKm, hrRest, hrMax, lapCount, variantIndex, weightKg, powerFactor, gpsDrift, avgCadence } = body || {};

  if (!startTime || !points || !Array.isArray(points) || points.length < 2) {
    return { error: '缺少参数：需要 startTime、至少两个轨迹点 points' };
  }

  if (points.length > MAX_POINTS) {
    return { error: `轨迹点数量超过上限 (${MAX_POINTS})` };
  }

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number' || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
      return { error: `第 ${i + 1} 个轨迹点坐标无效（纬度 -90~90，经度 -180~180）` };
    }
  }

  const startDate = new Date(startTime);
  if (Number.isNaN(startDate.getTime())) {
    return { error: 'startTime 格式不正确' };
  }

  const weight = (Number.isFinite(Number(weightKg)) && weightKg! > MIN_WEIGHT_KG && weightKg! < MAX_WEIGHT_KG) ? Number(weightKg) : DEFAULT_WEIGHT_KG;
  const power = (Number.isFinite(Number(powerFactor)) && (powerFactor ?? 0) > 0) ? Number(powerFactor) : DEFAULT_POWER_FACTOR;
  const drift = Number.isFinite(Number(gpsDrift)) ? Number(gpsDrift) : 0;
  const targetAvgCadence = Number.isFinite(Number(avgCadence)) ? Number(avgCadence) : DEFAULT_AVG_CADENCE;
  const pace = (Number(paceSecondsPerKm) > 0 && Number(paceSecondsPerKm) < 2000) ? Number(paceSecondsPerKm) : DEFAULT_PACE_SEC_PER_KM;
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
  const { samples, totalDurationSec } = computeSamples(allPoints, distances, totalDist, pace, hrRestVal, hrMaxVal, targetAvgCadence, weight, power);

  return {
    startDate, totalDist, pace, hrRestVal, hrMaxVal,
    targetAvgCadence, weight, power, calories, laps, variant, samples, totalDurationSec,
  };
}

function generateFitFile(result: ProcessedRoute): Response {
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
  const encoder = new FitEncoder({ type: 'activity', manufacturer: 'development', product: 1, serialNumber: 1, timeCreated: startDate, sport: 'running', subSport: 'generic' });

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
  return new Response(uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength) as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.ant.fit',
      'Content-Disposition': `attachment; filename=run_${variant}.fit`,
    },
  });
}

type Bindings = {
  ALLOWED_ORIGINS?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', async (c, next) => {
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
    version: '1.6.0',
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

export const onRequestPost = async (context: { request: Request; params: Record<string, string | string[]>; env: Bindings; waitUntil: (promise: Promise<void>) => void; passThroughOnException: () => void; functionPath: string }) => {
  const catchall = context.params.catchall;
  const path = '/' + (Array.isArray(catchall) ? catchall.join('/') : catchall);
  const env = context.env as Bindings;
  
  return app.fetch(context.request, {
    env: { ALLOWED_ORIGINS: env.ALLOWED_ORIGINS },
    waitUntil: context.waitUntil,
    passThroughOnException: context.passThroughOnException,
  }, path);
};

export const onRequestGet = async (context: { request: Request; params: Record<string, string | string[]>; env: Bindings; waitUntil: (promise: Promise<void>) => void; passThroughOnException: () => void; functionPath: string }) => {
  const catchall = context.params.catchall;
  const path = '/' + (Array.isArray(catchall) ? catchall.join('/') : catchall);
  const env = context.env as Bindings;
  
  return app.fetch(context.request, {
    env: { ALLOWED_ORIGINS: env.ALLOWED_ORIGINS },
    waitUntil: context.waitUntil,
    passThroughOnException: context.passThroughOnException,
  }, path);
};
