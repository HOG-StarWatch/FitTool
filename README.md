# Fit Tool

Keep 校园跑生成工具 | Garmin FIT 文件生成器

## 在线示例

可直接访问体验：<https://如何呢.又能怎.de5.net>

## 技术标签

![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)
![Express](https://img.shields.io/badge/Express-4.18-orange.svg)
![Hono](https://img.shields.io/badge/Hono-4.12-yellow.svg)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9-green.svg)
![Garmin FIT SDK](https://img.shields.io/badge/Garmin-FIT%20SDK-red.svg)

## 项目简介

FitTool 是一款基于 Web 的校园跑路线生成工具，支持在地图上自由绘制跑步路线或生成标准跑道，自动计算运动数据（心率、步频、功率等），并导出符合 Garmin 设备标准的 FIT 文件。

## 功能特性

- **多地图源支持**：高德地图、腾讯地图、百度地图、OSM、ArcGIS、天地图等
- **自由绘制模式**：在地图上点击添加轨迹点
- **形状生成模式**：一键生成 400m / 300m / 200m 标准跑道，支持旋转和位置偏移
- **轨迹编辑**：支持拖拽编辑、撤销、回退、平滑处理
- **路线保存**：支持保存和加载常用路线
- **运动参数配置**：静息心率、最大心率、平均步频、体重、功率系数、GPS 偏移
- **多圈数支持**：自定义跑步圈数，支持小数圈数，自动计算总距离
- **按距离计算圈数**：输入目标距离自动计算所需圈数
- **数据预览**：实时预览配速曲线和心率曲线
- **批量导出**：支持一次导出多份 FIT 文件
- **坐标系统转换**：自动处理 GCJ-02、BD-09、WGS-84 坐标系统

## 版本选择

本项目提供两个部署版本，请根据您的需求选择：

| 版本                             | 介绍                                  | 部署需求         | 适用场景                                   |
| ------------------------------ | ----------------------------------- | ------------ | -------------------------------------- |
| **JS-Express-\@garmin/fitsdk** | 传统服务器部署                             | 需要完全控制服务器环境  | 适用于本地开发和测试环境                           |
| **TS-Hono**                    | 兼容传统服务器部署 并支持 Cloudflare Workers 部署 | 支持无需服务器 边缘部署 | 适用于本地开发和测试环境 适用于免服务器、全球加速、快速部署、无限制访问使用 |

***

## JS-Express-\@garmin/fitsdk

### 技术栈

- **前端**：HTML5 + CSS3 + JavaScript (ES6+)
- **地图库**：Leaflet
- **图表库**：Chart.js
- **后端**：Node.js + Express
- **FIT 文件**：[@garmin/fitsdk](https://www.npmjs.com/package/@garmin/fitsdk) 官方 SDK

### 快速开始

```bash
cd JS-Express-@garmin_fitsdk
npm install
npm start
```

访问 <http://localhost:3000>

### 目录结构

```
JS-Express-@garmin_fitsdk/
├── public/
│   ├── index.html    # 主页面
│   ├── main.js       # 前端逻辑
│   ├── style.css     # 样式文件
│   └── HOG_S_64.png  # 图标
├── server.js         # Express 服务器 + FIT 文件生成
├── package.json      # 项目配置
├── run.sh            # Termux 一键启动脚本
└── run.cmd           # Windows 一键启动脚本
```

***

## TS-Hono (Cloudflare Workers 版)

### 技术栈

- **前端**：HTML5 + CSS3 + JavaScript (ES6+)
- **后端**：Cloudflare Workers + Hono
- **地图库**：Leaflet
- **图表库**：Chart.js
- **FIT 文件**：自定义编码器 (src/fit.ts)

### 本地开发

#### 1.快速开始

```bash
cd TS-Hono
npm install
npm start
```

访问 <http://localhost:3000>

#### 2.wrangler 本地开发

```bash
cd TS-Hono
npm install
npm run dev
```

访问 <http://localhost:8787>

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

~~workers.dev域名访问受限 生产环境请使用自定义域名~~

### 目录结构

```
TS-Hono/
├── src/
│   ├── index.ts      # Hono API 入口 + 运动数据生成
│   └── fit.ts        # FIT 二进制文件编码器
├── public/
│   ├── index.html    # 前端页面
│   ├── main.js       # 前端逻辑（地图、坐标转换、UI）
│   ├── style.css     # 样式（含暗色模式）
│   └── HOG_S_64.png  # 图标
├── server.ts         # 本地开发服务器
├── wrangler.toml     # Workers 配置
├── package.json      # 依赖管理
├── tsconfig.json     # TypeScript 配置
├── run.sh            # Termux 一键启动脚本
└── run.cmd           # Windows 一键启动脚本
```

***

## API 接口

两个版本提供相同的 API 接口：

### POST /api/preview

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

### POST /api/generate-fit

生成 FIT 二进制文件并下载。

**请求体：** 与 `/api/preview` 相同，额外支持 `variantIndex` 参数。

**响应：** `application/vnd.ant.fit` 二进制文件。

***

## 天地图 Key

天地图瓦片需要 API Key。用户可在前端界面"地图设置"中输入自己的 Key。

申请地址：<https://console.tianditu.gov.cn/>

***

## 常见问题

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

***

## 开发者

| 版本                               | 贡献者                                                                  |
| -------------------------------- | -------------------------------------------------------------------- |
| JS-Express-\@garmin\_fitsdk V1.5 | [HOG-StarWatch](https://github.com/HOG-StarWatch)（前端重构、后端维护、新增地图源支持） |
| TS-Hono V1.0                     | [HOG-StarWatch](https://github.com/HOG-StarWatch)（初始版本）              |

## 特别鸣谢

| 项目                                        | 来源                                             |
| ----------------------------------------- | ---------------------------------------------- |
| JS-Express-\@garmin\_fitsdk V1.0-V1.2 开源者 | [黑心商家瑶瑶](https://space.bilibili.com/439315192) |
| Cloudflare Workers 免费额度                   | [Cloudflare](https://www.cloudflare.com/)      |
| Hono 框架                                   | [Hono](https://hono.dev/)                      |

## 免责声明

本项目仅供学习交流使用，请勿用于任何作弊行为。使用本项目产生的一切后果由使用者自行承担。
