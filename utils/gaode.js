var config
try { config = require('./config') } catch (e) { config = require('./config.example') }

var PROXY = config.proxyUrl
var TOKEN = config.proxyToken

function callGaode(type, params) {
  return new Promise(function(resolve, reject) {
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
        if (res.statusCode === 200 && res.data.code === 0) {
          resolve(res.data.data)
        } else {
          reject(new Error(res.data && res.data.error ? res.data.error : '请求失败'))
        }
      },
      fail: function(err) { reject(err) }
    })
  })
}

function geocode(address, city) {
  var params = { address: address }
  if (city) params.city = city
  return callGaode('geocode', params)
}

function regeocode(lng, lat) {
  return callGaode('regeocode', { location: lng + ',' + lat })
}

function poiSearch(keywords, city) {
  var params = { keywords: keywords }
  if (city) params.city = city
  return callGaode('poi_search', params)
}

function poiAround(lng, lat, keywords, radius) {
  return callGaode('poi_around', {
    location: lng + ',' + lat,
    keywords: keywords || '',
    radius: radius || 5000
  })
}

function poiDetail(id) {
  return callGaode('poi_detail', { id: id })
}

function weather(city, extensions) {
  return callGaode('weather', { city: city, extensions: extensions || 'all' })
}

function inputTips(keywords) {
  return callGaode('input_tips', { keywords: keywords })
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
  callGaode: callGaode,
  geocode: geocode,
  regeocode: regeocode,
  poiSearch: poiSearch,
  poiAround: poiAround,
  poiDetail: poiDetail,
  weather: weather,
  inputTips: inputTips,
  walkingRoute: walkingRoute,
  transitRoute: transitRoute,
  decodePolyline: decodePolyline
}
