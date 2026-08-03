var gaode = require('./gaode')

var CACHE_KEY = 'weather_cache'
var CACHE_TTL = 2 * 60 * 60 * 1000

function weatherIcon(desc) {
  var s = desc || ''
  if (s.indexOf('雷') !== -1) return '⛈'
  if (s.indexOf('雪') !== -1) return '🌨'
  if (s.indexOf('雨') !== -1) return '🌧'
  if (s.indexOf('雾') !== -1 || s.indexOf('霾') !== -1 || s.indexOf('沙') !== -1) return '🌫'
  if (s.indexOf('晴') !== -1) {
    if (s.indexOf('云') !== -1) return '⛅'
    return '☀️'
  }
  if (s.indexOf('云') !== -1) return '⛅'
  if (s.indexOf('阴') !== -1) return '☁️'
  return '🌤'
}

function getCached(city) {
  try {
    var raw = wx.getStorageSync(CACHE_KEY)
    if (raw && raw.city === city && raw.time && Date.now() - raw.time < CACHE_TTL && raw.days) {
      return raw.days
    }
  } catch (e) {}
  return null
}

function setCached(city, days) {
  try {
    wx.setStorageSync(CACHE_KEY, { city: city, time: Date.now(), days: days })
  } catch (e) {}
}

function getForecast(city) {
  var cached = getCached(city)
  if (cached) return Promise.resolve(cached)
  return new Promise(function(resolve, reject) {
    gaode.weather(city).then(function(data) {
      var forecasts = data.forecasts || []
      var fc = forecasts[0]
      if (!fc || !fc.casts || fc.casts.length === 0) {
        reject(new Error('Forecast unavailable'))
        return
      }
      var now = new Date()
      var today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      var days = fc.casts.map(function(cast) {
        var d = new Date(cast.date.replace(/-/g, '/'))
        var diff = Math.round((d - today) / 86400000)
        var label
        if (diff === 0) label = '今天'
        else if (diff === 1) label = '明天'
        else if (diff === 2) label = '后天'
        else label = (d.getMonth() + 1) + '/' + d.getDate()
        var desc = cast.dayweather || ''
        var night = cast.nightweather || ''
        if (night && night !== desc) desc = desc + ' / 夜间' + night
        return {
          date: cast.date,
          label: label,
          icon: weatherIcon(cast.dayweather),
          high: String(cast.daytemp === undefined || cast.daytemp === null ? '' : cast.daytemp),
          low: String(cast.nighttemp === undefined || cast.nighttemp === null ? '' : cast.nighttemp),
          desc: desc
        }
      })
      setCached(city, days)
      resolve(days)
    }).catch(reject)
  })
}

module.exports = { getForecast: getForecast }
