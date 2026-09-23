var gaode = require('./gaode')
var routeData = require('./route-data')

var CACHE_KEY = 'weather_forecast_v1'
var CACHE_TTL = 30 * 60 * 1000

var WEATHER_CODES = {
  0: ['晴', '☀️'],
  1: ['大部晴朗', '🌤'],
  2: ['多云', '⛅'],
  3: ['阴', '☁️'],
  45: ['有雾', '🌫'],
  48: ['雾凇', '🌫'],
  51: ['小毛毛雨', '🌦'],
  53: ['毛毛雨', '🌦'],
  55: ['较强毛毛雨', '🌧'],
  56: ['冻毛毛雨', '🌧'],
  57: ['较强冻毛毛雨', '🌧'],
  61: ['小雨', '🌦'],
  63: ['中雨', '🌧'],
  65: ['大雨', '🌧'],
  66: ['冻雨', '🌧'],
  67: ['较强冻雨', '🌧'],
  71: ['小雪', '🌨'],
  73: ['中雪', '🌨'],
  75: ['大雪', '❄️'],
  77: ['米雪', '🌨'],
  80: ['小阵雨', '🌦'],
  81: ['阵雨', '🌧'],
  82: ['强阵雨', '🌧'],
  85: ['小阵雪', '🌨'],
  86: ['强阵雪', '❄️'],
  95: ['雷暴', '⛈'],
  96: ['雷暴伴冰雹', '⛈'],
  99: ['强雷暴伴冰雹', '⛈']
}

function describeCode(code) {
  var value = WEATHER_CODES[parseInt(code)]
  return value ? { text: value[0], icon: value[1] } : { text: '天气变化', icon: '🌤' }
}

function dateLabel(dateStr, now) {
  var date = new Date(String(dateStr).replace(/-/g, '/') + ' 00:00:00')
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  var diff = Math.round((date - today) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '后天'
  return (date.getMonth() + 1) + '/' + date.getDate()
}

function parseForecast(data, now) {
  var daily = data && data.daily
  if (!daily || !Array.isArray(daily.time) || daily.time.length === 0) {
    throw new Error('天气数据暂不可用')
  }
  now = now || new Date()
  var codes = daily.weather_code || daily.weathercode || []
  var highs = daily.temperature_2m_max || []
  var lows = daily.temperature_2m_min || []
  var rain = daily.precipitation_probability_max || []
  var days = daily.time.slice(0, 7).map(function(date, index) {
    var desc = describeCode(codes[index])
    return {
      date: String(date),
      label: dateLabel(date, now),
      text: desc.text,
      icon: desc.icon,
      high: Math.round(Number(highs[index]) || 0),
      low: Math.round(Number(lows[index]) || 0),
      rain: Math.max(0, Math.min(100, parseInt(rain[index]) || 0))
    }
  })
  var currentRaw = data.current || data.current_weather || {}
  var currentDesc = describeCode(currentRaw.weather_code !== undefined ? currentRaw.weather_code : currentRaw.weathercode)
  return {
    current: {
      temperature: Math.round(Number(currentRaw.temperature_2m !== undefined ? currentRaw.temperature_2m : currentRaw.temperature) || 0),
      apparent: Math.round(Number(currentRaw.apparent_temperature) || 0),
      wind: Math.round(Number(currentRaw.wind_speed_10m !== undefined ? currentRaw.wind_speed_10m : currentRaw.windspeed) || 0),
      text: currentDesc.text,
      icon: currentDesc.icon
    },
    days: days,
    timezone: data.timezone || ''
  }
}

function cacheKey(latitude, longitude) {
  return latitude.toFixed(2) + ',' + longitude.toFixed(2)
}

function getCached(key) {
  try {
    var cached = wx.getStorageSync(CACHE_KEY)
    if (cached && cached.key === key && cached.savedAt && Date.now() - cached.savedAt < CACHE_TTL && cached.data) {
      return cached.data
    }
  } catch (e) {}
  return null
}

function setCached(key, data) {
  try {
    wx.setStorageSync(CACHE_KEY, { key: key, savedAt: Date.now(), data: data })
  } catch (e) {}
}

function getForecast(latitude, longitude) {
  if (!routeData.isValidCoordinate(latitude, longitude)) {
    return Promise.reject(new Error('无效的天气查询坐标'))
  }
  var key = cacheKey(latitude, longitude)
  var cached = getCached(key)
  if (cached) return Promise.resolve(cached)
  return gaode.weatherForecast(latitude, longitude).then(function(data) {
    var parsed = parseForecast(data)
    setCached(key, parsed)
    return parsed
  })
}

module.exports = {
  describeCode: describeCode,
  parseForecast: parseForecast,
  getForecast: getForecast
}
