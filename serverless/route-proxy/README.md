# 路线请求代理

Node.js 18+ 云函数，为小程序提供受限的高德和 Open-Meteo 访问。

## 部署

- 入口：`index.main_handler`
- 环境变量：复制 `config.example.env` 中的变量到云函数控制台，不要上传真实 `.env`。商业使用天气服务时配置 `customer-api.open-meteo.com` 和订阅 Key
- 触发器：API 网关 HTTPS
- 业务方法：`POST`
- 健康检查：`GET`

支持的 `type`：

- `regeocode`
- `poi_search`
- `poi_detail`
- `input_tips`
- `walking_route`
- `transit_route`
- `weather_forecast`

所有上游主机和路径都由服务端固定，额外客户端字段会被忽略。部署后还应在网关层配置限流、配额、告警与脱敏日志。完整步骤见项目根目录 [DEPLOYMENT.md](../../DEPLOYMENT.md)。
