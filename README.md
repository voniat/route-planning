# 旅行路线规划

原生微信小程序，用于地图选点、途经点排序、公交/地铁与步行路线查看、行程时间安排、天气查看、收藏和分享。

## 当前功能

- 地图点选、地点搜索、最多 20 个途经点
- 拖动排序、路线草稿、本地收藏和分享卡片
- 公交/地铁与步行路线、分段行程模式
- 根据各路段公交耗时生成到达时间，中途默认停留 1 小时
- 当前天气与七日预报
- 微信隐私授权适配

## 架构

```text
微信小程序
  └─ HTTPS 请求
      └─ serverless/route-proxy
          ├─ 高德 Web 服务：地理编码、地点、公交、步行
          └─ Open-Meteo：天气
```

高德 Key 只存在云函数环境变量中。小程序端只保存代理地址和可轮换的访问令牌。

## 本地运行

1. 使用 Node.js 18 或更高版本运行项目检查。
2. 按 [DEPLOYMENT.md](DEPLOYMENT.md) 部署代理。
3. 复制 `utils/config.example.js` 为 `utils/config.js`，填写代理 HTTPS 地址和访问令牌。
4. 在微信开发者工具中导入项目目录，并把 `project.config.json` 中的 `appid` 改为自己的 AppID。个人设置会写入已忽略的 `project.private.config.json`。
5. 在微信公众平台配置代理域名为 request 合法域名。

## 自动检查

```bash
npm run verify
```

该命令检查 JavaScript 和 JSON、WXML 约束、模板事件绑定、核心业务测试、代理输入边界以及常见密钥泄漏。GitHub Actions 会在提交和拉取请求上运行同一套检查。

## 发布

- [部署与发布清单](DEPLOYMENT.md)
- [安全说明](SECURITY.md)
- [代理部署说明](serverless/route-proxy/README.md)

天气数据来自 Open-Meteo，界面中保留了数据来源和 CC BY 4.0 标识。Open-Meteo 免费公共 API 仅供非商业用途；带广告、订阅或商业产品的发布应配置其商业订阅端点和 API Key。正式发布前还需核对高德的当前服务条款和配额。
