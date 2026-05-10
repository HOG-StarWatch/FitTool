/**
 * 地图坐标系转换工具
 * 支持 WGS84、GCJ02(火星坐标)、BD09(百度坐标) 之间的相互转换
 */

export type CoordinateSystem = 'wgs84' | 'gcj02' | 'bd09';

export interface Point {
  lng: number;
  lat: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * 坐标转换核心类
 */
export class CoordTransform {
  private static readonly PI = 3.1415926535897932384626;
  private static readonly a = 6378245.0;
  private static readonly ee = 0.00669342162296594323;
  private static readonly x_PI = (3.14159265358979324 * 3000.0) / 180.0;

  /**
   * 判断坐标是否在中国境外（无需偏移）
   */
  static isOutOfChina(lng: number, lat: number): boolean {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
  }

  /**
   * WGS84 转 GCJ02 (火星坐标系)
   */
  static WGS84_TO_GCJ02(lng: number, lat: number): [number, number] {
    if (this.isOutOfChina(lng, lat)) {
      return [lng, lat];
    }

    let dlat = this.transformLat(lng - 105.0, lat - 35.0);
    let dlng = this.transformLng(lng - 105.0, lat - 35.0);
    const radlat = (lat / 180.0) * this.PI;
    let magic = Math.sin(radlat);
    magic = 1 - this.ee * magic * magic;
    const sqrtmagic = Math.sqrt(magic);
    dlat =
      (dlat * 180.0) /
      (((this.a * (1 - this.ee)) / (magic * sqrtmagic)) * this.PI);
    dlng = (dlng * 180.0) / ((this.a / sqrtmagic) * Math.cos(radlat) * this.PI);

    return [lng + dlng, lat + dlat];
  }

  /**
   * GCJ02 转 WGS84
   */
  static GCJ02_TO_WGS84(lng: number, lat: number): [number, number] {
    if (this.isOutOfChina(lng, lat)) {
      return [lng, lat];
    }

    let dlat = this.transformLat(lng - 105.0, lat - 35.0);
    let dlng = this.transformLng(lng - 105.0, lat - 35.0);
    const radlat = (lat / 180.0) * this.PI;
    let magic = Math.sin(radlat);
    magic = 1 - this.ee * magic * magic;
    const sqrtmagic = Math.sqrt(magic);
    dlat =
      (dlat * 180.0) /
      (((this.a * (1 - this.ee)) / (magic * sqrtmagic)) * this.PI);
    dlng = (dlng * 180.0) / ((this.a / sqrtmagic) * Math.cos(radlat) * this.PI);

    return [lng - dlng, lat - dlat];
  }

  /**
   * GCJ02 转 BD09 (百度坐标系)
   */
  static GCJ02_TO_BD09(lng: number, lat: number): [number, number] {
    const z =
      Math.sqrt(lng * lng + lat * lat) +
      0.00002 * Math.sin(lat * this.x_PI);
    const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * this.x_PI);
    return [z * Math.cos(theta) + 0.0065, z * Math.sin(theta) + 0.006];
  }

  /**
   * BD09 转 GCJ02
   */
  static BD09_TO_GCJ02(lng: number, lat: number): [number, number] {
    const x = lng - 0.0065;
    const y = lat - 0.006;
    const z =
      Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * this.x_PI);
    const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * this.x_PI);
    return [z * Math.cos(theta), z * Math.sin(theta)];
  }

  /**
   * WGS84 转 BD09
   */
  static WGS84_TO_BD09(lng: number, lat: number): [number, number] {
    const [gcjLng, gcjLat] = this.WGS84_TO_GCJ02(lng, lat);
    return this.GCJ02_TO_BD09(gcjLng, gcjLat);
  }

  /**
   * BD09 转 WGS84
   */
  static BD09_TO_WGS84(lng: number, lat: number): [number, number] {
    const [gcjLng, gcjLat] = this.BD09_TO_GCJ02(lng, lat);
    return this.GCJ02_TO_WGS84(gcjLng, gcjLat);
  }

  private static transformLat(x: number, y: number): number {
    let ret =
      -100.0 +
      2.0 * x +
      3.0 * y +
      0.2 * y * y +
      0.1 * x * y +
      0.2 * Math.sqrt(Math.abs(x));
    ret +=
      ((20.0 * Math.sin(6.0 * x * this.PI) + 20.0 * Math.sin(2.0 * x * this.PI)) *
        2.0) /
      3.0;
    ret +=
      ((20.0 * Math.sin(y * this.PI) + 40.0 * Math.sin((y / 3.0) * this.PI)) *
        2.0) /
      3.0;
    ret +=
      ((160.0 * Math.sin((y / 12.0) * this.PI) +
        320 * Math.sin((y * this.PI) / 30.0)) *
        2.0) /
      3.0;
    return ret;
  }

  private static transformLng(x: number, y: number): number {
    let ret =
      300.0 +
      x +
      2.0 * y +
      0.1 * x * x +
      0.1 * x * y +
      0.1 * Math.sqrt(Math.abs(x));
    ret +=
      ((20.0 * Math.sin(6.0 * x * this.PI) + 20.0 * Math.sin(2.0 * x * this.PI)) *
        2.0) /
      3.0;
    ret +=
      ((20.0 * Math.sin(x * this.PI) + 40.0 * Math.sin((x / 3.0) * this.PI)) *
        2.0) /
      3.0;
    ret +=
      ((150.0 * Math.sin((x / 12.0) * this.PI) +
        300.0 * Math.sin((x / 30.0) * this.PI)) *
        2.0) /
      3.0;
    return ret;
  }
}

/**
 * 地图源配置
 */
export const MAP_SOURCE_CONFIG: Record<CoordinateSystem, string[]> = {
  wgs84: [
    'osm',
    'osmde',
    'osmfr',
    'osm_cn',
    'cyclOSM',
    'wikimedia',
    'arcgis_street',
    'arcgis_satellite',
    'esri_satellite',
    'cartodb',
    'cartodb_dark',
    'stamen_water',
    'stamen_terrain',
  ],
  gcj02: [
    'gaode_vec',
    'gaode_img',
    'gaode_rel',
    'tencent_vec',
    'tencent_sat',
    'tianditu_vec',
    'tianditu_cva',
    'tianditu_img',
  ],
  bd09: ['baidu_vec', 'baidu_img'],
};

/**
 * 获取地图源对应的坐标系
 */
export function getMapCoordSys(sourceType: string): CoordinateSystem {
  for (const [sys, sources] of Object.entries(MAP_SOURCE_CONFIG)) {
    if (sources.includes(sourceType)) {
      return sys as CoordinateSystem;
    }
  }
  return 'wgs84';
}

/**
 * 坐标管理器 - 处理当前地图坐标系与 WGS84 之间的转换
 */
export class CoordManager {
  private currentCoordSys: CoordinateSystem = 'wgs84';

  setCoordSys(sys: CoordinateSystem): void {
    this.currentCoordSys = sys;
  }

  getCoordSys(): CoordinateSystem {
    return this.currentCoordSys;
  }

  /**
   * 将当前地图坐标系的坐标转换为 WGS84
   */
  toWGS84(lng: number, lat: number): [number, number] {
    switch (this.currentCoordSys) {
      case 'gcj02':
        return CoordTransform.GCJ02_TO_WGS84(lng, lat);
      case 'bd09':
        return CoordTransform.BD09_TO_WGS84(lng, lat);
      case 'wgs84':
      default:
        return [lng, lat];
    }
  }

  /**
   * 将 WGS84 坐标转换为当前地图坐标系
   */
  fromWGS84(lng: number, lat: number): [number, number] {
    switch (this.currentCoordSys) {
      case 'gcj02':
        return CoordTransform.WGS84_TO_GCJ02(lng, lat);
      case 'bd09':
        return CoordTransform.WGS84_TO_BD09(lng, lat);
      case 'wgs84':
      default:
        return [lng, lat];
    }
  }

  /**
   * 将当前地图坐标系的坐标点转换为 WGS84 点对象
   */
  toWGS84Point(lng: number, lat: number): Point {
    const [newLng, newLat] = this.toWGS84(lng, lat);
    return { lng: newLng, lat: newLat };
  }

  /**
   * 将 WGS84 点对象转换为当前地图坐标系点对象
   */
  fromWGS84Point(lng: number, lat: number): Point {
    const [newLng, newLat] = this.fromWGS84(lng, lat);
    return { lng: newLng, lat: newLat };
  }

  /**
   * 将点数组从当前地图坐标系转换为 WGS84
   */
  toWGS84Array(points: Point[]): Point[] {
    return points.map((p) => this.toWGS84Point(p.lng, p.lat));
  }

  /**
   * 将点数组从 WGS84 转换为当前地图坐标系
   */
  fromWGS84Array(points: Point[]): Point[] {
    return points.map((p) => this.fromWGS84Point(p.lng, p.lat));
  }

  /**
   * 解析地图点击事件的坐标（Leaflet返回的是 {lat, lng}）
   */
  parseMapClick(lat: number, lng: number): Point {
    return this.toWGS84Point(lng, lat);
  }

  /**
   * 将 WGS84 点转换为地图显示格式 [lat, lng]（Leaflet格式）
   */
  toMapDisplay(wgs84Point: Point): [number, number] {
    const converted = this.fromWGS84Point(wgs84Point.lng, wgs84Point.lat);
    return [converted.lat, converted.lng];
  }

  /**
   * 将 WGS84 点数组转换为地图显示格式 [[lat, lng], ...]
   */
  toMapDisplayArray(wgs84Points: Point[]): [number, number][] {
    return wgs84Points.map((p) => this.toMapDisplay(p));
  }
}

// 导出单例实例
export const coordManager = new CoordManager();
