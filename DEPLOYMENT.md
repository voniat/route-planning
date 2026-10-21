# 部署与发布

## 1. 高德 Key

1. 打开高德开放平台控制台 <https://console.amap.com/dev/key/app>，完成实名认证（认证免费；API 调用配额/费用另计）。
2. 创建应用 → 添加 Key → 服务平台选择 **Web端(JS API)**（不是 Web 服务）。
3. 域名白名单：
   - 本地开发可以**留空**（高德不认可 `localhost` / IP）。留空意味着不限制域名，仅适合测试。
   - 生产环境填写实际访问域名（不带协议、端口和路径），并设置配额与告警。
4. 在该 Key 的设置中生成或查看**安全密钥**（`securityJsCode`）。
5. 复制 `.env.example` 为 `.env.local`，填写：

   ```ini
   VITE_AMAP_KEY=你的 Web端(JS API) Key
   VITE_AMAP_SECURITY_CODE=你的安全密钥
   ```

   `.env.local` 已被 Git 忽略，不要提交或截图外发。

### 1.1 开源/BYO Key 模式

本仓库不内置 Key，也不提供维护者付费的公共演示站：

- **你托管一个站点**：一个 Key 服务所有访客；你承担配额、费用和滥用风险，设置域名白名单、配额和告警。
- **别人自己部署**：每个部署实例申请自己的 Key；访客本身不需要注册 Key。
- **不要把 Key 写进仓库或共用**。`.env.local` 只在本机；部署时用 CI Secrets 注入。

费用提醒：个人认证、非商业用途有 **1 年免费月配额**（自注册认证起算），搜索仅 5,000 次/月，是本项目最先耗尽的额度；超量、到期、公开长期运营或商业使用，需要按量付费或购买技术服务许可。官方价格见 <https://developer.amap.com/upgrade#price>，许可说明见 <https://lbs.amap.com/pages/authorization/>。不要向用户承诺"高德永久免费"。

## 2. 构建与静态托管

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm build
```

- 产物在 `dist/`，部署到任意静态托管（GitHub Pages、Cloudflare Pages、Netlify、对象存储 + CDN 等）。
- 必须使用 HTTPS：浏览器定位 API 要求安全上下文。
- 单页应用，不需要服务端渲染或 SPA 回退；静态服务器返回 `index.html` 与 `assets/` 即可。
- 缓存建议：`assets/` 长缓存，`index.html` 不缓存（或短缓存）。

地图、搜索、路线由浏览器直连高德，天气直连 Open-Meteo；服务器只提供静态文件。

## 3. 上线检查

1. `pnpm verify` 与 GitHub Actions `verify` 全绿。
2. 真实 Key 下手工验证：地图加载、搜索加点、地图选点、拖拽/键盘排序、公交与步行路线、天气、收藏、分享链接、刷新恢复。
3. 桌面 1280px 与移动 360–430px 视口无横向溢出，主要操作可点击，仅键盘可关闭浮层。
4. 浏览器控制台无 `INVALID_USER_KEY`、`USERKEY_PLAT_NOMATCH`、`INVALID_USER_SCODE` 等错误。
5. 核对高德配额/费用告警；商业使用 Open-Meteo 时改用其商业订阅端点与 Key。

## 4. 旧版下线（手工）

旧微信小程序与腾讯云函数代理已从仓库删除，但线上资源需要手动处理：

- 确认新站可用后，删除腾讯云函数 `route-proxy` 及其 API 网关触发器。
- 删除云函数环境变量：`AMAP_WEB_SERVICE_KEY`、`PROXY_TOKEN`、`WECHAT_APP_ID`、`OPEN_METEO_HOST`、`OPEN_METEO_API_KEY`。
- 确认没有其他调用后停用旧的高德「Web 服务」Key。
- 在微信公众平台下线/下架旧小程序版本（如果仍在发布）。

## 5. 密钥泄漏处置

- 前端 Key 是高德设计为公开的值；发现滥用时，先在高德控制台限制域名、降低配额并轮换 Key。
- 如果 `.env.local` 被误提交：立即轮换 Key，清理 Git 历史并通知协作者。
- 每次提交和发布前运行 `pnpm security`；CI 已包含该检查。
