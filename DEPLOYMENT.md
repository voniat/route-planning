# 部署与发布

## 1. 准备账号与密钥

1. 注册微信小程序并取得 AppID。
2. 在高德开放平台创建 Web 服务类型的 Key。不要把 Key 写入小程序代码、Git 仓库或 `utils/config.js`。
3. 生成至少 32 字节的随机代理令牌，例如：

   ```powershell
   $bytes = New-Object byte[] 32
   [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
   [Convert]::ToHexString($bytes).ToLower()
   ```

## 2. 部署请求代理

`serverless/route-proxy` 是无第三方依赖的 Node.js 18+ 函数。

1. 在腾讯云函数创建 Node.js 18 或更高版本的事件函数。
2. 上传 `serverless/route-proxy` 目录，入口设置为 `index.main_handler`。
3. 配置环境变量：

   | 变量 | 必需 | 用途 |
   | --- | --- | --- |
   | `AMAP_WEB_SERVICE_KEY` | 是 | 高德 Web 服务 Key |
   | `PROXY_TOKEN` | 是 | 至少 24 个字符的客户端访问令牌 |
   | `WECHAT_APP_ID` | 否 | 校验微信请求 Referer；确认网关会透传 Referer 后再开启 |
   | `OPEN_METEO_HOST` | 否 | 默认 `api.open-meteo.com`；商业使用改为 `customer-api.open-meteo.com` |
   | `OPEN_METEO_API_KEY` | 商业使用 | Open-Meteo 商业订阅密钥，只在服务端保存 |

4. 通过 API 网关暴露 HTTPS 地址，只开放 `POST` 业务请求。函数保留一个不含配置内容的 `GET` 健康检查。
5. 给网关配置限流、日配额和费用告警。建议从每个实例每秒 5 次、突发 10 次开始，再按真实用量调整。
6. 日志不要记录请求头、完整请求体、`PROXY_TOKEN` 或高德 Key。为日志设置合理的保留期。
7. 如启用 `WECHAT_APP_ID`，先在预发布环境确认 API 网关保留 `Referer: https://servicewechat.com/{AppID}/...`，否则正式请求会全部被拒绝。Referer 可以被非微信客户端伪造，只能作为辅助信号，不能替代限流、配额和费用上限。

代理只接受固定请求类型、固定上游主机和经过校验的参数，并限制请求体、响应体、超时和缓存数量。客户端令牌会包含在小程序包内，因此它的作用是便于限流和吊销。真正的高德 Key 必须一直留在服务端。

## 3. 配置小程序

1. 复制 `utils/config.example.js` 为 `utils/config.js`。
2. 填写部署后的 HTTPS 地址和相同的 `PROXY_TOKEN`。
3. 把 `project.config.json` 的 `appid` 改为正式 AppID。
4. 在微信公众平台将代理域名加入 request 合法域名。
5. 保持开发者工具的“不校验合法域名”关闭，以便预发布阶段发现域名配置问题。

`utils/config.js`、私有项目配置、环境文件和常见证书文件已被 Git 忽略。上传前仍需运行 `npm run security`。

## 4. 隐私合规

在微信公众平台配置并提交《用户隐私保护指引》，内容应与应用实际行为一致：

- 获取位置用于地图定位、路线规划和当地天气。
- 地点、坐标和路线请求会经自建代理发往高德；天气坐标会经代理发往 Open-Meteo。
- 当前代理不把业务请求写入数据库。需同时关闭或脱敏 API 网关请求体日志。
- 隐私指引应披露第三方自己的日志与保存规则；Open-Meteo 当前条款说明其 API 日志可能包含坐标并最多保留 90 天。
- 路线草稿、收藏和搜索历史存储在用户设备的微信本地存储中。
- 提供实际运营主体的联系方式、数据保存期限、删除和投诉渠道。

新增统计、账号、云数据库或广告 SDK 后，应重新核对隐私指引、第三方清单和数据删除流程。

## 5. 发布前检查

1. 在干净环境执行 `npm run verify`，确认 CI 通过。
2. 在开发版真机测试首次隐私授权、拒绝后再次触发、系统定位拒绝和弱网超时。
3. 分别测试地点搜索、地图点选、2 至 20 个途经点、公交、步行、跨零点排期、天气失败重试、收藏和分享进入。
4. 确认发布包未包含 `serverless`、`test`、`scripts`、文档和本地配置；`project.config.json` 已配置打包忽略。
5. 在网关查看限流与费用告警是否生效，并确认日志不含令牌或 Key。
6. 核对高德和 Open-Meteo 当前配额、服务条款、归属标识和商用要求。Open-Meteo 免费公共端点仅供非商业用途；带广告、订阅或商业产品时必须使用其商业订阅。
7. 在微信开发者工具执行“上传”，到微信公众平台提交体验、审核和发布。

## 6. 密钥泄漏处置

如果高德 Key 曾进入客户端包、日志或 Git 历史：

1. 立即在高德控制台停用并重新生成 Key。
2. 更新云函数环境变量并重新部署。
3. 清理日志和构建产物；Git 历史需要单独重写时，先协调所有协作者。
4. 如果只是代理令牌泄漏，轮换 `PROXY_TOKEN`、重新上传小程序，并在过渡完成后停用旧令牌。
