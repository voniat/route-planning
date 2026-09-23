'use strict'

var test = require('node:test')
var assert = require('node:assert/strict')

process.env.AMAP_WEB_SERVICE_KEY = 'test-amap-key'
process.env.PROXY_TOKEN = 'test-proxy-token-at-least-24-characters'
var proxy = require('../serverless/route-proxy')

test('代理仅构造白名单中的固定上游请求', function() {
  var request = proxy._test.buildRequest('walking_route', {
    origin: '116.400000,39.900000',
    destination: '116.500000,39.950000',
    host: 'evil.example'
  })
  assert.equal(request.host, 'restapi.amap.com')
  assert.equal(request.path, '/v3/direction/walking')
  assert.equal(request.query.key, 'test-amap-key')
  assert.throws(function() {
    proxy._test.buildRequest('unknown', {})
  }, /不支持的请求类型/)
})

test('代理令牌使用恒定长度摘要比较', function() {
  assert.equal(proxy._test.safeEqual('same-token', 'same-token'), true)
  assert.equal(proxy._test.safeEqual('short', 'a-much-longer-token'), false)
})

test('代理拒绝越界坐标和缺少城市的公交请求', function() {
  assert.throws(function() {
    proxy._test.buildRequest('walking_route', {
      origin: '181,39',
      destination: '116,39'
    })
  }, /坐标超出范围/)
  assert.throws(function() {
    proxy._test.buildRequest('transit_route', {
      origin: '116,39',
      destination: '117,40',
      city: ''
    })
  }, /city格式无效/)
})

test('代理在访问上游前拒绝错误令牌', async function() {
  var response = await proxy.handler({
    httpMethod: 'POST',
    headers: { 'X-Proxy-Token': 'wrong' },
    body: JSON.stringify({ type: 'weather_forecast', params: { latitude: 39.9, longitude: 116.4 } })
  })
  assert.equal(response.statusCode, 401)
})

test('天气商业端点只能从服务端白名单环境变量选择', function() {
  process.env.OPEN_METEO_HOST = 'customer-api.open-meteo.com'
  process.env.OPEN_METEO_API_KEY = 'test-weather-customer-key'
  var request = proxy._test.buildRequest('weather_forecast', { latitude: 39.9, longitude: 116.4 })
  assert.equal(request.host, 'customer-api.open-meteo.com')
  assert.equal(request.query.apikey, 'test-weather-customer-key')
  process.env.OPEN_METEO_HOST = 'evil.example'
  assert.throws(function() {
    proxy._test.buildRequest('weather_forecast', { latitude: 39.9, longitude: 116.4 })
  }, /主机配置无效/)
  delete process.env.OPEN_METEO_HOST
  delete process.env.OPEN_METEO_API_KEY
})

test('代理健康检查不泄露配置', async function() {
  var response = await proxy.handler({ httpMethod: 'GET' })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(JSON.parse(response.body), { code: 0, status: 'ok' })
})
