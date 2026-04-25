// ==================== 地理位置搜索模块 ====================

// ==================== 卡片折叠模块 ====================

function toggleCard(header) {
  const card = header.closest('.card');
  const body = card.querySelector('.card-body');
  const icon = header.querySelector('.collapse-icon');
  
  if (card.classList.contains('collapsed')) {
    card.classList.remove('collapsed');
    body.style.display = 'block';
    icon.textContent = '▼';
  } else {
    card.classList.add('collapsed');
    body.style.display = 'none';
    icon.textContent = '▶';
  }
}

// ==================== 暗夜模式模块 ====================

function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const themeToggle = document.getElementById('themeToggle');
  
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add('dark');
    if (themeToggle) themeToggle.textContent = '☀️';
  } else {
    document.body.classList.remove('dark');
    if (themeToggle) themeToggle.textContent = '🌙';
  }
  
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      themeToggle.textContent = isDark ? '☀️' : '🌙';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
});

let searchMarker = null;

async function searchLocation() {
  const input = document.getElementById('searchInput');
  const resultDiv = document.getElementById('searchResult');
  const query = input.value.trim();
  
  if (!query) {
    resultDiv.innerHTML = '<span style="color: #ef4444;">请输入搜索内容</span>';
    return;
  }
  
  resultDiv.innerHTML = '<span style="color: #3b82f6;">搜索中...</span>';
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=zh-CN`
    );
    
    if (!response.ok) throw new Error('搜索失败');
    const results = await response.json();
    
    if (results.length === 0) {
      resultDiv.innerHTML = '<span style="color: #ef4444;">未找到相关位置</span>';
      return;
    }
    
    const location = results[0];
    const lat = parseFloat(location.lat);
    const lon = parseFloat(location.lon);
    
    if (searchMarker) map.removeLayer(searchMarker);
    
    searchMarker = L.marker([lat, lon]).addTo(map)
      .bindPopup(`<b>${location.display_name}</b>`)
      .openPopup();
    
    map.flyTo([lat, lon], 15, { duration: 1.5 });
    resultDiv.innerHTML = `<span style="color: #10b981;">已定位：${location.display_name.split(',')[0]}</span>`;
    
    setTimeout(() => {
      if (resultDiv.innerHTML.includes('已定位')) resultDiv.innerHTML = '';
    }, 5000);
    
  } catch (error) {
    resultDiv.innerHTML = '<span style="color: #ef4444;">搜索出错，请重试</span>';
  }
}

// ==================== 统一坐标转换管理器 ====================

const CoordTransform = {
  PI: 3.1415926535897932384626,
  a: 6378245.0,
  ee: 0.00669342162296594323,
  
  GCJ02_TO_WGS84(lng, lat) {
    let dlat = this.transformLat(lng - 105.0, lat - 35.0);
    let dlng = this.transformLng(lng - 105.0, lat - 35.0);
    const radlat = lat / 180.0 * this.PI;
    let magic = Math.sin(radlat);
    magic = 1 - this.ee * magic * magic;
    const sqrtmagic = Math.sqrt(magic);
    dlat = (dlat * 180.0) / ((this.a * (1 - this.ee)) / (magic * sqrtmagic) * this.PI);
    dlng = (dlng * 180.0) / ((this.a / sqrtmagic) * Math.cos(radlat) * this.PI);
    return [lng - dlng, lat - dlat];
  },
  
  WGS84_TO_GCJ02(lng, lat) {
    let dlat = this.transformLat(lng - 105.0, lat - 35.0);
    let dlng = this.transformLng(lng - 105.0, lat - 35.0);
    const radlat = lat / 180.0 * this.PI;
    let magic = Math.sin(radlat);
    magic = 1 - this.ee * magic * magic;
    const sqrtmagic = Math.sqrt(magic);
    dlat = (dlat * 180.0) / ((this.a * (1 - this.ee)) / (magic * sqrtmagic) * this.PI);
    dlng = (dlng * 180.0) / ((this.a / sqrtmagic) * Math.cos(radlat) * this.PI);
    return [lng + dlng, lat + dlat];
  },

  BD09_TO_GCJ02(lng, lat) {
    let x = lng - 0.0065;
    let y = lat - 0.006;
    let z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * this.PI * 3000.0 / 180.0);
    let theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * this.PI * 3000.0 / 180.0);
    return [z * Math.cos(theta), z * Math.sin(theta)];
  },

  GCJ02_TO_BD09(lng, lat) {
    let x = lng;
    let y = lat;
    let z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * this.PI * 3000.0 / 180.0);
    let theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * this.PI * 3000.0 / 180.0);
    return [z * Math.cos(theta) + 0.0065, z * Math.sin(theta) + 0.006];
  },
  
  transformLat(x, y) {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * this.PI) + 20.0 * Math.sin(2.0 * x * this.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * this.PI) + 40.0 * Math.sin(y / 3.0 * this.PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * this.PI) + 320 * Math.sin(y * this.PI / 30.0)) * 2.0 / 3.0;
    return ret;
  },
  
  transformLng(x, y) {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * this.PI) + 20.0 * Math.sin(2.0 * x * this.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * this.PI) + 40.0 * Math.sin(x / 3.0 * this.PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * this.PI) + 300.0 * Math.sin(x / 30.0 * this.PI)) * 2.0 / 3.0;
    return ret;
  }
};

const CoordSys = {
  WGS84: 'wgs84',
  GCJ02: 'gcj02',
  BD09: 'bd09'
};

const MAP_SOURCE_CONFIG = {
  wgs84: ['osm', 'osmde', 'osmfr', 'osm_cn', 'cyclOSM', 'wikimedia', 'arcgis_street', 'arcgis_satellite', 'esri_satellite', 'cartodb', 'cartodb_dark', 'stamen_water', 'stamen_terrain'],
  gcj02: ['gaode_vec', 'gaode_img', 'gaode_rel', 'tencent_vec', 'tencent_sat', 'tianditu_vec', 'tianditu_cva', 'tianditu_img'],
  bd09: ['baidu_vec', 'baidu_img']
};

function getMapCoordSys(sourceType) {
  for (const [sys, sources] of Object.entries(MAP_SOURCE_CONFIG)) {
    if (sources.includes(sourceType)) return sys;
  }
  return CoordSys.WGS84;
}

function getCurrentCoordSys() {
  const sourceType = document.getElementById('mapSourceSelect')?.value || 'gaode_vec';
  return getMapCoordSys(sourceType);
}

const CoordManager = {
  toWGS84(lng, lat) {
    const sys = getCurrentCoordSys();
    if (sys === CoordSys.GCJ02) {
      return CoordTransform.GCJ02_TO_WGS84(lng, lat);
    } else if (sys === CoordSys.BD09) {
      const [gcjLng, gcjLat] = CoordTransform.BD09_TO_GCJ02(lng, lat);
      return CoordTransform.GCJ02_TO_WGS84(gcjLng, gcjLat);
    }
    return [lng, lat];
  },
  
  fromWGS84(lng, lat) {
    const sys = getCurrentCoordSys();
    if (sys === CoordSys.GCJ02) {
      return CoordTransform.WGS84_TO_GCJ02(lng, lat);
    } else if (sys === CoordSys.BD09) {
      const [gcjLng, gcjLat] = CoordTransform.WGS84_TO_GCJ02(lng, lat);
      return CoordTransform.GCJ02_TO_BD09(gcjLng, gcjLat);
    }
    return [lng, lat];
  },
  
  toWGS84Point(lng, lat) {
    const [newLng, newLat] = this.toWGS84(lng, lat);
    return { lng: newLng, lat: newLat };
  },
  
  fromWGS84Point(lng, lat) {
    const [newLng, newLat] = this.fromWGS84(lng, lat);
    return { lng: newLng, lat: newLat };
  },
  
  toWGS84Array(points) {
    return points.map(p => this.toWGS84Point(p.lng, p.lat));
  },
  
  fromWGS84Array(points) {
    return points.map(p => this.fromWGS84Point(p.lng, p.lat));
  },
  
  parseMapClick(lat, lng) {
    return this.toWGS84Point(lng, lat);
  },
  
  toMapDisplay(wgs84Point) {
    return this.fromWGS84Point(wgs84Point.lng, wgs84Point.lat);
  },
  
  toMapDisplayArray(wgs84Points) {
    return wgs84Points.map(p => this.toMapDisplay(p));
  }
};

// ==================== 地图源管理模块 ====================

const DEFAULT_TIANDITU_KEY = 'fc97d01c0e3e98289295da844e1f2dad';

function updateTiandituKeyVisibility(sourceType) {
  const container = document.getElementById('tiandituKeyContainer');
  if (container) {
    container.style.display = (sourceType === 'tianditu' || sourceType === 'satellite') ? 'flex' : 'none';
  }
}

function getTiandituKey() {
  const input = document.getElementById('tiandituKeyInput');
  const val = input ? input.value.trim() : '';
  return val || DEFAULT_TIANDITU_KEY;
}

const mapSources = {
  osmde: L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '&copy; OpenStreetMap DE' }),
  cyclOSM: L.tileLayer("https://{s}.tile.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png", { subdomains: ['a', 'b', 'c'], maxZoom: 20, attribution: '&copy; CyclOSM' }),
  osmfr: L.tileLayer("https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", { subdomains: ['a', 'b', 'c'], maxZoom: 20, attribution: '&copy; OpenStreetMap France' }),
  arcgis_street: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles &copy; Esri' }),
  arcgis_satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles &copy; Esri' }),
  cartodb: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { subdomains: ['a', 'b', 'c', 'd'], maxZoom: 20, attribution: '&copy; CartoDB' }),
  cartodb_dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: ['a', 'b', 'c', 'd'], maxZoom: 20, attribution: '&copy; CartoDB' }),
  wikimedia: L.tileLayer("https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png", { subdomains: ['a', 'b', 'c'], maxZoom: 19, attribution: '&copy; Wikimedia' }),
  osm: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { subdomains: ['a', 'b', 'c'], maxZoom: 19, attribution: '&copy; OpenStreetMap' }),
  esri_satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles &copy; Esri' }),
  tianditu_vec: L.tileLayer('https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=' + DEFAULT_TIANDITU_KEY, { subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'], minZoom: 5, maxZoom: 20, maxNativeZoom: 18, attribution: '&copy; 天地图' }),
  tianditu_cva: L.tileLayer('https://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=' + DEFAULT_TIANDITU_KEY, { subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'], minZoom: 5, maxZoom: 20, maxNativeZoom: 17 }),
  tianditu_img: L.tileLayer('https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=' + DEFAULT_TIANDITU_KEY, { subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'], minZoom: 5, maxZoom: 20, maxNativeZoom: 18, attribution: '&copy; 天地图' }),
  gaode_vec: L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', { subdomains: ['1', '2', '3', '4'], maxZoom: 19, attribution: '&copy; 高德地图' }),
  gaode_img: L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}', { subdomains: ['1', '2', '3', '4'], maxZoom: 18, attribution: '&copy; 高德地图' }),
  gaode_rel: L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=10&x={x}&y={y}&z={z}', { subdomains: ['1', '2', '3', '4'], maxZoom: 16, attribution: '&copy; 高德地图' }),
  tencent_vec: L.tileLayer('https://rt0{s}.map.gtimg.com/tile?z={z}&x={x}&y={y}&styleid=2', { subdomains: ['1', '2', '3'], maxZoom: 18, attribution: '&copy; 腾讯地图' }),
  tencent_sat: L.tileLayer('https://rt0{s}.map.gtimg.com/tile?z={z}&x={x}&y={y}&styleid=0', { subdomains: ['1', '2', '3'], maxZoom: 18, attribution: '&copy; 腾讯地图' }),
  baidu_vec: L.tileLayer('https://maponline.bdimg.com/tile/?qt=tile&x={x}&y={y}&z={z}&styles=pl&scaler=1', { maxZoom: 19, attribution: '&copy; 百度地图' }),
  baidu_img: L.tileLayer('https://maponline.bdimg.com/tile/?qt=tile&x={x}&y={y}&z={z}&styles=sl&scaler=1', { maxZoom: 19, attribution: '&copy; 百度地图' }),
  osm_cn: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { subdomains: ['a', 'b', 'c'], maxZoom: 19, attribution: '&copy; OpenStreetMap' }),
  stamen_water: L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg', { subdomains: ['a', 'b', 'c', 'd'], maxZoom: 18, attribution: '&copy; Stamen/Stadia' }),
  stamen_terrain: L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png', { subdomains: ['a', 'b', 'c', 'd'], maxZoom: 18, attribution: '&copy; Stamen/Stadia' })
};

let activeBaseLayer = null;
let activeLabelLayer = null;

const map = L.map("map", {
  attributionControl: true,
  zoomControl: true,
  dragging: true,
  tap: true,
  touchZoom: true
}).setView([39.9042, 116.4074], 13);

activeBaseLayer = mapSources.gaode_vec;
activeBaseLayer.addTo(map);

function switchMapSource(sourceType) {
  updateTiandituKeyVisibility(sourceType);
  const tk = getTiandituKey();
  
  const currentCenter = map.getCenter();
  const currentZoom = map.getZoom();
  const oldCoordSys = getCurrentCoordSys();
  const wgsCenter = oldCoordSys === CoordSys.WGS84 
    ? { lng: currentCenter.lng, lat: currentCenter.lat }
    : CoordManager.toWGS84Point(currentCenter.lng, currentCenter.lat);
  
  if (activeBaseLayer) map.removeLayer(activeBaseLayer);
  if (activeLabelLayer) { map.removeLayer(activeLabelLayer); activeLabelLayer = null; }
  
  switch(sourceType) {
    case 'osm': case 'osmde': case 'cyclOSM': case 'osmfr':
    case 'arcgis_street': case 'arcgis_satellite':
    case 'cartodb': case 'cartodb_dark': case 'wikimedia':
    case 'gaode_vec': case 'gaode_img': case 'gaode_rel':
    case 'tencent_vec': case 'tencent_sat':
    case 'baidu_vec': case 'baidu_img':
    case 'osm_cn':
    case 'stamen_water': case 'stamen_terrain':
      activeBaseLayer = mapSources[sourceType];
      activeBaseLayer.addTo(map);
      break;
    case 'esri_satellite':
      activeBaseLayer = mapSources.esri_satellite;
      activeBaseLayer.addTo(map);
      break;
    case 'tianditu':
      activeBaseLayer = L.tileLayer(`https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tk}`, { subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'], minZoom: 5, maxZoom: 20, maxNativeZoom: 18, attribution: '&copy; 天地图' });
      activeLabelLayer = L.tileLayer(`https://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tk}`, { subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'], minZoom: 5, maxZoom: 20, maxNativeZoom: 17 });
      activeBaseLayer.addTo(map);
      activeLabelLayer.addTo(map);
      break;
    case 'satellite':
      activeBaseLayer = L.tileLayer(`https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tk}`, { subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'], minZoom: 5, maxZoom: 20, maxNativeZoom: 18, attribution: '&copy; 天地图' });
      activeLabelLayer = L.tileLayer(`https://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tk}`, { subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'], minZoom: 5, maxZoom: 20, maxNativeZoom: 17 });
      activeBaseLayer.addTo(map);
      activeLabelLayer.addTo(map);
      break;
  }
  
  const newCoordSys = getMapCoordSys(sourceType);
  let newCenter;
  if (newCoordSys === CoordSys.WGS84) {
    newCenter = [wgsCenter.lat, wgsCenter.lng];
  } else if (newCoordSys === CoordSys.GCJ02) {
    const [lng, lat] = CoordTransform.WGS84_TO_GCJ02(wgsCenter.lng, wgsCenter.lat);
    newCenter = [lat, lng];
  } else if (newCoordSys === CoordSys.BD09) {
    const [gcjLng, gcjLat] = CoordTransform.WGS84_TO_GCJ02(wgsCenter.lng, wgsCenter.lat);
    const [lng, lat] = CoordTransform.GCJ02_TO_BD09(gcjLng, gcjLat);
    newCenter = [lat, lng];
  }
  
  map.setView(newCenter, currentZoom);
  
  if (savedGpsWGS84) {
    const displayPoint = CoordManager.fromWGS84Point(savedGpsWGS84.lng, savedGpsWGS84.lat);
    if (currentLocationMarker) map.removeLayer(currentLocationMarker);
    currentLocationMarker = L.marker([displayPoint.lat, displayPoint.lng], {
      icon: L.divIcon({
        className: 'current-location-marker',
        html: '<div class="location-pulse"></div>',
        iconSize: [20, 20]
      })
    }).addTo(map);
  } else if (currentLocationMarker) {
    map.removeLayer(currentLocationMarker);
    currentLocationMarker = null;
  }
  
  refreshRouteDisplay();
  
  const select = document.getElementById('mapSourceSelect');
  if (select) updateMessage(`已切换到 ${select.options[select.selectedIndex].text}`);
}

function refreshRouteDisplay() {
  if (routePoints.length < 2) return;
  const displayPoints = CoordManager.toMapDisplayArray(routePoints);
  
  if (polyline) {
    polyline.setLatLngs(displayPoints);
  }
  
  if (routeEditor.active) {
    routeEditor.renderMarkers();
  }
  
  if (shapeManipulator.isActive()) {
    shapeManipulator.redraw();
  }
}

document.getElementById('mapSourceSelect')?.addEventListener('change', function() { switchMapSource(this.value); });
document.getElementById('tiandituKeyInput')?.addEventListener('input', function() {
  const select = document.getElementById('mapSourceSelect');
  if (select && (select.value === 'tianditu' || select.value === 'satellite')) switchMapSource(select.value);
});

// ==================== 当前位置获取模块 ====================

let currentLocationMarker = null;
let savedGpsWGS84 = null;

document.getElementById('getLocationBtn')?.addEventListener('click', () => {
  const btn = document.getElementById('getLocationBtn');
  btn.disabled = true;
  btn.textContent = '定位中...';
  updateMessage('正在获取您的位置...');
  
  if (!navigator.geolocation) {
    updateMessage('您的浏览器不支持定位功能', true);
    btn.disabled = false;
    btn.textContent = '获取位置';
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const wgsLat = position.coords.latitude;
      const wgsLng = position.coords.longitude;
      const accuracy = position.coords.accuracy;
      
      savedGpsWGS84 = { lng: wgsLng, lat: wgsLat };
      const displayPoint = CoordManager.fromWGS84Point(wgsLng, wgsLat);
      
      if (currentLocationMarker) map.removeLayer(currentLocationMarker);
      
      currentLocationMarker = L.marker([displayPoint.lat, displayPoint.lng], {
        icon: L.divIcon({
          className: 'current-location-marker',
          html: '<div class="location-pulse"></div>',
          iconSize: [20, 20]
        })
      }).addTo(map);
      
      currentLocationMarker.bindPopup(`<b>您的位置</b><br>WGS84纬度：${wgsLat.toFixed(6)}<br>WGS84经度：${wgsLng.toFixed(6)}<br>精度：±${accuracy.toFixed(0)}米`).openPopup();
      map.setView([displayPoint.lat, displayPoint.lng], 15);
      btn.disabled = false;
      btn.textContent = '获取位置';
      updateMessage(`定位成功！精度约 ${accuracy.toFixed(0)} 米`);
    },
    (error) => {
      let errorMsg = '定位失败，请手动选择';
      if (error.code === error.PERMISSION_DENIED) errorMsg = '定位失败：您拒绝了位置权限请求';
      else if (error.code === error.POSITION_UNAVAILABLE) errorMsg = '定位失败：位置信息不可用';
      else if (error.code === error.TIMEOUT) errorMsg = '定位失败：请求超时';
      
      updateMessage(errorMsg, true);
      alert(errorMsg + '\n\n请在地图上手动点击选择您的位置');
      btn.disabled = false;
      btn.textContent = '获取位置';
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
});

// ==================== 用户偏好设置模块 ====================

const weightInput = document.getElementById("weightInput");
if (weightInput) {
  const savedWeight = localStorage.getItem("fit_weight");
  weightInput.value = savedWeight ? savedWeight : 65;
  weightInput.addEventListener("change", () => localStorage.setItem("fit_weight", weightInput.value));
}

// ==================== 路线绘制模式模块 ====================

let currentDrawMode = 'free';
let isEditMode = false;

function switchDrawMode(mode) {
  const freeDrawBtn = document.getElementById('freeDrawMode');
  const shapeDrawBtn = document.getElementById('shapeDrawMode');
  const editBtn = document.getElementById('editModeBtn');
  const shapePanel = document.getElementById('shapeGenerationPanel');
  
  if (mode === 'free') {
    currentDrawMode = 'free';
    isEditMode = false;
    freeDrawBtn.style.background = '#2563eb';
    shapeDrawBtn.style.background = '#9ca3af';
    if (editBtn) editBtn.style.background = '#9ca3af';
    shapePanel.style.display = 'none';
    shapeManipulator.disable();
    routeEditor.disable();
  } else if (mode === 'shape') {
    currentDrawMode = 'shape';
    isEditMode = false;
    shapeDrawBtn.style.background = '#2563eb';
    freeDrawBtn.style.background = '#9ca3af';
    if (editBtn) editBtn.style.background = '#9ca3af';
    shapePanel.style.display = 'block';
    routeEditor.disable();
  } else if (mode === 'edit') {
    currentDrawMode = 'free';
    isEditMode = true;
    if (editBtn) editBtn.style.background = '#2563eb';
    freeDrawBtn.style.background = '#9ca3af';
    shapeDrawBtn.style.background = '#9ca3af';
    shapePanel.style.display = 'none';
    shapeManipulator.disable();
    routeEditor.enable();
  }
}

document.getElementById('freeDrawMode')?.addEventListener('click', () => {
  if (isEditMode) {
    routeEditor.disable();
    isEditMode = false;
  }
  switchDrawMode('free');
});
document.getElementById('shapeDrawMode')?.addEventListener('click', () => {
  if (isEditMode) {
    routeEditor.disable();
    isEditMode = false;
  }
  switchDrawMode('shape');
});
document.getElementById('editModeBtn')?.addEventListener('click', () => {
  if (isEditMode) {
    routeEditor.disable();
    isEditMode = false;
    document.getElementById('editModeBtn').style.background = '#9ca3af';
    updateMessage('已退出编辑模式');
  } else {
    switchDrawMode('edit');
  }
});

const rotationSlider = document.getElementById('rotationSlider');
const rotationInput = document.getElementById('rotationInput');
const offsetLatInput = document.getElementById('offsetLatInput');
const offsetLngInput = document.getElementById('offsetLngInput');

if (rotationSlider && rotationInput) {
  rotationSlider.addEventListener('input', () => {
    rotationInput.value = rotationSlider.value;
    if (shapeManipulator?.isActive()) shapeManipulator.setRotation(parseInt(rotationSlider.value));
  });
  rotationInput.addEventListener('input', () => {
    let value = parseInt(rotationInput.value) || 0;
    rotationSlider.value = Math.max(0, Math.min(360, value));
    if (shapeManipulator?.isActive()) shapeManipulator.setRotation(rotationSlider.value);
  });
}

document.getElementById('offsetLatInput')?.addEventListener('input', () => {
  if (shapeManipulator?.isActive()) {
    shapeManipulator.setOffset(
      parseFloat(document.getElementById('offsetLatInput').value) || 0,
      parseFloat(document.getElementById('offsetLngInput').value) || 0
    );
  }
});
document.getElementById('offsetLngInput')?.addEventListener('input', () => {
  if (shapeManipulator?.isActive()) {
    shapeManipulator.setOffset(
      parseFloat(document.getElementById('offsetLatInput').value) || 0,
      parseFloat(document.getElementById('offsetLngInput').value) || 0
    );
  }
});

// ==================== 形状操作器模块 ====================

const ICON_MOVE = `<div style="
  width: 28px;
  height: 28px;
  background: #2563eb;
  border: 3px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
    <path d="M12 2L12 22M2 12L22 12M7 7L7 17M17 7L17 17M4 7L4 17M20 7L20 17M7 4L17 4M7 20L17 20" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </svg>
</div>`;

const ICON_ROTATE = `<div style="
  width: 24px;
  height: 24px;
  background: #ff5722;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
    <path d="M21 12a9 9 0 11-2.64-6.36"/>
    <path d="M21 3v6h-6"/>
  </svg>
</div>`;

class ShapeManipulator {
  constructor() {
    this.polyline = null;
    this.moveMarker = null;
    this.rotateMarker = null;
    this.active = false;
    this.currentRotation = 0;
    this.currentOffset = { lat: 0, lng: 0 };
    this.shapeType = '400m';
    this.mapCenter = null;
    this.shapeCenter = null;
    this.isDraggingMove = false;
    this.isDraggingRotate = false;
    this.dragStartAngle = 0;
    this.dragStartRotation = 0;
    this.dragStartOffset = { lat: 0, lng: 0 };
    this.dragStartShapeCenter = null;
  }

  generateShape(center, shapeType, rotation, offsetLat = 0, offsetLng = 0) {
    const points = [];
    const rotationRad = (rotation * Math.PI) / 180;
    
    let radius, straightLength;
    switch(shapeType) {
      case '400m': radius = 36.5; straightLength = 84.39; break;
      case '300m': radius = 23.17; straightLength = 68.04; break;
      case '200m': radius = 15.0; straightLength = 50.91; break;
      default: radius = 36.5; straightLength = 84.39;
    }
    
    const latPerMeter = 1 / 111320;
    const lonPerMeter = 1 / (111320 * Math.cos(center.lat * Math.PI / 180));
    const curvePoints = 32;
    
    for (let i = 0; i <= curvePoints; i++) {
      const angle = -Math.PI * (i / curvePoints);
      const x = radius * Math.cos(angle);
      const y = -straightLength / 2 + radius * Math.sin(angle);
      const rx = x * Math.cos(rotationRad) - y * Math.sin(rotationRad);
      const ry = x * Math.sin(rotationRad) + y * Math.cos(rotationRad);
      points.push({ lat: center.lat + ry * latPerMeter + offsetLat, lng: center.lng + rx * lonPerMeter + offsetLng });
    }
    
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      const y = -straightLength / 2 + straightLength * t;
      const x = -radius;
      const rx = x * Math.cos(rotationRad) - y * Math.sin(rotationRad);
      const ry = x * Math.sin(rotationRad) + y * Math.cos(rotationRad);
      points.push({ lat: center.lat + ry * latPerMeter + offsetLat, lng: center.lng + rx * lonPerMeter + offsetLng });
    }
    
    for (let i = 0; i <= curvePoints; i++) {
      const angle = Math.PI - Math.PI * (i / curvePoints);
      const x = radius * Math.cos(angle);
      const y = straightLength / 2 + radius * Math.sin(angle);
      const rx = x * Math.cos(rotationRad) - y * Math.sin(rotationRad);
      const ry = x * Math.sin(rotationRad) + y * Math.cos(rotationRad);
      points.push({ lat: center.lat + ry * latPerMeter + offsetLat, lng: center.lng + rx * lonPerMeter + offsetLng });
    }
    
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      const y = straightLength / 2 - straightLength * t;
      const x = radius;
      const rx = x * Math.cos(rotationRad) - y * Math.sin(rotationRad);
      const ry = x * Math.sin(rotationRad) + y * Math.cos(rotationRad);
      points.push({ lat: center.lat + ry * latPerMeter + offsetLat, lng: center.lng + rx * lonPerMeter + offsetLng });
    }
    
    return points;
  }

  activate(center, shapeType, rotation = 0, offsetLat = 0, offsetLng = 0) {
    this.deactivate();
    this.active = true;
    this.currentRotation = rotation;
    this.currentOffset = { lat: offsetLat, lng: offsetLng };
    this.shapeType = shapeType;
    this.mapCenter = center;

    const points = this.generateShape(center, shapeType, rotation, offsetLat, offsetLng);
    
    this.polyline = L.polyline(points, { color: "#ff5722", weight: 4, opacity: 0.9 }).addTo(map);
    
    const bounds = this.polyline.getBounds();
    const centerPoint = bounds.getCenter();
    this.shapeCenter = { lat: centerPoint.lat, lng: centerPoint.lng };
    
    const moveIcon = L.divIcon({
      html: ICON_MOVE,
      className: 'shape-handle',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    
    this.moveMarker = L.marker(centerPoint, { icon: moveIcon, draggable: true }).addTo(map);
    
    this.moveMarker.on('dragstart', (e) => {
      this.isDraggingMove = true;
      this.dragStartOffset = { ...this.currentOffset };
      const markerPos = this.moveMarker.getLatLng();
      this.dragStartShapeCenter = { lat: markerPos.lat, lng: markerPos.lng };
      pushHistory();
    });
    
    this.moveMarker.on('drag', (e) => {
      if (!this.isDraggingMove) return;
      const newCenter = e.target.getLatLng();
      const dx = newCenter.lng - this.dragStartShapeCenter.lng;
      const dy = newCenter.lat - this.dragStartShapeCenter.lat;
      this.currentOffset.lat = this.dragStartOffset.lat + dy;
      this.currentOffset.lng = this.dragStartOffset.lng + dx;
      if (offsetLatInput) offsetLatInput.value = this.currentOffset.lat.toFixed(6);
      if (offsetLngInput) offsetLngInput.value = this.currentOffset.lng.toFixed(6);
      this.redraw();
    });
    
    this.moveMarker.on('dragend', () => {
      this.isDraggingMove = false;
    });
    
    const topCenter = bounds.getNorthWest();
    const rotateIcon = L.divIcon({
      html: ICON_ROTATE,
      className: 'shape-handle',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    
    this.rotateMarker = L.marker(topCenter, { icon: rotateIcon, draggable: true }).addTo(map);
    
    this.rotateMarker.on('dragstart', (e) => {
      this.isDraggingRotate = true;
      this.dragStartRotation = this.currentRotation;
      const markerPos = e.target.getLatLng();
      const centerPos = this.moveMarker.getLatLng();
      this.dragStartAngle = Math.atan2(markerPos.lat - centerPos.lat, markerPos.lng - centerPos.lng);
      pushHistory();
    });
    
    this.rotateMarker.on('drag', (e) => {
      if (!this.isDraggingRotate) return;
      const markerPos = e.target.getLatLng();
      const centerPos = this.moveMarker.getLatLng();
      const currentAngle = Math.atan2(markerPos.lat - centerPos.lat, markerPos.lng - centerPos.lng);
      const angleDiff = currentAngle - this.dragStartAngle;
      let newRotation = this.dragStartRotation + (angleDiff * 180 / Math.PI);
      newRotation = ((newRotation % 360) + 360) % 360;
      this.currentRotation = newRotation;
      if (rotationSlider) rotationSlider.value = Math.round(newRotation);
      if (rotationInput) rotationInput.value = Math.round(newRotation);
      this.redraw();
    });
    
    this.rotateMarker.on('dragend', () => {
      this.isDraggingRotate = false;
    });
    
    this.updateRoutePoints();
  }

  deactivate() {
    this.active = false;
    if (this.polyline) { map.removeLayer(this.polyline); this.polyline = null; }
    if (this.moveMarker) { map.removeLayer(this.moveMarker); this.moveMarker = null; }
    if (this.rotateMarker) { map.removeLayer(this.rotateMarker); this.rotateMarker = null; }
  }

  isActive() { return this.active; }

  setRotation(rotation) {
    this.currentRotation = rotation;
    this.redraw();
  }

  setOffset(offsetLat, offsetLng) {
    this.currentOffset = { lat: offsetLat, lng: offsetLng };
    this.redraw();
  }

  redraw() {
    if (!this.active || !this.mapCenter) return;
    const points = this.generateShape(this.mapCenter, this.shapeType, this.currentRotation, this.currentOffset.lat, this.currentOffset.lng);
    
    const displayPoints = CoordManager.toMapDisplayArray(points);
    
    if (this.polyline) this.polyline.setLatLngs(displayPoints);
    
    const bounds = this.polyline.getBounds();
    const centerPoint = bounds.getCenter();
    if (this.moveMarker) this.moveMarker.setLatLng(centerPoint);
    if (this.rotateMarker && this.polyline) {
      const topCenter = this.polyline.getBounds().getNorthWest();
      this.rotateMarker.setLatLng(topCenter);
    }
    this.updateRoutePoints();
    updateDistanceInfo();
    updateRouteStatus();
  }

  updateRoutePoints() {
    if (!this.active || !this.polyline) return;
    const rawLatLngs = this.polyline.getLatLngs();
    routePoints = rawLatLngs.map(p => CoordManager.toWGS84Point(p.lng, p.lat));
  }
}

const shapeManipulator = new ShapeManipulator();

document.getElementById('generateShapeBtn')?.addEventListener('click', () => {
  const rawCenter = map.getCenter();
  const center = CoordManager.parseMapClick(rawCenter.lat, rawCenter.lng);
  const shapeType = document.getElementById('shapeType').value;
  const rotation = parseInt(document.getElementById('rotationInput').value) || 0;
  const offsetLat = parseFloat(document.getElementById('offsetLatInput')?.value) || 0;
  const offsetLng = parseFloat(document.getElementById('offsetLngInput')?.value) || 0;
  
  shapeManipulator.activate(center, shapeType, rotation, offsetLat, offsetLng);
  pushHistory();
  updateMessage(`已生成${shapeType}跑道，拖动中心点可移动`);
  updateDistanceInfo();
  updateRouteStatus();
});

// ==================== 路线编辑模块 ====================

class RouteEditor {
  constructor() {
    this.markers = [];
    this.active = false;
  }

  enable() {
    if (routePoints.length < 2) {
      updateMessage('请先绘制至少2个轨迹点', true);
      return;
    }
    this.active = true;
    this.renderMarkers();
  }

  disable() {
    this.active = false;
    this.clearMarkers();
  }

  renderMarkers() {
    this.clearMarkers();
    routePoints.forEach((point, index) => {
      const displayPoint = CoordManager.toMapDisplay(point);
      const marker = L.circleMarker([displayPoint.lat, displayPoint.lng], {
        radius: 6,
        color: '#2563eb',
        fillColor: '#2563eb',
        fillOpacity: 0.8,
        weight: 2
      }).addTo(map);
      
      marker.dragging.enable();
      
      marker.on('drag', () => {
        const newLatLng = marker.getLatLng();
        const wgsPoint = CoordManager.toWGS84Point(newLatLng.lng, newLatLng.lat);
        routePoints[index] = wgsPoint;
        const displayPoints = CoordManager.toMapDisplayArray(routePoints);
        if (polyline) polyline.setLatLngs(displayPoints);
        updateDistanceInfo();
      });
      
      marker.on('dragend', () => {
        pushHistory();
      });
      
      this.markers.push(marker);
    });
  }

  clearMarkers() {
    this.markers.forEach(m => {
      if (m.dragging) m.dragging.disable();
      map.removeLayer(m);
    });
    this.markers = [];
  }
}

const routeEditor = new RouteEditor();

// ==================== 路线平滑模块 ====================

function smoothRoute(points, tolerance = 0.00005) {
  if (!points || points.length < 3) return points;
  
  const perpendicularDistance = (p, p1, p2) => {
    const dx = p2.lng - p1.lng;
    const dy = p2.lat - p1.lat;
    if (dx === 0 && dy === 0) return Math.sqrt((p.lng - p1.lng) ** 2 + (p.lat - p1.lat) ** 2);
    const t = ((p.lng - p1.lng) * dx + (p.lat - p1.lat) * dy) / (dx * dx + dy * dy);
    const nearX = p1.lng + t * dx;
    const nearY = p1.lat + t * dy;
    return Math.sqrt((p.lng - nearX) ** 2 + (p.lat - nearY) ** 2);
  };
  
  const DouglasPeucker = (pts, tol) => {
    if (pts.length <= 2) return pts;
    let maxDist = 0, maxIndex = 0;
    const end = pts.length - 1;
    const p1 = pts[0], p2 = pts[end];
    
    for (let i = 1; i < end; i++) {
      const dist = perpendicularDistance(pts[i], p1, p2);
      if (dist > maxDist) { maxDist = dist; maxIndex = i; }
    }
    
    if (maxDist > tol) {
      const left = DouglasPeucker(pts.slice(0, maxIndex + 1), tol);
      const right = DouglasPeucker(pts.slice(maxIndex), tol);
      return left.slice(0, -1).concat(right);
    }
    return [p1, p2];
  };
  
  return DouglasPeucker([...points], tolerance);
}

function applySmoothing() {
  if (routePoints.length < 3) {
    updateMessage('轨迹点太少，无需平滑', true);
    return;
  }
  
  pushHistory();
  const smoothed = smoothRoute(routePoints, 0.00005);
  
  if (smoothed.length < 3) {
    updateMessage('平滑后轨迹点太少', true);
    return;
  }
  
  routePoints = smoothed;
  if (polyline) polyline.setLatLngs(routePoints);
  if (routeEditor.active) routeEditor.renderMarkers();
  
  updateMessage(`轨迹已平滑，现有 ${routePoints.length} 个点`);
  updateDistanceInfo();
  updateRouteStatus();
}

// ==================== 操作历史记录模块 ====================

const MAX_HISTORY = 50;
let historyStack = [];

function pushHistory() {
  if (routePoints.length === 0) return;
  historyStack.push(JSON.stringify(routePoints));
  if (historyStack.length > MAX_HISTORY) historyStack.shift();
}

function undo() {
  if (historyStack.length === 0) {
    updateMessage('没有可撤销的操作', true);
    return;
  }
  
  routePoints = JSON.parse(historyStack.pop());
  
  if (polyline) {
    map.removeLayer(polyline);
    polyline = L.polyline(routePoints, { color: "#ff5722" }).addTo(map);
  }
  
  if (routeEditor.active) routeEditor.renderMarkers();
  if (shapeManipulator.isActive()) shapeManipulator.deactivate();
  
  updateMessage(`已撤销，剩余 ${historyStack.length} 步操作`);
  updateDistanceInfo();
  updateRouteStatus();
}

// ==================== 路径保存加载模块 ====================

function saveRoute() {
  if (routePoints.length < 2) {
    updateMessage('请先绘制或生成路径', true);
    return;
  }
  
  const routeName = prompt('请输入路径名称：', `路径_${new Date().toLocaleDateString().replace(/\//g, '-')}`);
  if (!routeName) return;
  
  const routes = JSON.parse(localStorage.getItem('savedRoutes') || '{}');
  routes[routeName] = { points: routePoints, savedAt: new Date().toISOString() };
  localStorage.setItem('savedRoutes', JSON.stringify(routes));
  
  updateMessage(`路径 "${routeName}" 已保存`);
  updateSavedRoutesList();
}

function loadRoute(routeName) {
  const routes = JSON.parse(localStorage.getItem('savedRoutes') || '{}');
  if (!routes[routeName]) {
    updateMessage('路径不存在', true);
    return;
  }
  
  pushHistory();
  routePoints = routes[routeName].points;
  
  if (polyline) map.removeLayer(polyline);
  const displayPoints = CoordManager.toMapDisplayArray(routePoints);
  polyline = L.polyline(displayPoints, { color: "#ff5722" }).addTo(map);
  map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
  
  shapeManipulator.deactivate();
  routeEditor.disable();
  switchDrawMode('free');
  
  updateMessage(`已加载路径 "${routeName}"`);
  updateDistanceInfo();
  updateRouteStatus();
}

function deleteRoute(routeName) {
  if (!confirm(`确定要删除路径 "${routeName}" 吗？`)) return;
  
  const routes = JSON.parse(localStorage.getItem('savedRoutes') || '{}');
  delete routes[routeName];
  localStorage.setItem('savedRoutes', JSON.stringify(routes));
  
  updateMessage(`路径 "${routeName}" 已删除`);
  updateSavedRoutesList();
}

function updateSavedRoutesList() {
  const container = document.getElementById('savedRoutesList');
  if (!container) return;
  
  const routes = JSON.parse(localStorage.getItem('savedRoutes') || '{}');
  const routeNames = Object.keys(routes);
  
  if (routeNames.length === 0) {
    container.innerHTML = '<div style="font-size: 12px; color: #9ca3af; text-align: center; padding: 8px;">暂无保存的路径</div>';
    container.style.border = '1px dashed #e5e7eb';
    return;
  }
  
  container.style.border = 'none';
  container.innerHTML = '';

  for (const name of routeNames) {
    const date = new Date(routes[name].savedAt).toLocaleDateString();
    const item = document.createElement('div');
    item.className = 'saved-route-item';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'route-name';
    nameSpan.textContent = name;
    nameSpan.addEventListener('click', () => loadRoute(name));
    
    const dateSpan = document.createElement('span');
    dateSpan.className = 'route-date';
    dateSpan.textContent = date;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'route-delete-btn';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', () => deleteRoute(name));
    
    item.appendChild(nameSpan);
    item.appendChild(dateSpan);
    item.appendChild(deleteBtn);
    container.appendChild(item);
  }
}

document.getElementById('saveRouteBtn')?.addEventListener('click', saveRoute);
updateSavedRoutesList();

// ==================== 路线数据模块 ====================

let routePoints = [];
let polyline = null;
let paceChart = null;
let hrChart = null;
let previewData = null;
let previewTimer = null;
let previewMarker = null;
let previewIndex = 0;

function updateMessage(text, isError = false) {
  const el = document.getElementById("message");
  el.textContent = text || "";
  el.className = "message" + (isError ? " error" : "");
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeDistanceMeters(points) {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng);
  }
  return total;
}

function updateDistanceInfo() {
  const el = document.getElementById("distanceInfo");
  if (!el) return;
  if (!routePoints || routePoints.length < 2) {
    el.textContent = "总距离约：0 公里";
    return;
  }
  const baseMeters = computeDistanceMeters(routePoints);
  const baseKm = baseMeters / 1000;
  const lapInput = document.getElementById("lapCount");
  const laps = Math.max(1, parseFloat(lapInput?.value) || 1);
  const totalKm = baseKm * laps;
  el.textContent = laps > 1
    ? `总距离约：${totalKm.toFixed(2)} 公里（基础：${baseKm.toFixed(2)} km × ${laps} 圈）`
    : `总距离约：${baseKm.toFixed(2)} 公里`;
}

map.on("click", (e) => {
  if (currentDrawMode === 'shape' || shapeManipulator.isActive()) return;
  
  if (isEditMode) {
    return;
  }
  
  if (routeEditor.active) {
    return;
  }
  
  if (routePoints.length > 0) pushHistory();
  
  const wgsPoint = CoordManager.parseMapClick(e.latlng.lat, e.latlng.lng);
  routePoints.push(wgsPoint);
  
  const displayPoints = CoordManager.toMapDisplayArray(routePoints);
  if (polyline) {
    polyline.setLatLngs(displayPoints);
  } else {
    polyline = L.polyline(displayPoints, { color: "#ff5722" }).addTo(map);
  }
  
  updateMessage(`已添加点数：${routePoints.length}`);
  updateDistanceInfo();
});

function updateRouteStatus() {
  const statusEl = document.getElementById('routeStatus');
  if (!statusEl) return;
  
  if (routePoints.length < 2) {
    statusEl.textContent = '路线状态：未闭合';
    return;
  }
  
  const first = routePoints[0];
  const last = routePoints[routePoints.length - 1];
  const distance = haversineDistance(first.lat, first.lng, last.lat, last.lng);
  
  statusEl.textContent = distance < 10
    ? `路线状态：已闭合（${routePoints.length}个点）`
    : `路线状态：未闭合（${routePoints.length}个点）`;
}

function undoLastPoint() {
  if (routePoints.length > 0) {
    pushHistory();
    routePoints.pop();
    if (polyline) {
      if (routePoints.length < 2) { map.removeLayer(polyline); polyline = null; }
      else polyline.setLatLngs(routePoints);
    }
    updateMessage(`已撤销最后一个点，当前 ${routePoints.length} 个点`);
    updateDistanceInfo();
    updateRouteStatus();
  }
}

function clearRoute() {
  pushHistory();
  routePoints = [];
  if (polyline) { map.removeLayer(polyline); polyline = null; }
  shapeManipulator.deactivate();
  routeEditor.disable();
  historyStack = [];
  updateMessage("轨迹已清空");
  updateDistanceInfo();
  updateRouteStatus();
}

function calculateLapsByDistance() {
  if (routePoints.length < 2) {
    updateMessage("请先绘制路线", true);
    return;
  }
  
  const baseMeters = computeDistanceMeters(routePoints);
  const baseKm = baseMeters / 1000;
  const targetDistance = parseFloat(document.getElementById('targetDistance')?.value);
  
  if (isNaN(targetDistance) || targetDistance <= 0) {
    updateMessage("请输入有效的目标距离", true);
    return;
  }
  
  const requiredLaps = targetDistance / baseKm;
  document.getElementById('lapCount').value = requiredLaps.toFixed(2);
  
  updateMessage(`按目标距离 ${targetDistance} 公里计算，需要 ${requiredLaps.toFixed(2)} 圈`);
  updateDistanceInfo();
}

document.getElementById('undoBtn')?.addEventListener('click', undo);
document.getElementById('clearRoute')?.addEventListener('click', clearRoute);
document.getElementById('calculateLapsBtn')?.addEventListener('click', calculateLapsByDistance);
document.getElementById('smoothBtn')?.addEventListener('click', applySmoothing);
document.getElementById('lapCount')?.addEventListener('input', updateDistanceInfo);

function dateToLocalInputValue(d) {
  const tzOffset = d.getTimezoneOffset();
  return new Date(d.getTime() - tzOffset * 60000).toISOString().slice(0, 16);
}

function rebuildExportTimes() {
  const container = document.getElementById("exportTimes");
  const exportInput = document.getElementById("exportCount");
  if (!container || !exportInput) return;
  
  const count = Math.max(1, Math.min(10, parseInt(exportInput.value, 10) || 1));
  const now = new Date();
  container.innerHTML = "";
  
  for (let i = 0; i < count; i++) {
    const row = document.createElement("div");
    row.className = "export-time-row";
    row.innerHTML = `
      <div class="export-row-1">
        <span>第 ${i + 1} 份</span>
        <input type="datetime-local" class="export-time-input" data-index="${i}" value="${dateToLocalInputValue(new Date(now.getTime() + i * 24 * 60 * 60 * 1000))}">
      </div>
      <div class="export-row-2">
        <span class="pace-label">配速:</span>
        <input type="number" class="export-pace-min" min="0" step="0.1" value="5">
        <span>分</span>
        <input type="number" class="export-pace-sec" min="0" max="59.9" step="0.1" value="10">
        <span>秒/km</span>
      </div>
    `;
    container.appendChild(row);
  }
}

// ==================== FIT文件生成模块 ====================

async function generateFit() {
  if (routePoints.length < 2) {
    updateMessage("请至少在地图上选择两个点形成轨迹", true);
    return;
  }
  
  const hrRest = parseInt(document.getElementById("hrRest")?.value) || 60;
  const hrMax = parseInt(document.getElementById("hrMax")?.value) || 180;
  const lapCount = Math.max(1, parseFloat(document.getElementById("lapCount")?.value) || 1);
  const exportCount = Math.max(1, Math.min(10, parseInt(document.getElementById("exportCount")?.value) || 1));
  
  const timeInputs = document.querySelectorAll(".export-time-input");
  const paceMinInputs = document.querySelectorAll(".export-pace-min");
  const paceSecInputs = document.querySelectorAll(".export-pace-sec");
  
  const baseMeters = computeDistanceMeters(routePoints);
  const totalKm = (baseMeters / 1000) * lapCount;
  
  if (totalKm > 210) {
    updateMessage(`总距离不能超过 210 公里，当前 ${totalKm.toFixed(2)} 公里`, true);
    return;
  }
  
  try {
    for (let i = 0; i < exportCount; i++) {
      updateMessage(`正在生成第 ${i + 1}/${exportCount} 个 FIT 文件...`);
      
      const fileStart = new Date(timeInputs[i]?.value);
      if (Number.isNaN(fileStart.getTime())) {
        updateMessage(`请为第 ${i + 1} 份设置开始时间`, true);
        return;
      }
      
      const pm = parseFloat(paceMinInputs[i]?.value) || 0;
      const ps = parseFloat(paceSecInputs[i]?.value) || 0;
      const filePaceSecondsPerKm = pm * 60 + ps;
      
      if (!filePaceSecondsPerKm || filePaceSecondsPerKm <= 0) {
        updateMessage(`第 ${i + 1} 份的配速无效`, true);
        return;
      }
      
      const weightKg = Number(document.getElementById("weightInput")?.value) || 65;
      const powerFactor = parseFloat(document.getElementById("powerFactor")?.value) || 1.3;
      const gpsDrift = parseFloat(document.getElementById("gpsDrift")?.value) || 0;
      const avgCadence = parseInt(document.getElementById("avgCadence")?.value) || 170;
      
      const res = await fetch("/api/generate-fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: fileStart.toISOString(),
          points: routePoints,
          paceSecondsPerKm: filePaceSecondsPerKm,
          hrRest, hrMax, lapCount, variantIndex: i + 1,
          weightKg, powerFactor, gpsDrift, avgCadence
        })
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        updateMessage(err.error || "生成失败", true);
        return;
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportCount > 1 ? `run_${i + 1}.fit` : "run.fit";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
    updateMessage(`已生成 ${exportCount} 个 FIT 文件并开始下载`);
  } catch (e) {
    console.error(e);
    updateMessage("请求失败，请稍后重试", true);
  }
}

document.getElementById("generateFit")?.addEventListener("click", generateFit);
document.getElementById("exportCount")?.addEventListener("input", rebuildExportTimes);

updateDistanceInfo();
rebuildExportTimes();

// ==================== 运动预览功能模块 ====================

function renderPreviewCharts(preview) {
  if (!preview || !Array.isArray(preview.samples) || preview.samples.length === 0) {
    updateMessage("预览数据为空", true);
    return;
  }
  
  const previewPanel = document.querySelector('.preview-panel');
  if (previewPanel) previewPanel.classList.add('visible');
  
  const labels = preview.samples.map((s) => (s.timeSec / 60).toFixed(1));
  const paceData = preview.samples.map((s) => {
    const speed = s.speed > 0 ? s.speed : 0.01;
    return (1000 / speed) / 60;
  });
  const hrData = preview.samples.map((s) => s.heartRate);
  
  const paceCtx = document.getElementById("paceChart")?.getContext("2d");
  const hrCtx = document.getElementById("hrChart")?.getContext("2d");
  
  if (paceChart) paceChart.destroy();
  if (hrChart) hrChart.destroy();
  
  paceChart = new Chart(paceCtx, {
    type: "line",
    data: { labels, datasets: [{ label: "配速", data: paceData, borderColor: "#1976d2", tension: 0.2, pointRadius: 0 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { title: { display: true, text: "时间 (分钟)" } }, y: { title: { display: true, text: "min/km" }, reverse: true } }
    }
  });
  
  hrChart = new Chart(hrCtx, {
    type: "line",
    data: { labels, datasets: [{ label: "心率", data: hrData, borderColor: "#e53935", tension: 0.2, pointRadius: 0 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { title: { display: true, text: "时间 (分钟)" } }, y: { title: { display: true, text: "bpm" } } }
    }
  });
}

async function previewActivity() {
  if (routePoints.length < 2) {
    updateMessage("请至少在地图上选择两个点形成轨迹", true);
    return;
  }
  
  const timeInputs = document.querySelectorAll(".export-time-input");
  const paceMinInputs = document.querySelectorAll(".export-pace-min");
  const paceSecInputs = document.querySelectorAll(".export-pace-sec");
  
  if (!timeInputs.length || !paceMinInputs.length || !paceSecInputs.length) {
    updateMessage("请先设置时间和配速", true);
    return;
  }
  
  const firstTimeInput = timeInputs[0];
  if (!firstTimeInput?.value) firstTimeInput.value = dateToLocalInputValue(new Date());
  
  const start = new Date(firstTimeInput.value);
  if (Number.isNaN(start.getTime())) {
    updateMessage("开始时间无效", true);
    return;
  }
  
  const pm = parseFloat(paceMinInputs[0]?.value) || 0;
  const ps = parseFloat(paceSecInputs[0]?.value) || 0;
  const paceSecondsPerKm = pm * 60 + ps;
  
  if (!paceSecondsPerKm || paceSecondsPerKm <= 0) {
    updateMessage("配速无效", true);
    return;
  }
  
  const hrRest = parseInt(document.getElementById("hrRest")?.value) || 60;
  const hrMax = parseInt(document.getElementById("hrMax")?.value) || 180;
  const lapCount = Math.max(1, parseFloat(document.getElementById("lapCount")?.value) || 1);
  const weightKg = Number(document.getElementById("weightInput")?.value) || 65;
  const powerFactor = parseFloat(document.getElementById("powerFactor")?.value) || 1.3;
  const gpsDrift = parseFloat(document.getElementById("gpsDrift")?.value) || 0;
  const avgCadence = parseInt(document.getElementById("avgCadence")?.value) || 170;
  
  updateMessage("正在生成预览...");
  
  try {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: start.toISOString(),
        points: routePoints,
        paceSecondsPerKm, hrRest, hrMax, lapCount,
        weightKg, powerFactor, gpsDrift, avgCadence
      })
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      updateMessage(err.error || "预览失败", true);
      return;
    }
    
    const data = await res.json();
    renderPreviewCharts(data);
    
    const km = (data.totalDistanceMeters / 1000).toFixed(2);
    const min = (data.totalDurationSec / 60).toFixed(1);
    updateMessage(`预览已生成，距离约 ${km} 公里，时间约 ${min} 分钟`);
    
    previewData = data;
    previewIndex = 0;

    if (previewTimer) {
      clearInterval(previewTimer);
      previewTimer = null;
    }
    if (previewMarker) {
      map.removeLayer(previewMarker);
      previewMarker = null;
    }
    
    const samples = previewData.samples || [];
    if (samples.length > 0) {
      previewMarker = L.circleMarker([samples[0].lat, samples[0].lng], { radius: 6, color: "#1976d2" }).addTo(map);
      startPreviewPlayback();
    }
  } catch (e) {
    console.error(e);
    updateMessage("预览请求失败", true);
  }
}

document.getElementById("previewBtn")?.addEventListener("click", previewActivity);

// ==================== 预览回放功能模块 ====================

function updateLiveInfo(sample) {
  const el = document.getElementById("liveInfo");
  if (!el || !sample) return;
  
  const t = Math.max(0, sample.timeSec || 0);
  const min = Math.floor(t / 60);
  const sec = Math.floor(t % 60);
  const speed = sample.speed > 0 ? sample.speed : 0.01;
  const secPerKm = 1000 / speed;
  const paceMin = Math.floor(secPerKm / 60);
  const paceSec = Math.round(secPerKm % 60);
  const hr = sample.heartRate || 0;
  
  el.textContent = `时间 ${min}:${sec.toString().padStart(2, "0")}  配速 ${paceMin}'${paceSec.toString().padStart(2, "0")}" / km  心率 ${hr} bpm`;
}

function startPreviewPlayback() {
  const samples = previewData?.samples || [];
  if (!samples.length) return;
  
  previewTimer = setInterval(() => {
    if (previewIndex >= samples.length) {
      clearInterval(previewTimer);
      previewTimer = null;
      return;
    }
    
    const s = samples[previewIndex];
    if (previewMarker && s) {
      previewMarker.setLatLng([s.lat, s.lng]);
      updateLiveInfo(s);
    }
    previewIndex += 1;
  }, 100);
}
