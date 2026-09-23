'use strict'

var https = require('https')
var crypto = require('crypto')
var querystring = require('querystring')

var MAX_BODY_BYTES = 8 * 1024
var MAX_RESPONSE_BYTES = 2 * 1024 * 1024
var CACHE_LIMIT = 200
var cache = new Map()

function HttpError(statusCode, message) {
  this.name = 'HttpError'
  this.statusCode = statusCode
  this.message = message
  Error.captureStackTrace(this, HttpError)
}
HttpError.prototype = Object.create(Error.prototype)

function response(statusCode, body) {
  return {
    isBase64Encoded: false,
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'no-referrer'
    },
    body: JSON.stringify(body)
  }
}

function normalizeHeaders(headers) {
  var result = {}
  Object.keys(headers || {}).forEach(function(key) {
    result[String(key).toLowerCase()] = String(headers[key])
  })
  return result
}

function safeEqual(actual, expected) {
  var left = crypto.createHash('sha256').update(String(actual || '')).digest()
  var right = crypto.createHash('sha256').update(String(expected || '')).digest()
  return crypto.timingSafeEqual(left, right)
}

function authenticate(headers) {
  var expectedToken = process.env.PROXY_TOKEN
  if (!expectedToken || expectedToken.length < 24) {
    throw new HttpError(500, '代理服务尚未完成安全配置')
  }
  if (!safeEqual(headers['x-proxy-token'], expectedToken)) {
    throw new HttpError(401, '未授权请求')
  }
  var appId = process.env.WECHAT_APP_ID
  if (appId) {
    var referer = headers.referer || ''
    var expectedPrefix = 'https://servicewechat.com/' + appId + '/'
    if (referer.indexOf(expectedPrefix) !== 0) {
      throw new HttpError(403, '请求来源不允许')
    }
  }
}

function parseBody(event) {
  var raw = event && event.body
  if (raw && typeof raw === 'object') {
    if (Buffer.byteLength(JSON.stringify(raw), 'utf8') > MAX_BODY_BYTES) {
      throw new HttpError(413, '请求内容过大')
    }
    return raw
  }
  if (event && event.isBase64Encoded && typeof raw === 'string') {
    raw = Buffer.from(raw, 'base64').toString('utf8')
  }
  raw = raw || '{}'
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    throw new HttpError(413, '请求内容过大')
  }
  try {
    return JSON.parse(raw)
  } catch (e) {
    throw new HttpError(400, '请求 JSON 无效')
  }
}

function text(value, name, maxLength, optional) {
  if ((value === undefined || value === null || value === '') && optional) return ''
  if (typeof value !== 'string') throw new HttpError(400, name + '格式无效')
  value = value.trim()
  if (!value || value.length > maxLength || /[\u0000-\u001f]/.test(value)) {
    throw new HttpError(400, name + '格式无效')
  }
  return value
}

function coordinatePair(value, name) {
  value = text(value, name, 64, false)
  if (!/^-?\d+(?:\.\d{1,6})?,-?\d+(?:\.\d{1,6})?$/.test(value)) {
    throw new HttpError(400, name + '坐标格式无效')
  }
  var parts = value.split(',')
  var longitude = Number(parts[0])
  var latitude = Number(parts[1])
  if (!isFinite(longitude) || !isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new HttpError(400, name + '坐标超出范围')
  }
  return longitude.toFixed(6) + ',' + latitude.toFixed(6)
}

function coordinateNumber(value, name, min, max) {
  if (typeof value !== 'number' || !isFinite(value) || value < min || value > max) {
    throw new HttpError(400, name + '坐标无效')
  }
  return value.toFixed(6)
}

function buildRequest(type, params) {
  params = params && typeof params === 'object' ? params : {}
  var amapKey = process.env.AMAP_WEB_SERVICE_KEY
  var amap
  if (type !== 'weather_forecast') {
    if (!amapKey) throw new HttpError(500, '高德服务尚未配置')
    amap = { key: amapKey, output: 'JSON' }
  }

  if (type === 'regeocode') {
    amap.location = coordinatePair(params.location, 'location')
    amap.extensions = 'all'
    return { host: 'restapi.amap.com', path: '/v3/geocode/regeo', query: amap, ttl: 24 * 60 * 60 * 1000 }
  }
  if (type === 'poi_search') {
    amap.keywords = text(params.keywords, 'keywords', 50, false)
    var searchCity = text(params.city, 'city', 30, true)
    if (searchCity) {
      amap.city = searchCity
      amap.citylimit = 'true'
    }
    amap.offset = '20'
    amap.page = '1'
    amap.extensions = 'all'
    return { host: 'restapi.amap.com', path: '/v3/place/text', query: amap, ttl: 5 * 60 * 1000 }
  }
  if (type === 'poi_detail') {
    var id = text(params.id, 'id', 64, false)
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new HttpError(400, 'id格式无效')
    amap.id = id
    amap.extensions = 'all'
    return { host: 'restapi.amap.com', path: '/v3/place/detail', query: amap, ttl: 60 * 60 * 1000 }
  }
  if (type === 'input_tips') {
    amap.keywords = text(params.keywords, 'keywords', 50, false)
    var tipCity = text(params.city, 'city', 30, true)
    if (tipCity) {
      amap.city = tipCity
      amap.citylimit = 'true'
    }
    amap.datatype = 'all'
    return { host: 'restapi.amap.com', path: '/v3/assistant/inputtips', query: amap, ttl: 5 * 60 * 1000 }
  }
  if (type === 'walking_route') {
    amap.origin = coordinatePair(params.origin, 'origin')
    amap.destination = coordinatePair(params.destination, 'destination')
    return { host: 'restapi.amap.com', path: '/v3/direction/walking', query: amap, ttl: 5 * 60 * 1000 }
  }
  if (type === 'transit_route') {
    amap.origin = coordinatePair(params.origin, 'origin')
    amap.destination = coordinatePair(params.destination, 'destination')
    amap.city = text(params.city, 'city', 30, false)
    amap.extensions = 'all'
    amap.strategy = '0'
    return { host: 'restapi.amap.com', path: '/v3/direction/transit/integrated', query: amap, ttl: 5 * 60 * 1000 }
  }
  if (type === 'weather_forecast') {
    var weatherHost = process.env.OPEN_METEO_HOST || 'api.open-meteo.com'
    if (weatherHost !== 'api.open-meteo.com' && weatherHost !== 'customer-api.open-meteo.com') {
      throw new HttpError(500, '天气服务主机配置无效')
    }
    var weatherQuery = {
      latitude: coordinateNumber(params.latitude, 'latitude', -90, 90),
      longitude: coordinateNumber(params.longitude, 'longitude', -180, 180),
      current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: '7'
    }
    if (weatherHost === 'customer-api.open-meteo.com') {
      var weatherApiKey = process.env.OPEN_METEO_API_KEY
      if (!weatherApiKey) throw new HttpError(500, '天气商业服务尚未配置')
      weatherQuery.apikey = weatherApiKey
    }
    return {
      host: weatherHost,
      path: '/v1/forecast',
      query: weatherQuery,
      ttl: 30 * 60 * 1000
    }
  }
  throw new HttpError(400, '不支持的请求类型')
}

function requestJson(requestInfo) {
  var path = requestInfo.path + '?' + querystring.stringify(requestInfo.query)
  return new Promise(function(resolve, reject) {
    var req = https.request({
      protocol: 'https:',
      hostname: requestInfo.host,
      port: 443,
      path: path,
      method: 'GET',
      timeout: 12000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'route-planning-proxy/1.0'
      }
    }, function(res) {
      var size = 0
      var chunks = []
      var responseTooLarge = false
      res.on('data', function(chunk) {
        if (responseTooLarge) return
        size += chunk.length
        if (size > MAX_RESPONSE_BYTES) {
          responseTooLarge = true
          res.destroy()
          reject(new HttpError(502, '上游响应过大'))
          return
        }
        chunks.push(chunk)
      })
      res.on('end', function() {
        if (responseTooLarge) return
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new HttpError(502, '上游服务暂不可用'))
          return
        }
        try {
          var parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          if (requestInfo.host === 'restapi.amap.com' && parsed.status !== '1') {
            reject(new HttpError(502, parsed.info || '高德服务返回异常'))
            return
          }
          if (parsed.error === true || parsed.error_code) {
            reject(new HttpError(502, '天气服务返回异常'))
            return
          }
          resolve(parsed)
        } catch (e) {
          reject(new HttpError(502, '上游响应格式无效'))
        }
      })
    })
    req.on('timeout', function() { req.destroy(new Error('timeout')) })
    req.on('error', function() { reject(new HttpError(502, '上游服务请求失败')) })
    req.end()
  })
}

function cacheKey(type, requestInfo) {
  var safeQuery = Object.assign({}, requestInfo.query)
  delete safeQuery.key
  delete safeQuery.apikey
  return type + ':' + crypto.createHash('sha256').update(JSON.stringify(safeQuery)).digest('hex')
}

function getCache(key) {
  var item = cache.get(key)
  if (!item) return null
  if (Date.now() >= item.expiresAt) {
    cache.delete(key)
    return null
  }
  return item.data
}

function setCache(key, data, ttl) {
  if (cache.size >= CACHE_LIMIT) {
    var first = cache.keys().next()
    if (!first.done) cache.delete(first.value)
  }
  cache.set(key, { data: data, expiresAt: Date.now() + ttl })
}

async function handler(event) {
  var method = String((event && event.httpMethod) || (event && event.requestContext && event.requestContext.httpMethod) || 'POST').toUpperCase()
  if (method === 'GET') return response(200, { code: 0, status: 'ok' })
  if (method !== 'POST') return response(405, { code: 405, error: '仅支持 POST' })

  try {
    var headers = normalizeHeaders(event && event.headers)
    authenticate(headers)
    var body = parseBody(event)
    var type = text(body.type, 'type', 40, false)
    var requestInfo = buildRequest(type, body.params)
    var key = cacheKey(type, requestInfo)
    var cached = getCache(key)
    if (cached) return response(200, { code: 0, data: cached, type: type, cached: true })
    var data = await requestJson(requestInfo)
    setCache(key, data, requestInfo.ttl)
    return response(200, { code: 0, data: data, type: type, cached: false })
  } catch (error) {
    var statusCode = error instanceof HttpError ? error.statusCode : 500
    var message = error instanceof HttpError ? error.message : '代理服务内部错误'
    return response(statusCode, { code: statusCode, error: message })
  }
}

exports.main_handler = handler
exports.handler = handler
exports._test = {
  authenticate: authenticate,
  buildRequest: buildRequest,
  coordinatePair: coordinatePair,
  parseBody: parseBody,
  safeEqual: safeEqual
}
