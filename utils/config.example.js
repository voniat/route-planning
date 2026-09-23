module.exports = {
  // 只填写已部署的 HTTPS 代理地址。高德 Web 服务 Key 必须保留在代理环境变量中。
  proxyUrl: 'https://your-proxy-url.example.com',
  // 客户端访问令牌会随小程序代码分发，只用于限流和吊销，不能代替服务端密钥。
  proxyToken: 'replace-with-a-random-token-at-least-24-chars'
}
