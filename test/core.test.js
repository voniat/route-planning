'use strict'

var test = require('node:test')
var assert = require('node:assert/strict')
var routeData = require('../utils/route-data')
var schedule = require('../utils/schedule')
var weather = require('../utils/weather')
var gaode = require('../utils/gaode')

test('路线数据会过滤非法坐标并限制数量', function() {
  var points = routeData.normalizePoints([
    { id: 1, title: 'A', latitude: 39.9, longitude: 116.4 },
    { id: 1, title: 'B', latitude: 31.2, longitude: 121.5 },
    { title: 'bad', latitude: 100, longitude: 0 }
  ], 2)
  assert.equal(points.length, 2)
  assert.notEqual(points[0].id, points[1].id)
  assert.deepEqual(routeData.normalizeTimes(['09:00', '99:00'], 2), ['09:00', ''])
})

test('行程时间按真实路段耗时向上取整并加入停留时间', function() {
  var result = schedule.buildSchedule('09:00', [601, 1200], 3, 60)
  assert.deepEqual(result.times, ['09:00', '09:15', '10:35'])
  assert.equal(result.usedFallback, false)
})

test('行程时间在缺少路段时使用明确回退值', function() {
  var result = schedule.buildSchedule('23:30', [], 2, 60)
  assert.deepEqual(result.times, ['23:30', '00:30'])
  assert.equal(result.usedFallback, true)
})

test('天气响应解析为当前天气和七日预报', function() {
  var data = weather.parseForecast({
    timezone: 'Asia/Shanghai',
    current: {
      temperature_2m: 26.4,
      apparent_temperature: 27.2,
      weather_code: 61,
      wind_speed_10m: 12.3
    },
    daily: {
      time: ['2026-09-23', '2026-09-24'],
      weather_code: [0, 61],
      temperature_2m_max: [29.2, 25.1],
      temperature_2m_min: [18.6, 17.4],
      precipitation_probability_max: [10, 80]
    }
  }, new Date(2026, 8, 23))
  assert.equal(data.current.text, '小雨')
  assert.equal(data.current.temperature, 26)
  assert.equal(data.days[0].label, '今天')
  assert.equal(data.days[1].rain, 80)
})

test('客户端拒绝非 HTTPS 地址和示例令牌', function() {
  assert.match(gaode._validateProxyConfig('http://proxy.example.com', '123456789012345678901234'), /HTTPS/)
  assert.match(gaode._validateProxyConfig('https://proxy.example.com', 'replace-with-a-random-token'), /代理令牌/)
  assert.equal(gaode._validateProxyConfig('https://proxy.example.com/api', '123456789012345678901234'), '')
})
