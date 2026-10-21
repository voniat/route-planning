# 旅行路线规划（Web）

浏览器端旅行路线规划：地图选点、途经点排序、公交/地铁与步行路线、7 日天气、本地收藏与草稿、分享链接。无后端，构建产物是纯静态文件。

## 功能

- 高德地图选点、POI 搜索与输入提示、城市选择
- 最多 20 个途经点，指针拖拽或键盘排序
- 公交/地铁多方案、步行路线与地图折线
- Open-Meteo 当前天气 + 7 日预报
- localStorage 草稿/收藏/搜索历史；分享链接还原；复制行程文本
- 桌面与移动端响应式布局

## 技术栈

React 19 + TypeScript（strict）+ Vite 7 + Vitest；高德 JS API v2；Open-Meteo。无状态库、无 UI 库、无后端。

## 本地运行

Node >= 22.13，pnpm 11。

```bash
pnpm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
# 填写 VITE_AMAP_KEY 与 VITE_AMAP_SECURITY_CODE
pnpm dev
```

Key 获取、安全密钥与域名白名单见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 开源与自带 Key（BYO）

本仓库**不内置高德 Key**，也不提供由维护者付费的公共演示站。每个部署者使用自己的 Key：

- 你部署一个站点：一个 Key 服务所有访客，你承担配额、费用和滥用风险。
- 别人自己部署：每个部署实例需要自己的 Key；只是访问你部署的站点则不需要。
- 不要把维护者的 Key 提交到仓库、写进分享链接或发给别人。

个人认证、非商业用途有 **1 年免费月配额**（自注册认证起算），其中搜索 5,000 次/月、基础 LBS 15 万次/月、地图初始化 150 万次/月；超量、到期或公开/商业使用需要按量付费或购买技术服务许可。价格与配额以高德控制台为准：

- 调用价格：<https://developer.amap.com/upgrade#price>
- 技术服务许可：<https://lbs.amap.com/pages/authorization/>

## 脚本

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 本地开发服务器 |
| `pnpm build` | 构建到 `dist/` |
| `pnpm test` | Vitest 单元测试 |
| `pnpm verify` | 类型检查 + 单测 + 密钥扫描 + 构建 |

`pnpm verify` 是 CI 与发布前的统一检查。

## 目录

```text
src/core       纯逻辑：坐标/城市/天气解析/收藏/草稿/分享/行程文本
src/amap       高德 JS API 加载、地图、搜索、地理编码、路线适配
src/hooks      天气与路线请求状态
src/components UI 组件
src/state      planner reducer
```

## 数据来源

- 高德地图 JS API v2：地图、POI、地理编码、公交与步行路线
- Open-Meteo：天气；界面保留数据来源与 CC BY 4.0 标识

Open-Meteo 免费公共端点仅供非商业用途；带广告、订阅或商业产品发布时应使用其商业订阅端点和 Key。

## 相关文档

- 重构规格、实施计划与验收记录：[docs/web-rewrite.md](docs/web-rewrite.md)
- 部署：[DEPLOYMENT.md](DEPLOYMENT.md)
- 安全：[SECURITY.md](SECURITY.md)
