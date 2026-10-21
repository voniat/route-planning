# Web 版重构规格：旅行路线规划（核心首版）

- 状态：核心首版已实施（2026-10-21）
- 日期：2026-10-21
- 本文件是本轮重构的唯一设计文档；后续实施计划追加到本文件，不新建同主题文档。
- 旧实现（微信小程序 + 云函数代理）保留在 git 历史与 GitHub，最终树中删除。

## 1. 目标

把「旅行路线规划」从微信小程序迁成独立的浏览器应用：打开网页即可选城市、搜索或点地图加点、排序途经点、查看公交/地铁与步行路线、看天气、收藏路线、用链接分享行程。无后端、无小程序运行时、无微信专属 API。

成功标准：核心主流程在桌面与手机浏览器可用；构建产物是纯静态文件；仓库中不再有 `wx.*`、小程序配置或云函数代理。

## 2. 范围

### 2.1 本次包含

- 地图展示与定位（高德 JS API v2）
- 城市级选择（默认北京）
- POI 搜索 + 输入提示 + 搜索历史
- 搜索添加、地图一次性选点添加（反地理编码取地址）
- 途经点列表：删除、指针拖拽排序、键盘排序、最多 20 点
- 路线：按路段按需计算，公交/地铁（多方案）与步行；地图折线与步骤列表
- 天气：当前位置/城市 7 日预报（Open-Meteo 直连）
- 草稿自动保存与恢复、收藏（最多 50 条）
- 分享链接（URL 参数）还原路线的点与城市、复制行程文本
- 文档、CI、密钥扫描、单元测试

### 2.2 本次不做

- 分享卡图片、时间排期与自动填充、出发/行程模式、POI 区域高亮
- 全程路线耗时汇总与预计算（只计算当前选中路段）
- 搜索结果照片预览
- 账号、云同步、后端、PWA/离线、暗色主题、国际化
- 旧小程序收藏/草稿迁移、旧分享卡片兼容

## 3. 技术基线

- Node >= 22.13；pnpm 11（提交 `pnpm-lock.yaml`，`package.json` 声明 `packageManager`；CI 用 Node 22 LTS）
- React 19 + TypeScript 5（strict）+ Vite 7 + Vitest 3
- 运行时零状态库、零 UI 库、零地图 loader 依赖；手写高德脚本加载器
- 目标浏览器：Chrome/Edge/Safari/Firefox 最近两个版本；不支持 IE
- 部署：任意静态托管（HTTPS）；本地 `pnpm dev`

## 4. 仓库布局

```text
index.html
package.json
pnpm-lock.yaml
vite.config.ts
tsconfig.json
.env.example                 # 占位值，提交
.env.local                   # 真实 Key，gitignore
src/
  main.tsx
  App.tsx
  vite-env.d.ts
  state/planner.ts           # 类型、reducer、动作
  core/
    points.ts                # 校验、归一化、ID、上限
    cities.ts                # 城市表 + 坐标 + 查找
    weather.ts               # 预报解析（纯函数）
    favorites.ts             # 收藏仓库（注入 Storage）
    storage.ts               # 安全 JSON 读写 + 键名
    share.ts                 # 分享参数编解码
    format.ts                # 距离/时长格式化
  amap/
    load.ts                  # 脚本加载、插件、超时
    types.ts                 # 仅本项目用到的最小类型
    map.ts                   # 地图实例、marker/polyline 同步
    search.ts                # PlaceSearch / AutoComplete 适配
    route.ts                 # Transfer / Walking 适配为视图模型
    geocode.ts               # 逆地理编码
  components/
    MapView.tsx  SearchOverlay.tsx  CityDialog.tsx
    PointList.tsx  RoutePanel.tsx  SavedPanel.tsx
    WeatherCard.tsx  Toast.tsx  Dialog.tsx  EmptyState.tsx
  styles/tokens.css  styles/app.css
scripts/security-check.mjs
docs/web-rewrite.md
```

测试与被测模块同目录（`*.test.ts`），Vitest `environment: 'node'`，不引入 jsdom。

## 5. 数据契约

```ts
type Point = {
  id: string            // crypto.randomUUID()，不可用则时间戳+序号
  title: string         // 最长 100 字
  lat: number
  lng: number
  address?: string
}

// 沿用现有数据的形状，避免重写 340 条城市数据
type ProvinceData = { prov: string; cities: string[] }
type City = { name: string; lat: number; lng: number }
function findCity(name: string): City | null

type StepView = {
  key: string
  mode: 'WALKING' | 'TRANSIT'
  title: string
  distanceM?: number
  durationMin?: number
  lineName?: string
  lineColor?: string
  transitType?: string
  fromStation?: string
  toStation?: string
  stations?: number
}

type PolylineView = { path: [number, number][]; color: string; width: number; dotted?: boolean }  // path 为 [lng, lat]

type PlanView = {
  id: string
  cost: number | null
  durationMin: number
  distanceKm: string
  steps: StepView[]
  polylines: PolylineView[]
}

type WalkingView = { durationMin: number; distanceKm: string; polyline: PolylineView }

type WeatherView = {
  current: { temperature: number; apparent: number; wind: number; text: string; icon: string }
  days: { date: string; label: string; text: string; icon: string; high: number; low: number; rain: number }[]  // 最多 7 天
}
```

`amap/*` 是唯一允许接触 SDK 对象的层；其对外只返回上述视图模型或抛出 `AppError`。

```ts
class AppError extends Error {
  code: 'AMAP_LOAD' | 'GEO' | 'SEARCH' | 'ROUTE' | 'WEATHER' | 'STORAGE'
}
```

## 6. 模块边界

- `core/*`：纯函数或注入 `Storage` 的仓库；不引用 DOM、`window`、`import.meta.env`、SDK。可被单测直接调用。
- `amap/*`：脚本加载、类型适配、错误归一化。组件不读 SDK 回调字段。
- `state/planner.ts`：`Point[]`、`City`、草稿与收藏动作；异步请求状态不进入该 reducer。
- `components/*`：只接收 props、发事件；不直接读写 localStorage（收藏/草稿通过 core 仓库）。
- `App.tsx`：组合地图、面板、覆盖层与异步副作用；请求用递增 `requestId` 防竞态。

## 7. 交互规格

### 7.1 布局

- 桌面（≥ 900px）：左侧 400px 操作栏（城市、搜索入口、途经点、主要操作），右侧地图铺满；天气卡片浮于地图右上；地图显示缩放控件（`AMap.ToolBar`）。
- 移动（< 900px）：地图铺满；顶部城市 + 搜索条；底部可折叠面板（默认 40dvh，最高 60dvh，内部滚动）；路线详情在面板内替换列表并提供返回。
- 浮层：搜索、城市、收藏均为模态；使用原生 `<dialog>` + `showModal()`，Esc 关闭，焦点回到触发按钮。

### 7.2 选点

- 搜索：输入 300ms 防抖取输入提示；回车或点按钮取 POI 结果；结果按 4 位小数坐标去重（约 11m），已添加的点标注「已添加」；点击即添加并关闭搜索。
- 搜索历史：面板展示最近 10 条，点选回填并搜索，可单条删除或清空。
- 地图加点：点击「＋ 地图选点」进入一次性模式（十字光标 + 顶部提示），点击地图后反地理编码并弹确认框；确认才添加，取消退出模式。
- 添加上限 20，重复坐标（4 位小数内）给出提示不重复添加。
- 首次加载：定位成功则地图移到当前位置并尝试匹配城市；失败或被拒保持北京并给出可关闭提示。
- 城市选择：省份 + 城市两级原生 `<select>`，确认后地图移到城市中心、天气按城市刷新；不提供「全国」，默认北京。城市切换不清空已有点，但清空路线缓存与结果；路线面板打开时按新城市重新请求当前路段。

### 7.3 途经点与排序

- 列表展示序号（起/终/中途）、标题、地址；单点删除即时生效并 toast。
- 指针拖拽手柄排序；手柄可聚焦，↑/↓ 键移动；移动后用 aria-live 播报「已移动到第 N 位」。
- 「清空全部」需确认。

### 7.4 路线

- 地图与列表共用「当前路段」；打开路线面板默认选中第 1 段；路段 tab 选定后才请求（公交方案或步行），成功结果按 `路段索引+模式+城市+坐标` 缓存于会话内存。任一点新增、删除或排序后，清空路线缓存与当前路线状态。
- 公交面板：方案 tab（费用、耗时）、步骤列表（步行/公交/地铁/火车标识、上下车站、站数）、地图折线按线路名分配颜色；方案切换不重新请求。
- 步行面板：总距离/耗时 + 折线。
- 请求中禁用重复触发；过期响应（`requestId` 不匹配）丢弃；失败就地显示重试，不清空已有点。

### 7.5 天气

- 当前温度/体感/风速/天气 + 展开 7 日（日期标签、最高最低、降水概率）。
- 城市或定位变化时请求；失败显示「重试」，不阻塞其他功能。

### 7.6 收藏与分享

- 收藏名称：默认「首点标题 等N站」，保存时可编辑；列表显示名称、城市、点数、保存时间；加载后替换当前点与城市并把地图适配到点范围；删除需确认。
- 分享按钮：把当前点与城市写入 URL 并复制到剪贴板（`navigator.clipboard`，失败回退为展示可复制文本）。
- 复制行程：生成「城市 · N 个地点」+ 逐点「序号. 标题」文本写入剪贴板，失败回退为展示文本。

### 7.7 视觉与无障碍

- 设计 token：主色 `#1989fa`、成功 `#07c160`、危险 `#e64340`、背景 `#edf0f5`、白卡片、12/16px 圆角、4/8/12/16/24 间距；系统字体栈；卡片轻阴影。沿用现有小程序的地图优先、白卡片视觉。
- 语义按钮与 `aria-label`；可见 focus ring；图标按钮有文字或可访问名称；错误与状态不只靠颜色。
- 主操作目标 ≥ 40×40px；正文对比度达到 WCAG AA；`prefers-reduced-motion` 下减少过渡。
- 键盘：可完成搜索、添加、排序、切换路线、关闭浮层；加载与 toast 用 `aria-live="polite"`。

## 8. 状态与错误矩阵

| 条件 | 界面 | 恢复 |
| --- | --- | --- |
| 缺少 Key | 地图区显示配置说明卡片 | 按文档配置 `.env.local` 后刷新 |
| 高德脚本失败/8s 超时 | 同上 + 重试按钮 | 重试；检查域名白名单/网络 |
| 定位不可用或被拒 | 地图仍加载，城市保持北京 | 可关闭的提示；手动选城市 |
| 搜索失败 | 搜索面板内错误 + 重试 | 保留关键词 |
| 路线失败 | 当前路段错误 + 重试 | 保留点与模式 |
| 天气失败 | 卡片错误 + 重试 | 保留城市 |
| 收藏/草稿写入失败 | toast 提示存储不可用 | 内存模式继续，不崩溃 |
| 分享参数无效 | 忽略分享，加载草稿，toast 说明 | 正常编辑 |
| 无点 | 空状态提示「搜索或点地图添加地点」 | — |
| 单点 | 空状态提示「至少 2 个点才能规划路线」 | — |

## 9. 持久化与分享

- 键：`rp:v1:draft`、`rp:v1:favorites`、`rp:v1:search-history`；全部带版本号。
- 草稿：`{ points, city, savedAt }`；点或城市变化后 300ms 防抖写入；分享成功解析后不恢复草稿。
- 收藏：`{ id, name, city, points, savedAt }[]`；上限 50，超出删最旧并 toast；读取时逐条校验，损坏条目丢弃。
- 搜索历史：`string[]`，上限 10，可单条删除或清空。
- 分享：`?p=[[title,lat,lng],...]&c=<城市>`；标题截 8 字、最多 20 点、总查询串 < 2200 字符；数组长度必须为 3，坐标合法，城市必须在城市表内；解析成功后先立即写入草稿，再 `history.replaceState` 清除参数，避免刷新重复应用。
- 存储读取使用安全 JSON 解析；`localStorage` 抛错时降级为内存并提示一次。

## 10. 密钥与安全

- `.env.local`：`VITE_AMAP_KEY`、`VITE_AMAP_SECURITY_CODE`；`.env.example` 只放 `your-...` 占位；`.env.local` 已在 `.gitignore`。
- 加载顺序：先设置 `window._AMapSecurityConfig = { securityJsCode }`，再插入 JS API 脚本；插件通过脚本 `plugin` 参数一次加载：`AMap.Transfer,AMap.Walking,AMap.PlaceSearch,AMap.AutoComplete,AMap.Geocoder,AMap.ToolBar`。
- 前端 Key 公开是高德 Web端 Key 的设计；缓解手段是控制台域名白名单 + 配额/告警。**不得**在前端放 Web 服务 Key；旧云函数代理删除后，其环境变量一并从云控制台移除。
- `scripts/security-check.mjs`：扫描 git 跟踪与待提交文件，拒绝跟踪 `.env*`、`project.private.config.json`、证书/私钥文件；检测常见密钥模式与 `VITE_AMAP_KEY=<32位十六进制>` 形式的硬编码；检测 `src/` 中出现 `restapi.amap.com`（说明误用了 Web 服务）。
- 依赖策略：只允许 React 运行依赖 + Vite/TS/Vitest 构建依赖；新增依赖需说明替代的自写成本。

## 11. 验证与验收

### 11.1 命令

```bash
pnpm install
pnpm dev        # 本地开发
pnpm test       # Vitest
pnpm build      # 静态产物 dist/
pnpm verify     # tsc --noEmit && vitest run && node scripts/security-check.mjs && vite build
```

### 11.2 单元测试

- `points`：非法坐标过滤、ID 去重、20 点上限、标题截断。
- `cities`：北京存在且坐标正确、每个省份至少一个城市、城市坐标表无缺失、不含「全国」。
- `weather`：移植现有 7 日/当前/标签用例，异常输入抛错。
- `favorites`：注入假 Storage；上限淘汰、损坏数据过滤、按 id 删除/读取。
- `share`：编解码往返、超长返回 null、畸形参数返回 null、坐标/城市校验。
- `amap/route`：适配器映射用 fixture 覆盖（首次联调捕获真实响应后补；若无法捕获，记录为未覆盖项并在手工验收中确认）。

### 11.3 验收标准

- **AC1** 干净检出后 `pnpm install && pnpm verify` 通过。
- **AC2** 配置真实 Key 后地图正常渲染，默认北京，无控制台报错。
- **AC3** 搜索添加点、重复点提示、20 点上限生效。
- **AC4** 拖拽与键盘排序后 marker 顺序、草稿与刷新后顺序一致。
- **AC5** 公交方案可切换，步骤/折线正确；切换路段/模式不串数据。
- **AC6** 步行路线显示距离、耗时与折线。
- **AC7** 天气显示当前 + 7 日；失败可重试。
- **AC8** 草稿刷新恢复；收藏新增/加载/删除持久化；第 51 条淘汰最旧。
- **AC9** 分享链接在新标签页还原同点与城市；复制行程生成含全部点的文本；畸形/超长链接被忽略并恢复草稿。
- **AC10** 缺 Key、脚本失败、定位拒绝三种情况都有可恢复提示。
- **AC11** 360–430px 与 1280px 视口无横向溢出，主操作可达；仅键盘可完成搜索、排序、关闭浮层。
- **AC12** `pnpm build` 产物为纯静态；仓库无 `wx.*`、无小程序配置、无云函数代理、无 Web 服务 Key。

### 11.4 证据边界

本机没有浏览器自动化环境，AC2–AC11 需要在提供真实 Key 的浏览器中手工验证并记录结果；自动化只覆盖 AC1、单元逻辑与构建/密钥扫描。高德回调结构以联调实测为准，适配层负责隔离；首次联调后补 fixture 测试。

## 12. 删除与迁移

- 删除：`pages/`、`components/`、`app.js`、`app.json`、`app.wxss`、`project.config.json`、`sitemap.json`、`serverless/`、`scripts/check.js`、旧 `utils/` 与旧 `test/`。
- 保留并改造：`scripts/security-check.js` → `security-check.mjs`。
- 文档：更新 [AGENTS.md](../AGENTS.md)（新栈、新命令、移除 wx 规则）、[README.md](../README.md)、[DEPLOYMENT.md](../DEPLOYMENT.md)、[SECURITY.md](../SECURITY.md)、[.github/workflows/ci.yml](../.github/workflows/ci.yml)。
- `.gitignore`：加入 `.env.local`、`dist/`；保留 `node_modules/`、证书/私钥模式、`.env*`。
- 不迁移旧小程序本地收藏/草稿；旧分享卡片作废。
- 部署侧：旧腾讯云函数与代理环境变量在确认新站可用后删除（用户手工操作，文档给出清单）。

## 13. 提交策略

- 在 `main` 上分片提交，每片 `pnpm verify` 通过后 `git commit` 并 `git push origin main`，遵循 `类型: 中文描述`。
- 分片：脚手架与验证 → 核心纯逻辑与单测 → 地图与搜索选点 → 列表排序与草稿 → 路线面板与折线 → 天气/收藏/分享 → 删除旧壳与文档收尾。
- 回滚：`git revert` 最后一片即可恢复旧小程序实现；旧实现始终可从 git 历史取回。

## 14. 风险与开放项

- **高德 JS API 回调结构**：本机网络无法访问高德官方文档，插件字段以联调实测为准；适配层隔离，发现差异只改 `amap/route.ts` 与 fixture。
- **域名白名单**：本地开发需确认控制台是否支持 `localhost`；不支持时用 `127.0.0.1` 或临时开发域名验证（联调首日确认）。
- **前端 Key 滥用**：白名单 + 低配额 + 告警；不承诺匿名用户不可提取 Key。
- **定位依赖 HTTPS**：本地 localhost 可用，部署必须 HTTPS。
- **Open-Meteo 网络可达性**：被拦截时天气降级为错误 + 重试，不影响地图与路线。
- **无浏览器自动化**：交互验收依赖手工清单，不能声称已自动验证。

## 15. 实施计划

> 本节由 writing-plans 生成；需求见 §1–14，批准于 2026-10-21。按 Task 1 → 7 顺序执行，每片 `pnpm verify` 通过后提交。推送暂受 GitHub `GH007`（当前提交邮箱被视为私有）阻塞，先本地提交，待用户修复设置或提供 noreply 地址后统一补推。

### 15.1 就绪与边界

- **Requirement Ready Check**：来源=本文件 §1–14；范围=§2.1；场景=§7；验收=AC1–AC12。唯一外部前置是手工验收用高德 Web端 Key 与域名白名单，不阻塞编码。
- **TDD Route**：mode=off（会话声明）；decision=skipped；authority=项目 TDD 关闭；posture=核心纯逻辑配单测，其余靠 `pnpm verify` + 手工验收；不设置 RED/GREEN 步骤。
- **Change Necessity**：浏览器版没有现存实现，必须新增 `src/` 与构建链；旧壳删除放在最后一片。最小边界=前端源码 + 验证脚本 + CI/文档。
- **Ripple Signal Triage**：新增持久化键（owner `core/storage.ts`）、新增 Amap 适配契约（owner `amap/route.ts`）、删除旧 owner（小程序壳与代理）。点/城市状态源=`state/planner.ts`；路线视图只由 `amap/route.ts` 产出；组件不直接读 SDK 或 localStorage。
- **兼容边界**：本地存储与分享链接不与小程序兼容；旧实现由 git 历史保留；不加兼容分支。
- **Baseline refs**：本文件（规格提交 `dbe9db0`）、当前 `main`（`5a5a792`）、现有 11 个测试与纯逻辑实现。
- **执行路由**：inline（顺序任务，无并行写入）。User confirmation required: no；Key 由用户在 Task 3 前提供，未提供时 AC2–AC6 记为未验证。
- **Complexity Budget**：Task 1 脚手架 ≤ 18 个文件；其余每片 ≤ 14 个；UI 组件单片 ≤ 5 个；`App.tsx` 只做组合与副作用；单组件 > 250 行即拆分；不做兼容层或回退实现。
- **Amap 未知量**：Task 3 联调首日确认 `Transfer`/`Walking` 回调字段；差异只改 `amap/route.ts`、`amap/types.ts`，并补 fixture。

### 15.2 Task 1：脚手架与验证链

**Purpose**：新应用可构建、可测试、CI 与密钥扫描可运行；旧小程序文件暂不动。

**Files**：`package.json`、`pnpm-lock.yaml`、`tsconfig.json`、`vite.config.ts`、`index.html`、`.env.example`、`.gitignore`、`scripts/security-check.mjs`、`.github/workflows/ci.yml`、`src/main.tsx`、`src/App.tsx`、`src/vite-env.d.ts`、`src/core/format.ts`、`src/core/format.test.ts`、`src/styles/tokens.css`、`src/styles/app.css`、`docs/web-rewrite.md`

**Steps**

1. 替换 `package.json`：React 19 运行依赖；`@vitejs/plugin-react`、`typescript`、`vite`、`vitest`、`@types/react`、`@types/react-dom` 开发依赖；`packageManager: pnpm@11.20.0`；脚本 `dev/build/preview/test/typecheck/security/verify`（`verify = tsc --noEmit && vitest run && node scripts/security-check.mjs && vite build`）。
2. 新增 TS/Vite 配置：strict、`jsx: react-jsx`、`moduleResolution: bundler`；Vitest `environment: 'node'`、`include: ['src/**/*.test.ts']`。
3. 新增最小 React 壳：`index.html`、`main.tsx`、占位 `App.tsx`、tokens/app CSS、`vite-env.d.ts`。
4. `core/format.ts`（`formatDistance`、`formatDuration`）与单测；保证 Task 1 就有测试可跑。
5. 把 `scripts/security-check.js` 改写为 ESM `security-check.mjs`：沿用敏感文件/密钥规则，新增 `VITE_AMAP_KEY=<32 位十六进制>` 硬编码检测与 `src/` 中 `restapi.amap.com` 检测。
6. `.env.example` 写 `your-...` 占位；`.gitignore` 加 `.env.local`、`dist/`。
7. CI 改为 pnpm 11 + Node 22 + `pnpm install --frozen-lockfile` + `pnpm verify`。
8. `pnpm install` 生成并提交锁文件；`pnpm verify` 全绿。

**Verify**：`pnpm verify` 通过；`dist/` 生成；`git status` 只含预期文件。
**Commit**：`chore: 引入 Vite + React + TypeScript 脚手架与验证链`

### 15.3 Task 2：核心纯逻辑与单元测试

**Purpose**：把可移植规则落到 `core/*`，UI 之前先锁住行为。

**Files**：`src/core/errors.ts`、`points.ts`、`cities.ts`、`storage.ts`、`weather.ts`、`favorites.ts`、`share.ts` 及各自 `*.test.ts`；`src/core/cities.ts` 复用现有城市与坐标数据（删除「全国」项）。

**Steps**

1. `errors.ts`：`AppError`（code 见规格 §5）。
2. `points.ts`：`MAX_POINTS=20`、`createPointId`、`isValidCoordinate`、`normalizePoints`（4 位小数去重、标题 100 字、过滤非法坐标）。
3. `cities.ts`：`PROVINCE_DATA`、`CITY_COORDS`、`findCity`、`DEFAULT_CITY`（北京）；测试覆盖坐标完整性。
4. `storage.ts`：`StorageLike` 接口、键名常量、安全 JSON 读写、内存回退。`favorites.ts` 注入 `StorageLike`，实现 list/add/remove/getById、50 条淘汰、损坏数据过滤。
5. `weather.ts`：移植 `parseForecast`/`describeCode`，输出 `WeatherView`，不做网络请求。
6. `share.ts`：`encodeShare(points, city)`（超长/空点返回 null）与 `decodeShare(search)`（校验数组、坐标、城市）。
7. 单测覆盖规格 §11.2 的 points/cities/weather/favorites/share 项。

**Verify**：`pnpm test` 通过；`pnpm verify` 通过。
**Commit**：`feat: 移植核心纯逻辑与单元测试`

### 15.4 Task 3：地图、定位、搜索与选点

**Purpose**：真实地图可加载，能把点加进状态；缺 Key/定位失败有恢复路径。

**Files**：`src/amap/load.ts`、`types.ts`、`map.ts`、`search.ts`、`geocode.ts`；`src/state/planner.ts`；`src/components/MapView.tsx`、`SearchOverlay.tsx`、`CityDialog.tsx`、`Dialog.tsx`、`Toast.tsx`；`src/App.tsx`（接线）；`src/styles/app.css`。

**Steps**

1. `load.ts`：校验 `VITE_AMAP_KEY`/`VITE_AMAP_SECURITY_CODE`；设置 `_AMapSecurityConfig`；插入 v2 脚本（插件列表见规格 §10）；8s 超时；失败抛 `AppError('AMAP_LOAD')`。
2. `types.ts`：仅覆盖用到的 `Map/Marker/Polyline/PlaceSearch/AutoComplete/Geocoder/Transfer/Walking/ToolBar` 形态。
3. `map.ts`：创建地图、ToolBar、marker/polyline 同步、`fitView(points)`、点击事件订阅；不把 SDK 对象交给组件。
4. `search.ts`：`searchPlaces(kw, city)`、`inputTips(kw, city)`，输出 `{title,address,lat,lng}` 列表，4 位小数去重、标记已添加。
5. `geocode.ts`：坐标 → 地址；城市名解析用于定位后匹配。
6. `state/planner.ts`：`{ city, points }` reducer 与增删/排序/替换动作。
7. UI：MapView 容器 + 加载/缺 Key 卡片；SearchOverlay（历史 10 条、建议、结果、已添加标记）；CityDialog（两级 select）；Dialog/Toast 基础件。
8. 定位：成功则居中并尝试匹配城市；拒绝/超时保持北京并提示；地图选点一次性模式 + 反地理编码确认。
9. 首次联调：确认 `Transfer/Walking` 字段；若与类型不符只改 `amap/*`，记录差异。

**Verify**：`pnpm verify` 通过；提供 Key 后手工 AC2、AC3、AC10（缺 Key/定位拒绝部分）。
**Commit**：`feat: 接入高德地图、城市定位与地点搜索`

### 15.5 Task 4：途经点列表、排序与草稿

**Purpose**：点的管理闭环，刷新不丢。

**Files**：`src/components/PointList.tsx`、`EmptyState.tsx`；`src/core/draft.ts` + `draft.test.ts`；`src/App.tsx`；`src/styles/app.css`。

**Steps**

1. `draft.ts`：`loadDraft()`/`saveDraft(points, city)`，300ms 防抖由调用方负责，校验失败返回 null。
2. PointList：序号/标题/地址、删除、清空确认、拖拽手柄（pointer events）+ 键盘 ↑/↓、移动后 aria-live 播报。
3. 接线：点/城市变化写草稿；启动时无有效分享参数则恢复草稿；单点/无点空状态。
4. 地图与列表同步：点顺序变化后重设 marker 与视野。

**Verify**：`pnpm verify`；手工 AC4、AC8（草稿部分）、AC11（列表部分）。
**Commit**：`feat: 途经点列表、拖拽排序与草稿持久化`

### 15.6 Task 5：公交/步行路线面板与地图折线

**Purpose**：核心路线能力；适配层锁住 SDK 形态。

**Files**：`src/amap/route.ts`；`src/amap/route.test.ts`（联调捕获 fixture 后补用例）；`src/hooks/useRoutePlans.ts`；`src/components/RoutePanel.tsx`；`src/App.tsx`；`src/styles/app.css`。

**Steps**

1. `route.ts`：`getTransitPlans(origin, dest, city)`→`PlanView[]`；`getWalkingPlan(origin, dest)`→`WalkingView`；步骤、费用、耗时、折线、线路颜色映射；错误归一化为 `AppError('ROUTE')`。
2. `useRoutePlans.ts`：按路段按需请求、会话缓存 key、`requestId` 防竞态、错误/重试状态。
3. RoutePanel：路段 tab、公交/步行 tab、方案切换、步骤列表、加载/错误/空状态；打开默认第 1 段。
4. 地图折线随方案/模式切换；点变更清空缓存。
5. 联调后捕获脱敏响应，补 `route.test.ts` fixture 用例；未捕获前在验收记录中记为未覆盖。

**Verify**：`pnpm verify`；手工 AC5、AC6。
**Commit**：`feat: 公交/步行路线面板与地图折线`

### 15.7 Task 6：天气、收藏、分享与复制行程

**Purpose**：补齐首版外围功能与恢复路径。

**Files**：`src/hooks/useWeather.ts`；`src/components/WeatherCard.tsx`、`SavedPanel.tsx`；`src/core/favorites.ts`（已建，接线）；`src/core/share.ts`（已建，接线）；`src/App.tsx`；`src/styles/app.css`。

**Steps**

1. `useWeather.ts`：Open-Meteo `fetch`（current/daily/timezone=auto/forecast_days=7），`AbortController` 防旧响应；成功后 `parseForecast`；失败可重试；不做客户端缓存。
2. WeatherCard：当前天气 + 7 日折叠；加载/错误态。
3. 收藏：保存（名称可编辑）、列表、加载（替换点/城市并 fitView）、删除确认；50 条淘汰提示。
4. 分享：生成 URL、复制剪贴板、失败回退文本；启动时解析并立即写草稿后 `replaceState`。
5. 复制行程：文本生成 + 剪贴板回退。
6. 错误矩阵（规格 §8）逐项接线。

**Verify**：`pnpm verify`；手工 AC7、AC8（收藏）、AC9、AC10（天气/分享）。
**Commit**：`feat: 天气、收藏、分享链接与行程复制`

### 15.8 Task 7：删除旧壳、文档与最终验收

**Purpose**：完成迁移，仓库只剩浏览器应用；给出可复现的验收记录。

**Files**：删除 `pages/`、`components/`、`utils/`、`test/`、`serverless/`、`app.js`、`app.json`、`app.wxss`、`project.config.json`、`sitemap.json`、`scripts/check.js`、本地 `utils/config.js`；更新 `AGENTS.md`、`README.md`、`DEPLOYMENT.md`、`SECURITY.md`、`.github/workflows/ci.yml`、`docs/web-rewrite.md`（验收记录）。

**Steps**

1. 删除旧壳与代理；确认无残留引用。
2. 更新 AGENTS.md：新栈、命令、密钥、提交规范；删除 wx 规则。
3. 更新 README/DEPLOYMENT/SECURITY：功能、启动、Key 与白名单、静态托管、旧云函数下线清单、前端 Key 风险。
4. 跑 AC12 检查：`pnpm verify`、`git grep -n "wx\\."`、`git grep -n "restapi.amap.com"`、检查无 Web 服务 Key。
5. 记录手工验收证据（AC2–AC11 实际结果与未覆盖项）到本文档；未提供 Key 时明确标记未验证。

**Verify**：`pnpm verify`；AC12 自动检查；文档链接有效。
**Commit**：`refactor: 删除小程序壳与云函数代理，更新项目文档`

### 15.9 验收映射

| AC | Task | 证据 |
| --- | --- | --- |
| AC1 | 1 | `pnpm verify` |
| AC2、AC3 | 3 | 真实 Key 手工验收 |
| AC4、AC8 草稿 | 4 | 手工 + `draft` 单测 |
| AC5、AC6 | 5 | 手工 + `route` fixture |
| AC7、AC8 收藏、AC9 | 6 | 手工 + `favorites/share` 单测 |
| AC10 | 3、6 | 手工 |
| AC11 | 4、6 | 手工（360–430px、1280px、仅键盘） |
| AC12 | 7 | `pnpm verify` + 检索 |

### 15.10 退役与回滚

- 退役：Task 7 删除小程序壳、代理、旧脚本与旧测试；云函数与代理环境变量由用户在确认新站后手工删除。
- 回滚：`git revert` Task 7 提交即可恢复旧实现；Task 1–6 不改动旧小程序源码文件。
- 无兼容层、无双写、无旧存储迁移。

### 15.11 计划自审

- 范围覆盖：§2.1 全部条目均落到 Task 1–7；AC1–AC12 有映射。
- 无占位符；文件路径与命令具体；TDD 路由已记录为 skipped。
- 兼容/退役明确；不新增后端、不新增兼容分支。
- 剩余风险：Amap 回调字段（Task 3/5 联调确认）、Key 与域名白名单（用户前置）、推送 GH007（用户修复后补推）、无浏览器自动化（手工验收）。

### 15.12 执行状态

- 2026-10-21：规格与计划已提交并推送（`dbe9db0`、`bdf1c2f`、`21cbcff`）；GitHub GH007 已由用户修复。
- Task 1 完成：`pnpm verify` 通过（TypeScript、7 个单测、密钥扫描、`vite build` 222.77 kB / gzip 69.52 kB）。npm registry 通过项目级未跟踪的 `.dsh/rules.yaml` 放行。
- Task 2 完成：`core/*` 纯逻辑（points/cities/storage/weather/favorites/share）与 39 项单测通过。
- Task 3 完成（代码）：地图加载/重试、定位、城市选择、搜索与建议、地图选点；`pnpm verify` 通过（构建 257.30 kB / gzip 83.10 kB）。AC2/AC3 待真实高德 Key 手工验收。
- Task 4 完成：途经点列表、指针拖拽 + 键盘排序、删除/清空确认、草稿 300ms 防抖恢复；42 项单测通过。
- Task 5 完成并手工验收：无头浏览器实测公交 5 个方案（费用/换乘/站点/步骤），步行 91 分钟 / 6.8 km，地图折线与起终点标记正常；46 项单测通过。高德真实结构：`plans[].segments[].transit_mode` + `transit.{path,lines,on_station,off_station,via_num}`，步行 `routes[].steps[].path`。
- Task 6 完成并手工验收：Open-Meteo 当前天气 + 7 日预报；收藏保存/列表/加载/删除；分享链接生成、刷新还原并清除参数；复制行程在剪贴板不可用时弹出手动复制文本。53 项单测通过（含搜索 `poiList` 修复）。
- Task 7 完成：删除旧小程序壳、云函数代理、旧脚本与旧测试；重写 AGENTS/README/DEPLOYMENT/SECURITY；旧路径引用检索为空；`pnpm verify` 通过（11 个测试文件、53 项测试、密钥扫描、构建 284.95 kB / gzip 91.75 kB）。
- CI 工作流修复：`32532ef` 去掉重复的 pnpm 版本输入，统一由 `packageManager` 决定。

### 15.13 验收记录（2026-10-21）

| AC | 结果 | 证据 / 未覆盖 |
| --- | --- | --- |
| AC1 | 通过 | `pnpm verify`：类型检查、53 项单测、密钥扫描、构建全部通过 |
| AC2 | 通过 | 真实 Key 的无头 Chrome 加载地图与缩放控件，1280×860 截图正常 |
| AC3 | 部分通过 | 搜索「天安门」返回结果并添加 1 点，清空后 0 点、草稿移除；重复点与 20 点上限未单独实测 |
| AC4 | 部分通过 | 草稿恢复已验证；指针拖拽与键盘排序未自动化实测 |
| AC5 | 部分通过 | 5 个公交方案、步骤/站点/费用与折线已验证；方案切换、路段切换未单独实测 |
| AC6 | 通过 | 步行 91 分钟 / 6.8 km，地图折线正常 |
| AC7 | 通过 | 北京 10°C、体感/风速与 7 日预报正常；失败重试未实测 |
| AC8 | 部分通过 | 收藏保存/列表/加载/删除、草稿恢复均已实测；51 条淘汰仅有单测 |
| AC9 | 通过 | 分享 URL 生成、刷新还原、参数清除；剪贴板失败时手动复制弹窗文本正确 |
| AC10 | 部分通过 | 存储/剪贴板降级有实现；缺 Key、脚本失败、定位拒绝未全部实测 |
| AC11 | 部分通过 | 1280px 桌面截图通过；360–430px 与仅键盘操作未实测 |
| AC12 | 通过 | 删除旧壳与代理后 `pnpm verify` 通过；旧路径引用检索为空 |

未覆盖的手工验收项：指针拖拽/键盘排序、公交方案与路段切换、移动端 360–430px、缺 Key/定位拒绝/天气重试。需要在真实浏览器中补测。

- 下一切片：无；核心首版完成，旧版资源下线由用户按 DEPLOYMENT.md 执行。

### 15.14 后续优化（2026-10-21）

- P0 分享状态：生成分享链接不再改写地址栏；剪贴板失败走手动复制弹窗，避免刷新时旧分享参数覆盖更新的草稿。
- P0 配置识别：`hasAmapKey` 将 `your-` / `replace-` 占位值视为未配置，复制 `.env.example` 后未填写会显示配置提示而不是脚本错误。
- P1 标记交互：点击地图标记会选中对应途经点并滚动到列表项；路线面板打开时点击标记会返回规划视图。
- P1 可访问性：路线面板的路段/方式/方案选择从不完整的 ARIA tab 改为 `aria-pressed` 按钮组。
- P1 分享长度：20 点长标题超出 2200 字符时自动退回 4 字标题，避免整条链接不可用。
- P1 移动端：390×844 实测无横向溢出；方案切换、路段切换、分享降级在无头浏览器中验证。
- 后续 UX：地图浮动定位按钮与「以当前位置为起点」；移动端地图顶部城市/搜索条；删除/清空支持 4.5 秒撤销；加载收藏前确认；分享优先 `navigator.share`，不支持再复制/手动弹窗。
- 视觉刷新（2026-10-21）：暖纸/砖红/墨色主题，品牌题头，点位列表面板，侧栏固定主 CTA；移动端底部固定「查看交通路线」，搜索图标与面板标题；途经点序号与地图标记统一为 1-based。1440/390/360/430 实测无横向溢出，CTA 可见，搜索、路线、移动端截图复核。
- 验证：59 项单测通过。无头浏览器实测当前位置起点、重复点拦截、删除/清空撤销、收藏加载确认、390px 顶部操作条；系统分享在 headless 不可用，已验证回退路径。仍待真实浏览器手工补测：指针拖拽/键盘排序、缺 Key/定位拒绝/天气重试。
