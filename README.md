# Fit Tool

Keep 校园跑路线生成工具 | Garmin FIT 文件生成器

## 项目简介

FitTool 是一款基于 Web 的校园跑路线生成工具，支持在地图上自由绘制跑步路线或生成标准跑道，自动计算运动数据（心率、步频、功率等），并导出符合 Garmin 设备标准的 FIT 文件。

## 功能特性

- **多地图源支持**：高德地图、腾讯地图、百度地图、OpenStreetMap、ArcGIS 等
- **自由绘制模式**：在地图上点击添加轨迹点
- **形状生成模式**：一键生成 400m / 300m / 200m 标准跑道
- **轨迹编辑**：支持拖拽编辑、撤销、回退、平滑处理
- **运动参数配置**：静息心率、最大心率、平均步频、体重、功率系数、GPS 偏移
- **多圈数支持**：自定义跑步圈数，自动计算总距离
- **数据预览**：实时预览配速曲线和心率曲线
- **批量导出**：支持一次导出多份 FIT 文件
- **坐标系统转换**：自动处理 GCJ-02、BD-09、WGS-84 坐标系统

## 版本选择

本项目提供两个部署版本，请根据您的需求选择：

| 版本                           | 目录                   | 部署方式     | 适用场景           |
| ------------------------------ | ---------------------- | ------------ | ------------------ |
| **Node.js 服务器版**           | `node-server/`         | 传统服务器部署 | 需要完全控制服务器环境 |
| **Cloudflare Workers 版**      | `cloudflare-workers/`  | 无服务器边缘部署 | 免服务器、全球加速、快速部署 |

## 快速开始

### Node.js 服务器版

```bash
cd node-server
npm install
npm start
```

访问 <http://localhost:3000>

### Cloudflare Workers 版

```bash
cd cloudflare-workers
npm install
npm run dev
```

访问 <http://localhost:8787>

---

## Node.js 服务器版

### 技术栈

- **前端**：HTML5 + CSS3 + JavaScript (ES6+)
- **地图库**：Leaflet
- **图表库**：Chart.js
- **后端**：Node.js + Express
- **FIT 文件**：@garmin/fitsdk

### 使用说明

1. **选择地图源**：在左侧面板选择适合的地图类型
2. **绘制路线**：
   - 自由绘制：点击地图添加轨迹点
   - 形状生成：选择跑道类型，点击"在地图中心生成"
3. **设置参数**：配置圈数、运动参数、导出时间
4. **预览数据**：点击"预览曲线"查看配速和心率图表
5. **导出 FIT**：点击"生成 FIT 文件"下载文件

### 目录结构

```
node-server/
├── public/
│   ├── index.html    # 主页面
│   ├── main.js       # 前端逻辑
│   └── style.css     # 样式文件
├── server.js         # Express 服务器
├── package.json      # 项目配置
└── README.md         # 项目文档
```

---

## Cloudflare Workers 版

### 环境要求

- **Node.js** >= 18.0
- **npm** >= 9.0
- **Cloudflare 账号**（用于部署）

### 技术栈

- **前端**：HTML5 + CSS3 + JavaScript (ES6+)
- **后端**：Cloudflare Workers + Hono
- **地图库**：Leaflet
- **图表库**：Chart.js
- **FIT 文件**：自定义编码器

### 本地开发

```bash
cd cloudflare-workers
npm install
npm run dev
```

访问 http://localhost:8787 即可使用。

### 部署到 Cloudflare

#### 1. 安装 Wrangler CLI（如未安装）

```bash
npm install -g wrangler
```

#### 2. 登录 Cloudflare

```bash
wrangler login
```

浏览器会自动打开 Cloudflare 授权页面，完成登录。

#### 3. 配置 CORS（重要）

编辑 `wrangler.toml`，将 `ALLOWED_ORIGINS` 设置为你的实际域名：

```toml
[vars]
# 生产环境请设置为实际域名，不要使用 "*"
ALLOWED_ORIGINS = "https://your-domain.com,https://fit-tool.your-subdomain.workers.dev"
```

> **安全提示**：`ALLOWED_ORIGINS = "*"` 仅用于开发环境。生产环境必须指定具体域名。

#### 4. 部署

```bash
npm run deploy
```

部署成功后，终端会输出访问 URL，格式为：
```
https://fit-tool.<your-subdomain>.workers.dev/
```

### 配置说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `name` | Worker 名称 | `fit-tool` |
| `main` | 入口文件 | `src/index.ts` |
| `compatibility_date` | 兼容日期 | `2024-01-01` |
| `ALLOWED_ORIGINS` | CORS 允许的源（逗号分隔） | `*`（开发用） |
| `assets.directory` | 静态文件目录 | `./public` |

### 天地图 Key

天地图瓦片需要 API Key。用户可在前端界面"地图设置"中输入自己的 Key。

申请地址：https://console.tianditu.gov.cn/

### API 接口

#### POST /api/preview

生成运动数据预览（不生成文件）。

**请求体：**
```json
{
  "startTime": "2024-06-01T06:00:00Z",
  "points": [{ "lat": 39.9042, "lng": 116.4074 }, { "lat": 39.905, "lng": 116.408 }],
  "paceSecondsPerKm": 310,
  "hrRest": 60,
  "hrMax": 180,
  "lapCount": 1,
  "weightKg": 65,
  "powerFactor": 1.3,
  "gpsDrift": 0.1,
  "avgCadence": 170
}
```

**响应：**
```json
{
  "totalDistanceMeters": 1234.5,
  "totalDurationSec": 382.7,
  "samples": [...],
  "calories": 82
}
```

#### POST /api/generate-fit

生成 FIT 二进制文件并下载。

**请求体：** 与 `/api/preview` 相同，额外支持 `variantIndex` 参数。

**响应：** `application/vnd.ant.fit` 二进制文件。

### 常见问题

**Q: 部署后前端无法调用 API（CORS 错误）**
A: 检查 `wrangler.toml` 中的 `ALLOWED_ORIGINS` 是否包含你的前端域名。

**Q: 天地图瓦片加载失败**
A: 确保已填写有效的天地图 API Key。可在前端"地图设置"面板中输入。

**Q: 如何自定义域名？**
A: 在 Cloudflare Dashboard 中绑定自定义域名，或在 `wrangler.toml` 中添加：
```toml
routes = [
  { pattern = "fit.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

### 目录结构

```
cloudflare-workers/
├── src/
│   ├── index.ts          # Hono API 入口 + 运动数据生成
│   └── fit.ts            # FIT 二进制文件编码器
├── public/
│   ├── index.html        # 前端页面
│   ├── main.js           # 前端逻辑（地图、坐标转换、UI）
│   └── style.css         # 样式（含暗色模式）
├── wrangler.toml         # Workers 配置
├── package.json          # 依赖管理
└── tsconfig.json         # TypeScript 配置
```

---

## 目录结构

```
FitTools/
├── README.md                  # 本文档（项目概览）
├── node-server/               # Node.js 服务器版本
│   ├── public/                # 静态资源
│   │   ├── index.html        # 主页面
│   │   ├── main.js          # 前端逻辑
│   │   ├── style.css         # 样式文件
│   │   └── HOG_S_64.png     # 图标
│   ├── server.js             # Express 服务器
│   ├── package.json          # 项目配置
│   ├── package-lock.json     # 依赖锁定
│   ├── run.sh                # Termux 一键启动脚本
│   └── run.cmd                # Windows 一键启动脚本
└── cloudflare-workers/       # Cloudflare Workers 版本
    ├── src/                   # TypeScript 源码
    │   ├── index.ts          # Hono API 入口 + 运动数据生成
    │   ├── fit.ts            # FIT 二进制文件编码器
    │   └── fitsdk.d.ts       # 类型定义
    ├── public/               # 静态资源
    │   ├── index.html        # 主页面
    │   ├── main.js          # 前端逻辑
    │   ├── style.css         # 样式文件
    │   └── HOG_S_64.png     # 图标
    ├── wrangler.toml         # Workers 配置
    ├── package.json          # 项目配置
    ├── package-lock.json     # 依赖锁定
    └── tsconfig.json         # TypeScript 配置
```

## 开发者

**HOG-StarWatch**

## 特别鸣谢

node版开源者：

[**黑心商家瑶瑶**](https://space.bilibili.com/439315192)

## 免责声明

本项目仅供学习交流使用，请勿用于任何作弊行为。使用本项目产生的一切后果由使用者自行承担。
