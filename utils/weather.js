function weatherCodeIcon(code) {
  code = parseInt(code) || 0
  if (code === 113) return '☀️'
  if (code === 116) return '⛅'
  if (code >= 119 && code <= 122) return '☁️'
  if (code >= 143 && code <= 182) return '🌦'
  if (code >= 200 && code <= 230) return '⛈'
  if (code >= 248 && code <= 260) return '🌫'
  if (code >= 263 && code <= 314) return '🌧'
  if (code >= 317 && code <= 338) return '🌨'
  if (code >= 350 && code <= 395) return '🌧'
  return '🌤'
}

function getForecastMetro(lat, lng) {
  return new Promise(function(resolve, reject) {
    wx.request({
      url: 'https://api.open-meteo.com/v1/forecast?' +
        'latitude=' + lat + '&longitude=' + lng +
        '&daily=temperature_2m_max,temperature_2m_min,weathercode' +
        '&timezone=auto&forecast_days=16',
      timeout: 10000,
      success: function(res) {
        if (res.statusCode === 200 && res.data && res.data.daily) {
          var daily = res.data.daily
          var now = new Date()
          var days = daily.time.map(function(dateStr, i) {
            var d = new Date(dateStr)
            var diff = Math.round((d - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000)
            var label
            if (diff === 0) label = '今天'
            else if (diff === 1) label = '明天'
            else if (diff === 2) label = '后天'
            else label = (d.getMonth() + 1) + '/' + d.getDate()
            return {
              date: dateStr,
              label: label,
              icon: (parseInt(daily.weathercode[i]) === 0 ? '☀️' :
                     parseInt(daily.weathercode[i]) <= 3 ? '⛅' :
                     parseInt(daily.weathercode[i]) <= 48 ? '🌫' :
                     parseInt(daily.weathercode[i]) <= 55 ? '🌧' :
                     parseInt(daily.weathercode[i]) <= 65 ? '🌧' :
                     parseInt(daily.weathercode[i]) <= 82 ? '🌧' :
                     parseInt(daily.weathercode[i]) <= 86 ? '🌨' :
                     parseInt(daily.weathercode[i]) >= 95 ? '⛈' : '🌤'),
              high: String(daily.temperature_2m_max[i] === undefined || daily.temperature_2m_max[i] === null ? '' : daily.temperature_2m_max[i]),
              low: String(daily.temperature_2m_min[i] === undefined || daily.temperature_2m_min[i] === null ? '' : daily.temperature_2m_min[i]),
              desc: ''
            }
          })
          resolve(days)
        } else reject(new Error('Forecast unavailable'))
      },
      fail: reject
    })
  })
}

module.exports = { getForecastMetro: getForecastMetro, weatherCodeIcon: weatherCodeIcon }
