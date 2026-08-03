# 项目约定

## 工作流
- 每次代码修改完成后，自动执行 `git commit` 并 `git push origin main`，保持本地与 GitHub 同步（用户明确要求）。
- 提交信息风格：`类型: 中文描述`（如 `fix:`、`feat:`、`chore:`、`refactor:`），参考现有 git log。

## 项目简介
- 微信小程序「旅行路线规划」：地图选点、途经点排序、公交/地铁/步行路线规划、天气、附近美食、收藏与分享。
- 原生小程序（无框架），ES5 风格，CommonJS 模块化。
- 数据来源：高德地图 API（经腾讯云函数代理，`utils/config.js` 已 gitignore，模板见 `utils/config.example.js`）、Open-Meteo 天气。
- 注意：`wx:for` 与 `wx:if` 不要写在同一节点（用 `<block>` 包裹）。
