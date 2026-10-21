# 项目约定

## 工作流
- 每次代码修改完成后，自动执行 `git commit` 并 `git push origin main`，保持本地与 GitHub 同步（用户明确要求）。
- 提交信息风格：`类型: 中文描述`（如 `fix:`、`feat:`、`chore:`、`refactor:`）。

## 项目简介
- 浏览器端「旅行路线规划」单页应用：地图选点、途经点排序、公交/地铁与步行路线、7 日天气、本地收藏/草稿、分享链接。
- 技术栈：React 19 + TypeScript（strict）+ Vite 7 + Vitest；无后端、无状态库、无 UI 库。
- 地图与路径规划：高德 JS API v2；天气：Open-Meteo 直连；收藏/草稿/搜索历史：localStorage。
- 密钥：`VITE_AMAP_KEY`、`VITE_AMAP_SECURITY_CODE` 只放 `.env.local`（已忽略），模板见 `.env.example`。仓库不内置 Key；每个部署者自备。
- 代码边界：纯逻辑在 `src/core`；高德 SDK 只在 `src/amap`；组件不直接读 SDK 或 localStorage。

## 命令
- `pnpm dev`：本地开发（需要 `.env.local`）
- `pnpm verify`：类型检查 + 单元测试 + 密钥扫描 + 构建
- `pnpm test` / `pnpm build` / `pnpm security`

## 约定
- 不引入微信小程序 API、`wx.*` 或云函数代理。
- 不提交 `.env.local`；前端 Key 是公开值，靠高德域名白名单、配额与告警保护。
- 新依赖需说明为什么现有代码或标准库不足。
