# 旅行路线规划（Web）

浏览器端的多途经点旅行路线规划。地图 App 通常不直接给“多个途经点”的公交/步行方案，这个项目把相邻地点拆成路段，逐段查询公交/地铁或步行路线，再落到同一张地图上。

纯前端：React 19 + TypeScript（strict）+ Vite 7 + Vitest；无后端、无状态库、无 UI 库，构建产物是静态文件。

## 功能

- 地图选点、POI 搜索与输入提示、城市切换、当前位置设为起点
- 最多 20 个途经点；指针拖拽、键盘排序；删除/清空可撤销
- 公交/地铁多方案、步行路线、地图折线与步骤列表
- 当前天气 + 7 日预报（Open-Meteo）
- 本地草稿/收藏/搜索历史；分享链接、复制行程
- 桌面/移动端响应式；移动端地图顶部搜索条

## 快速开始

要求 Node >= 22.13、pnpm 11。

```bash
pnpm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
# 填入 VITE_AMAP_KEY 与 VITE_AMAP_SECURITY_CODE
pnpm dev
```

需要一个高德 **Web端(JS API)** Key 和安全密钥。创建步骤、域名白名单与部署见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## Key 与费用

仓库不内置高德 Key，也没有维护者付费的公共演示站。每个部署者使用自己的 Key：

- 访问别人部署的站点：不需要注册 Key。
- 自己部署：每个部署实例需要一个 Key，并承担对应配额与费用。
- 不要把 Key 提交到仓库或发给别人；`.env.local` 已被 Git 忽略。

个人认证、非商业用途有 1 年免费月配额（自注册认证起算），其中搜索 5,000 次/月、基础 LBS 15 万次/月、地图初始化 150 万次/月。超量、到期、公开长期运营或商业使用，需要按量付费或购买技术服务许可。以高德控制台为准：[调用价格](https://developer.amap.com/upgrade#price)、[技术服务许可](https://lbs.amap.com/pages/authorization/)。

## 命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 本地开发服务器 |
| `pnpm build` | 构建到 `dist/` |
| `pnpm test` | Vitest 单元测试 |
| `pnpm verify` | 类型检查 + 单测 + 密钥扫描 + 构建 |

`pnpm verify` 是 CI 与发布前的统一检查。

## 目录

```text
src/core        纯逻辑：坐标/城市/天气解析/收藏/草稿/分享/行程文本
src/amap        高德 JS API 加载、地图、搜索、地理编码、路线适配
src/hooks       天气与路线请求状态
src/components  UI 组件
src/state       planner reducer
```

## 数据来源

- 高德地图 JS API v2：地图、POI、地理编码、公交与步行路线
- Open-Meteo：天气；界面保留数据来源与 CC BY 4.0 标识

Open-Meteo 免费公共端点仅供非商业用途；带广告、订阅或商业产品发布时，应改用其商业订阅端点和 Key。

## 文档

- 部署、Key 与配额：[DEPLOYMENT.md](DEPLOYMENT.md)
- 安全边界：[SECURITY.md](SECURITY.md)
- 重构规格与验收记录：[docs/web-rewrite.md](docs/web-rewrite.md)
