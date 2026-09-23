var config
try { config = require('./config') } catch (e) { config = require('./config.example') }

var PROXY = config.proxyUrl
var TOKEN = config.proxyToken

function validateProxyConfig(proxy, token) {
  if (!proxy || proxy.indexOf('your-proxy-url') !== -1 || !/^https:\/\/[A-Za-z0-9.-]+(?::\d{2,5})?(?:\/[^\s]*)?$/.test(proxy)) {
    return '请先在 utils/config.js 中配置有效的 HTTPS 代理地址'
  }
  if (!token || token.length < 24 || /^(?:your|replace)-/i.test(token)) {
    return '请先在 utils/config.js 中配置至少 24 个字符的代理令牌'
  }
  return ''
}

function callGaode(type, params) {
  return new Promise(function(resolve, reject) {
    var configError = validateProxyConfig(PROXY, TOKEN)
    if (configError) {
      reject(new Error(configError))
      return
    }
    wx.request({
      url: PROXY,
      method: 'POST',
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        'X-Proxy-Token': TOKEN
      },
      data: { type: type, params: params },
      success: function(res) {
        var body = res && res.data && typeof res.data === 'object' ? res.data : {}
        if (res.statusCode === 200 && body.code === 0) {
          resolve(body.data || {})
        } else {
          var message = body.error || body.message || ('请求失败（HTTP ' + (res.statusCode || 0) + '）')
          reject(new Error(message))
        }
      },
      fail: function(err) { reject(err) }
    })
  })
}

function regeocode(lng, lat) {
  return callGaode('regeocode', { location: lng + ',' + lat })
}

function poiSearch(keywords, city) {
  var params = { keywords: keywords }
  if (city) params.city = city
  return callGaode('poi_search', params)
}

function poiDetail(id) {
  return callGaode('poi_detail', { id: id })
}

function inputTips(keywords, city) {
  var params = { keywords: keywords }
  if (city) params.city = city
  return callGaode('input_tips', params)
}

function walkingRoute(origin, destination) {
  return callGaode('walking_route', {
    origin: origin.lng + ',' + origin.lat,
    destination: destination.lng + ',' + destination.lat
  })
}

function transitRoute(origin, destination, city) {
  return callGaode('transit_route', {
    origin: origin.lng + ',' + origin.lat,
    destination: destination.lng + ',' + destination.lat,
    city: city || ''
  })
}

function weatherForecast(latitude, longitude) {
  return callGaode('weather_forecast', {
    latitude: latitude,
    longitude: longitude
  })
}

function decodePolyline(str) {
  if (!str || typeof str !== 'string') return []
  return str.split(';').map(function(pair) {
    var parts = pair.split(',')
    return {
      longitude: parseFloat(parts[0]),
      latitude: parseFloat(parts[1])
    }
  }).filter(function(p) {
    return !isNaN(p.latitude) && !isNaN(p.longitude)
  })
}

module.exports = {
  regeocode: regeocode,
  poiSearch: poiSearch,
  poiDetail: poiDetail,
  inputTips: inputTips,
  walkingRoute: walkingRoute,
  transitRoute: transitRoute,
  weatherForecast: weatherForecast,
  decodePolyline: decodePolyline,
  _validateProxyConfig: validateProxyConfig
}
