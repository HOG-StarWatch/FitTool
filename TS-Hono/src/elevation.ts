import type { RoutePoint, RequestBody } from './lib';

export const ELEVATION_SOURCE_NAMES: Record<string, string> = {
  'open-elevation': 'Open-Elevation',
  opentopodata: 'OpenTopoData SRTM90',
  'opentopodata-srtm30m': 'OpenTopoData SRTM30',
  'opentopodata-aster30m': 'OpenTopoData ASTER30',
  'opentopodata-eudem25m': 'OpenTopoData EUDEM25',
  'open-meteo': 'Open-Meteo',
};

export const DEFAULT_ELEVATION_SOURCE = 'open-elevation';

export function normalizeElevationSource(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : DEFAULT_ELEVATION_SOURCE;
}

export function elevationSourceName(source: string): string {
  return ELEVATION_SOURCE_NAMES[source] || source;
}

export interface AltitudeFlags {
  /** 海拔是否实际被使用（baseAltitudes 存在且至少一个点有效） */
  used: boolean;
  /** 是否部分点为 null（已被回退模拟） */
  partial: boolean;
  /** 解析后的 base 点海拔（含 null），null 表示完全未传/无效 */
  baseAltitudes: Array<number | null> | null;
  /** 有效海拔点数（用于文案展示） */
  validCount: number;
}

export function deriveAltitudeFlags(
  altitudes: Array<number | null> | null | undefined,
  pointCount: number
): AltitudeFlags {
  const base = resolveBaseAltitudes(altitudes, pointCount);
  if (!base) return { used: false, partial: false, baseAltitudes: null, validCount: 0 };
  const validCount = base.filter((v) => v != null && Number.isFinite(v as number)).length;
  return {
    used: validCount > 0,
    partial: validCount < base.length,
    baseAltitudes: base,
    validCount,
  };
}

/** 海拔数组必须与前端点数逐一对应：服务端不补点，长度不一致即视为无效 */
function resolveBaseAltitudes(
  altitudes: Array<number | null> | null | undefined,
  pointCount: number
): Array<number | null> | null {
  if (!Array.isArray(altitudes) || altitudes.length !== pointCount) return null;
  for (const v of altitudes) {
    // null 表示该点由 computeSamples 回退模拟海拔
    if (v != null && (typeof v !== 'number' || !Number.isFinite(v))) return null;
  }
  return altitudes;
}

const EARTH_RADIUS_M = 6371000;
const METERS_PER_DEG_LAT = 111320;

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function offsetPointMeters(point: RoutePoint, offsetLatMeters: number, offsetLonMeters: number): RoutePoint {
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.max(0.01, Math.cos((point.lat * Math.PI) / 180));
  return {
    lat: point.lat + offsetLatMeters / METERS_PER_DEG_LAT,
    lng: point.lng + offsetLonMeters / metersPerDegLon,
  };
}

/** 首尾点完全重合即视为环线（是否闭合由前端决定，服务端不补点） */
export function isClosedRoute(points: RoutePoint[]): boolean {
  if (points.length < 2) return false;
  const first = points[0];
  const last = points[points.length - 1];
  return last.lat === first.lat && last.lng === first.lng;
}

/** 高程摘要信息（用于 X-Elevation-* 头与前端提示文案） */
export function buildElevationInfo(
  body: Pick<RequestBody, 'elevationSource'> | null | undefined,
  flags: AltitudeFlags
): { source: string; status: string; message: string } {
  const source = normalizeElevationSource(body?.elevationSource);
  const name = elevationSourceName(source);

  if (source === 'none') return { source, status: 'none', message: '不写入海拔（FIT 海拔字段留空）' };
  if (source === 'off') return { source, status: 'off', message: '模拟海拔（离线生成）' };
  if (flags.used) {
    if (flags.partial) {
      return { source, status: 'partial', message: `已获取部分真实海拔（${name}），其余采样点已回退模拟海拔` };
    }
    return { source, status: 'live', message: `已获取真实海拔（${name}，${flags.validCount} 个采样点）` };
  }
  return { source, status: 'fallback', message: `客户端未提供有效真实海拔（${name}），已回退模拟海拔` };
}
