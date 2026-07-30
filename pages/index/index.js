var store = require('../../utils/store')
var common = require('../../utils/common')
var favoriteService = require('../../utils/favorite-service')
var routeService = require('../../utils/route-service')
var gaode = require('../../utils/gaode')
var cities = require('../../utils/cities')
var weather = require('../../utils/weather')

function fetchCityWeatherFn(ctx) {
  var city = ctx.data.cityName
  if (!city || city === '全国') return
  var coords = cities.CITY_COORDS[city]
  if (!coords) return
  weather.getForecastMetro(coords.lat, coords.lng).then(function(days) {
    if (ctx.data.cityName !== city) return
    ctx.setData({ weatherDays: days, selectedWeatherDay: 0, weatherPageStart: 0 })
  }).catch(function(e) { console.error('[weather forecast]', e) })
}

var MAX_POINTS = 20

Page({
  data: {
    latitude: 39.9042,
    longitude: 116.4074,
    scale: 12,
    markers: [],
    polyline: null,
    points: [],
    mapCtx: null,
    provList: [],
    citySubList: [],
    provIdx: 1,
    citySubIdx: 0,
    cityName: '北京',
    showCityPanel: false,
    pickerProvIdx: 1,
    pickerCityIdx: 0,
    sorting: false,
    sortIdx: -1,
    ghostTitle: '',
    ghostLabel: '',
    ghostY: 0,
    sortStartY: 0,
    weatherDays: [],
    selectedWeatherDay: 0,
    weatherPageStart: 0,
    showTimePanel: false,
    pointTimes: [],
    editingTimeIdx: -1,
    timePickValue: [0, 0],
    hourRange: [],
    minuteRange: [],
    savedRoutes: [],
    showSavedPanel: false,
    showPrivacy: false,
    segmentTimes: [],
    totalRouteTime: 0,
    routeTimeText: '',
    foodResults: [],
    showFoodPanel: false,
    foodLoading: false
  },

  onLoad: function(options) {
    var app = getApp()
    if (app.globalData.showPrivacy) {
      this.setData({ showPrivacy: true })
    }
    this.mapCtx = wx.createMapContext('travelMap', this)
    this.setData({ markers: [], polyline: null })
    var provList = cities.PROVINCE_DATA.map(function(p) { return p.prov })
    var citySubList = cities.PROVINCE_DATA[1].cities
    this.setData({ provList: provList, citySubList: citySubList })
    this.getUserLocation()
    fetchCityWeatherFn(this)
    this.loadSavedRoutes()
    if (options && options.share) {
      try {
        var d = JSON.parse(decodeURIComponent(options.share))
        if (d && d.p && Array.isArray(d.p) && d.p.length > 0 && d.p.length <= MAX_POINTS) {
          var valid = d.p.every(function(pt) {
            return pt && typeof pt.latitude === 'number' && typeof pt.longitude === 'number' &&
              pt.latitude >= -90 && pt.latitude <= 90 && pt.longitude >= -180 && pt.longitude <= 180
          })
          if (valid) store.set('selectedPoints', d.p)
        }
      } catch (e) { console.error('[share parse]', e) }
    }
    var hours = []
    for (var h = 0; h < 24; h++) { hours.push((h < 10 ? '0' : '') + h) }
    var minutes = []
    for (var m = 0; m < 60; m += 5) { minutes.push((m < 10 ? '0' : '') + m) }
    this.setData({ hourRange: hours, minuteRange: minutes })
  },

  onReady: function() {
    this._firstLoadDone = true
    this.loadPoints()
  },

  onShow: function() {
    if (this._firstLoadDone) this.loadPoints()
  },

  getUserLocation: function() {
    var that = this
    wx.getLocation({
      type: 'wgs84',
      success: function(res) {
        var points = store.get('selectedPoints') || []
        if (points.length === 0) {
          that.setData({ latitude: res.latitude, longitude: res.longitude })
        }
        gaode.regeocode(res.longitude, res.latitude).then(function(data) {
          var addr = data.regeocode || {}
          var city = (addr.addressComponent && addr.addressComponent.city) || ''
          if (!city) city = (addr.addressComponent && addr.addressComponent.province) || ''
          if (city) {
            city = city.replace('市', '').replace('省', '')
            var points = store.get('selectedPoints') || []
            if (points.length > 0) return
            for (var i = 0; i < cities.PROVINCE_DATA.length; i++) {
              var provCities = cities.PROVINCE_DATA[i].cities
              for (var j = 0; j < provCities.length; j++) {
                if (provCities[j].indexOf(city) !== -1 || city.indexOf(provCities[j]) !== -1) {
                  that.setData({ provIdx: i, citySubIdx: j, cityName: provCities[j], citySubList: cities.PROVINCE_DATA[i].cities })
                  store.set('currentCity', provCities[j])
                  fetchCityWeatherFn(that)
                  return
                }
              }
            }
          }
        })
      },
      fail: function(e) { console.error('[getLocation]', e) }
    })
  },

  loadPoints: function() {
    var points = store.get('selectedPoints') || []
    this.setData({ points: points })
    var times = this.data.pointTimes
    while (times.length < points.length) times.push('')
    if (times.length > points.length) times = times.slice(0, points.length)
    this.setData({ pointTimes: times })
    this.renderMap()
    if (points.length > 0) {
      var last = points[points.length - 1]
      this.setData({ latitude: last.latitude, longitude: last.longitude, scale: 14 })
      this.syncCityFromPoint(last)
    }
  },

  syncCityFromPoint: function(point) {
    var that = this
    gaode.regeocode(point.longitude, point.latitude).then(function(data) {
      var addr = data.regeocode || {}
      var city = (addr.addressComponent && addr.addressComponent.city) || ''
      if (!city) city = (addr.addressComponent && addr.addressComponent.province) || ''
      if (!city || city === that.data.cityName) return
      city = city.replace('市', '').replace('省', '')
      for (var i = 0; i < cities.PROVINCE_DATA.length; i++) {
        var provCities = cities.PROVINCE_DATA[i].cities
        for (var j = 0; j < provCities.length; j++) {
          if (provCities[j].indexOf(city) !== -1 || city.indexOf(provCities[j]) !== -1) {
            that.setData({ provIdx: i, citySubIdx: j, cityName: provCities[j], citySubList: cities.PROVINCE_DATA[i].cities })
            store.set('currentCity', provCities[j])
            fetchCityWeatherFn(that)
            return
          }
        }
      }
    }).catch(function(e) { console.error('[regeocode city]', e) })
  },

  onWeatherDayTap: function(e) {
    var idx = parseInt(e.currentTarget.dataset.index)
    this.setData({ selectedWeatherDay: idx })
  },

  prevWeatherPage: function() {
    var s = this.data.weatherPageStart
    if (s >= 3) this.setData({ weatherPageStart: s - 3 })
  },

  nextWeatherPage: function() {
    var s = this.data.weatherPageStart
    var max = this.data.weatherDays.length - 3
    if (s < max) this.setData({ weatherPageStart: s + 3 })
  },

  onWeatherTouchStart: function(e) {
    this._weatherTouchX = e.touches[0].clientX
  },

  onWeatherTouchEnd: function(e) {
    var dx = e.changedTouches[0].clientX - (this._weatherTouchX || 0)
    if (dx < -50) this.nextWeatherPage()
    else if (dx > 50) this.prevWeatherPage()
  },

  renderMap: function() {
    var points = this.data.points
    if (points.length === 0) {
      this.setData({ markers: [], polyline: null, segmentTimes: [], totalRouteTime: 0, routeTimeText: '' })
      return
    }

    var markers = points.filter(function(p) { return p && p.latitude && p.longitude }).map(function(p, i) {
      var isStart = i === 0
      var isEnd = i === points.length - 1 && points.length > 1
      var callout = {}
      if (isStart) callout = { content: '起点', display: 'ALWAYS', borderRadius: 4, padding: 6, bgColor: '#07c160' }
      else if (isEnd) callout = { content: '终点', display: 'ALWAYS', borderRadius: 4, padding: 6, bgColor: '#e64340' }
      else callout = { content: '第' + i + '站', display: 'ALWAYS', borderRadius: 4, padding: 4 }
      return {
        id: i, latitude: p.latitude, longitude: p.longitude,
        title: p.title, callout: callout, width: 30, height: 30
      }
    })

    this.setData({ markers: markers })

    if (points.length >= 2) {
      this.fetchRoutePolylines(points)
    } else {
      this.setData({ polyline: null, segmentTimes: [], totalRouteTime: 0, routeTimeText: '' })
    }
  },

  fetchRoutePolylines: function(points) {
    var that = this
    that.setData({ routeTimeText: '计算中...' })
    var city = this.data.cityName || ''

    function segmentPromise(origin, dest) {
      return routeService.transitRoute(origin, dest, city).then(function(data) {
        var route = data.route
        var coords = []
        var duration = 0
        var transits = route && route.transits
        if (transits && transits.length > 0) {
          var minDuration = Infinity
          for (var t = 0; t < transits.length; t++) {
            var dur = parseInt(transits[t].duration) || 0
            if (dur > 0 && dur < minDuration) minDuration = dur
          }
          duration = minDuration < Infinity ? minDuration : 0
          var segs = transits[0].segments || []
          segs.forEach(function(seg) {
            if (seg.walking && seg.walking.steps) {
              seg.walking.steps.forEach(function(step) {
                if (step.polyline) coords = coords.concat(routeService.decodePolyline(step.polyline))
              })
            }
            if (seg.bus && seg.bus.buslines && seg.bus.buslines.length > 0) {
              var fl = null
              for (var b = 0; b < seg.bus.buslines.length; b++) {
                if (seg.bus.buslines[b] && seg.bus.buslines[b].polyline) {
                  fl = seg.bus.buslines[b]; break
                }
              }
              if (fl) coords = coords.concat(routeService.decodePolyline(fl.polyline))
            }
          })
        }
        return { coords: coords, duration: duration }
      }).catch(function(e) {
        console.error('[route seg fail]', e)
        return { coords: [], duration: 0 }
      })
    }

    var BATCH = 8
    function runBatched(start, results) {
      var end = Math.min(start + BATCH, points.length - 1)
      var batch = []
      for (var i = start; i < end; i++) {
        batch.push(segmentPromise(
          { lng: points[i].longitude, lat: points[i].latitude },
          { lng: points[i + 1].longitude, lat: points[i + 1].latitude }
        ))
      }
      return Promise.all(batch).then(function(batchResults) {
        results = results.concat(batchResults)
        if (end < points.length - 1) {
          return runBatched(end, results)
        }
        return results
      })
    }

    runBatched(0, []).then(function(results) {
      var allCoords = []
      var segmentTimes = []
      var totalSeconds = 0
      var anySuccess = false
      results.forEach(function(r) {
        if (r.coords.length > 0) anySuccess = true
        allCoords = allCoords.concat(r.coords)
        segmentTimes.push(r.duration)
        totalSeconds += r.duration
      })
      if (!anySuccess) {
        that.setData({ routeTimeText: '路线计算失败，请重试' })
        return
      }
      var hours = Math.floor(totalSeconds / 3600)
      var mins = Math.floor((totalSeconds % 3600) / 60)
      var timeText = ''
      if (hours > 0) timeText += hours + '小时 '
      timeText += mins + ' 分钟'
      that.setData({ segmentTimes: segmentTimes, routeTimeText: '至少约 ' + timeText + ' · ' + segmentTimes.length + ' 个路段' })
      if (allCoords.length > 0) {
        that.setData({
          polyline: [{
            points: allCoords,
            color: '#e64340', width: 4, arrowLine: true,
            borderColor: '#ffffff', borderWidth: 2
          }]
        })
      } else {
        that.setData({ polyline: null })
      }
    })
  },

  onMapTap: function(e) {
    if (!e.detail || !e.detail.latitude) return
    var lat = e.detail.latitude
    var lng = e.detail.longitude
    var that = this
    gaode.regeocode(lng, lat).then(function(data) {
      var addr = (data.regeocode && data.regeocode.formatted_address) || '未知地点'
      wx.showModal({
        title: '添加此地点?',
        content: addr,
        success: function(res) {
          if (res.confirm) that.addPoint({ title: addr, latitude: lat, longitude: lng })
        }
      })
    }).catch(function(e) {
      console.error('[map tap regeocode]', e)
      wx.showModal({
        title: '添加此地点?',
        content: lat.toFixed(4) + ', ' + lng.toFixed(4),
        success: function(res) {
          if (res.confirm) that.addPoint({ title: lat.toFixed(4) + ', ' + lng.toFixed(4), latitude: lat, longitude: lng })
        }
      })
    })
  },

  addPoint: function(point) {
    if (!point || typeof point.latitude !== 'number' || typeof point.longitude !== 'number' ||
        point.latitude < -90 || point.latitude > 90 || point.longitude < -180 || point.longitude > 180) {
      wx.showToast({ title: '无效坐标', icon: 'none' })
      return
    }
    if (this.data.points.length >= MAX_POINTS) {
      wx.showToast({ title: '最多添加' + MAX_POINTS + '个途经点', icon: 'none' })
      return
    }
    var points = this.data.points.slice()
    point.id = Date.now()
    points.push(point)
    this.setData({ points: points })
    store.set('selectedPoints', points)
    this.renderMap()
    this.setData({ latitude: point.latitude, longitude: point.longitude, scale: 14 })
    this.syncCityFromPoint(point)
    var times = this.data.pointTimes.slice()
    times.push('')
    this.setData({ pointTimes: times })
  },

  onPOITap: function(e) {
    var detail = e.detail || {}
    var name = detail.name || '地图位置'
    var lat = detail.latitude
    var lng = detail.longitude
    var addr = detail.address || ''
    if (!lat || !lng) return
    var that = this
    wx.showModal({
        title: '添加「' + name + '」?',
      content: addr,
      success: function(res) {
        if (res.confirm) that.addPoint({ title: name, latitude: lat, longitude: lng, address: addr })
      }
    })
  },

  onMarkerTap: function(e) {
    var that = this
    wx.showActionSheet({
      itemList: ['查看路线', '搜附近美食', '删除此点'],
      success: function(res) {
        if (res.tapIndex === 0 && that.data.points.length >= 2) {
          store.set('currentIndex', e.detail.markerId)
          wx.navigateTo({ url: '/pages/routes/routes' })
        } else if (res.tapIndex === 1) {
          that._searchFoodNear(e.detail.markerId)
        } else if (res.tapIndex === 2) {
          that.removePointByIdx(e.detail.markerId)
        }
      }
    })
  },

  removePoint: function(e) {
    if (this.data.sorting) return
    this.removePointByIdx(e.currentTarget.dataset.index)
  },

  onPointLongPress: function(e) {
    var index = e.currentTarget.dataset.index
    var item = this.data.points[index]
    if (!item) return
    var touch = e.touches[0]
    var label = index === 0 ? '起' : (index === this.data.points.length - 1 ? '终' : String(index))
    wx.vibrateShort({ type: 'light' })
    var that = this
    if (!that._itemH) {
      wx.createSelectorQuery().select('.point-item').boundingClientRect(function(ir) {
        that._itemH = (ir && ir.height) ? ir.height : 62
      }).exec()
    }
    wx.createSelectorQuery().select('.point-list').boundingClientRect(function(rect) {
      that.setData({
        sorting: true, sortIdx: index,
        ghostTitle: item.title, ghostLabel: label,
        ghostY: touch.clientY - 30, sortStartY: touch.clientY
      })
    }).exec()
  },

  onSortMove: function(e) {
    if (!this.data.sorting || this.data.sortIdx < 0) return
    var touch = e.touches[0]
    var dy = touch.clientY - this.data.sortStartY
    var itemH = this._itemH || 62
    var offset = Math.round(dy / itemH)
    var newIdx = this.data.sortIdx + offset
    if (newIdx < 0) newIdx = 0
    if (newIdx > this.data.points.length - 1) newIdx = this.data.points.length - 1
    if (newIdx !== this.data.sortIdx) {
      this.reorderPoints(this.data.sortIdx, newIdx)
      this.setData({ sortIdx: newIdx, sortStartY: touch.clientY, ghostY: touch.clientY - 30 })
    } else {
      this.setData({ ghostY: touch.clientY - 30 })
    }
  },

  onSortEnd: function() {
    if (!this.data.sorting) return
    this.setData({ sorting: false, sortIdx: -1, ghostTitle: '', ghostLabel: '', ghostY: 0, sortStartY: 0 })
    var that = this
    clearTimeout(this._sortEndTimer)
    this._sortEndTimer = setTimeout(function() { that.renderMap() }, 400)
  },

  reorderPoints: function(fromIdx, toIdx) {
    var points = this.data.points.slice()
    var item = points.splice(fromIdx, 1)[0]
    points.splice(toIdx, 0, item)
    this.setData({ points: points })
    store.set('selectedPoints', points)
    var times = this.data.pointTimes.slice()
    var t = times.splice(fromIdx, 1)[0]
    times.splice(toIdx, 0, t)
    this.setData({ pointTimes: times })
  },

  optimizeRoute: function() {
    var points = this.data.points.slice()
    if (points.length < 3) {
      wx.showToast({ title: '起终点之间至少加1个中途点', icon: 'none' })
      return
    }
    var start = points[0]
    var middle = points.slice(1, points.length - 1)
    var end = points[points.length - 1]
    var times = this.data.pointTimes.slice()
    var startTime = times[0]
    var middleTimes = times.slice(1, times.length - 1)
    var endTime = times[times.length - 1]

    var result = [start]
    var resultTimes = [startTime]
    var current = start
    var remaining = middle.slice()
    var remainingTimes = middleTimes.slice()

    while (remaining.length > 0) {
      var nearestIdx = 0
      var minDist = Infinity
      for (var i = 0; i < remaining.length; i++) {
        var d = common.haversine(current.latitude, current.longitude, remaining[i].latitude, remaining[i].longitude)
        if (d < minDist) { minDist = d; nearestIdx = i }
      }
      current = remaining.splice(nearestIdx, 1)[0]
      result.push(current)
      resultTimes.push(remainingTimes.splice(nearestIdx, 1)[0])
    }
    result.push(end)
    resultTimes.push(endTime)

    this.setData({ points: result, pointTimes: resultTimes })
    store.set('selectedPoints', result)
    this.renderMap()
    wx.showToast({ title: '已按最短路径重排', icon: 'success' })
  },

  toggleTimePanel: function() {
    this.setData({ showTimePanel: !this.data.showTimePanel })
  },

  openTimePicker: function(e) {
    var idx = parseInt(e.currentTarget.dataset.index)
    var t = this.data.pointTimes[idx] || '09:00'
    var parts = t.split(':')
    var h = parseInt(parts[0]), m = parseInt(parts[1])
    var hi = h, mi = Math.round(m / 5)
    if (mi >= 12) { mi = 0; hi = (hi + 1) % 24 }
    this.setData({ editingTimeIdx: idx, timePickValue: [hi, mi] })
  },

  closeTimePicker: function() {
    this.setData({ editingTimeIdx: -1 })
  },

  onTimePickChange: function(e) {
    this.setData({ timePickValue: e.detail.value })
  },

  confirmTimePicker: function() {
    var v = this.data.timePickValue
    var idx = this.data.editingTimeIdx
    if (idx < 0) return
    var h = parseInt(this.data.hourRange[v[0]]) || 0
    var m = parseInt(this.data.minuteRange[v[1]]) || 0
    var times = this.data.pointTimes.slice()
    times[idx] = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m
    this.setData({ pointTimes: times, editingTimeIdx: -1 })
  },

  onTimeChange: function(e) {
    var idx = parseInt(e.currentTarget.dataset.index)
    var val = e.detail.value
    var times = this.data.pointTimes.slice()
    times[idx] = val
    this.setData({ pointTimes: times })
  },

  autoFillTimes: function() {
    var points = this.data.points
    if (points.length < 2) return
    var times = this.data.pointTimes.slice()
    if (!times[0]) times[0] = '09:00'
    var base = times[0].split(':')
    var h = parseInt(base[0]), m = parseInt(base[1])
    for (var i = 0; i < points.length; i++) {
      if (!times[i]) {
        var th = h, tm = m
        if (tm >= 60) { th += 1; tm -= 60 }
        times[i] = (th < 10 ? '0' : '') + th + ':' + (tm < 10 ? '0' : '') + tm
      }
      h += 1
    }
    this.setData({ pointTimes: times })
  },

  removePointByIdx: function(idx) {
    var points = this.data.points.slice()
    points.splice(idx, 1)
    this.setData({ points: points })
    store.set('selectedPoints', points)
    var times = this.data.pointTimes.slice()
    times.splice(idx, 1)
    this.setData({ pointTimes: times })
    this.renderMap()
  },

  focusPoint: function(e) {
    if (this.data.sorting) return
    var idx = e.currentTarget.dataset.index
    var p = this.data.points[idx]
    if (!p) return
    var that = this
    wx.showActionSheet({
      itemList: ['定位到此点', '搜附近美食', '查看路线'],
      success: function(res) {
        if (res.tapIndex === 0) {
          that.setData({ latitude: p.latitude, longitude: p.longitude, scale: 15 })
        } else if (res.tapIndex === 1) {
          that._searchFoodNear(idx)
        } else if (res.tapIndex === 2 && that.data.points.length >= 2) {
          store.set('currentIndex', idx)
          wx.navigateTo({ url: '/pages/routes/routes' })
        }
      }
    })
  },

  goSearch: function() {
    var lat = this.data.latitude
    var lng = this.data.longitude
    var city = this.data.cityName
    wx.navigateTo({ url: '/pages/search/search?centerLat=' + lat + '&centerLng=' + lng + '&city=' + encodeURIComponent(city) })
  },

  showCityPicker: function() {
    this.setData({
      showCityPanel: true,
      pickerProvIdx: this.data.provIdx,
      pickerCityIdx: this.data.citySubIdx,
      citySubList: cities.PROVINCE_DATA[this.data.provIdx].cities
    })
  },

  hideCityPicker: function() {
    this.setData({ showCityPanel: false })
  },

  onCityPickChange: function(e) {
    var vals = e.detail.value
    if (vals[0] !== this.data.pickerProvIdx) {
      this.setData({ citySubList: cities.PROVINCE_DATA[vals[0]].cities, pickerCityIdx: 0 })
    }
    this.setData({ pickerProvIdx: vals[0], pickerCityIdx: vals[1] || 0 })
  },

  confirmCityPick: function() {
    var provIdx = this.data.pickerProvIdx
    var cityIdx = this.data.pickerCityIdx
    var cityName = cities.PROVINCE_DATA[provIdx].cities[cityIdx]
    if (!cityName) return
    var coords = cities.CITY_COORDS[cityName]
    if (!coords) return
    var isNational = cityName === '全国'
    this.setData({
      provIdx: provIdx, citySubIdx: cityIdx, cityName: cityName,
      citySubList: cities.PROVINCE_DATA[provIdx].cities,
      latitude: coords.lat, longitude: coords.lng,
      scale: isNational ? 4 : 11, showCityPanel: false
    })
    store.set('currentCity', isNational ? '' : cityName)
    fetchCityWeatherFn(this)
  },

  goRoutes: function() {
    store.set('currentIndex', 0)
    wx.navigateTo({ url: '/pages/routes/routes' })
  },

  loadSavedRoutes: function() {
    this.setData({ savedRoutes: favoriteService.list() })
  },

  saveRoute: function() {
    var points = this.data.points
    if (points.length === 0) { wx.showToast({ title: '请先添加途经点', icon: 'none' }); return }
    favoriteService.add(points, this.data.pointTimes, this.data.cityName)
    this.setData({ savedRoutes: favoriteService.list() })
    wx.showToast({ title: '已收藏', icon: 'success' })
  },

  loadRoute: function(e) {
    var id = e.currentTarget.dataset.id
    var route = favoriteService.getById(id)
    if (!route) return
    var points = route.points.slice()
    this.setData({ points: points, pointTimes: route.times || [], showSavedPanel: false })
    store.set('selectedPoints', points)
    this.renderMap()
    if (points.length > 0) {
      this.setData({ latitude: points[points.length - 1].latitude, longitude: points[points.length - 1].longitude, scale: 14 })
      this.syncCityFromPoint(points[points.length - 1])
    }
    wx.showToast({ title: '已加载', icon: 'success' })
  },

  deleteSavedRoute: function(e) {
    var id = e.currentTarget.dataset.id
    var that = this
    wx.showModal({
      title: '删除收藏',
      content: '确定要删除这条路线吗？',
      success: function(res) {
        if (res.confirm) {
          var routes = favoriteService.remove(id)
          if (routes) that.setData({ savedRoutes: routes })
          wx.showToast({ title: '已删除', icon: 'none' })
        }
      }
    })
  },

  toggleSavedPanel: function() {
    this.setData({ showSavedPanel: !this.data.showSavedPanel })
  },

  onShareAppMessage: function() {
    var points = this.data.points
    var title = points.length > 0 ? (points[0].title + ' → ' + points[points.length - 1].title) : '旅行规划'
    var path = '/pages/index/index'
    if (points.length > 0) {
      var d = JSON.stringify({ p: points, t: this.data.pointTimes })
      if (d.length < 800) path += '?share=' + encodeURIComponent(d)
    }
    return {
      title: title + ' · ' + points.length + '个地点',
      path: path
    }
  },

  clearAll: function() {
    var that = this
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有途经点吗？',
      success: function(res) {
        if (res.confirm) {
          that.setData({ points: [], markers: [], polyline: null, pointTimes: [], segmentTimes: [], totalRouteTime: 0, routeTimeText: '' })
          store.set('selectedPoints', [])
          if (that.mapCtx) that.mapCtx.moveToLocation()
        }
      }
    })
  },

  agreePrivacy: function() {
    var app = getApp()
    this.setData({ showPrivacy: false })
    app.globalData.showPrivacy = false
    if (app._privacyResolve) {
      app._privacyResolve({ buttonId: 'agree', event: 'agree' })
    }
    this.getUserLocation()
  },

  disagreePrivacy: function() {
    var app = getApp()
    this.setData({ showPrivacy: false })
    app.globalData.showPrivacy = false
    if (app._privacyResolve) {
      app._privacyResolve({ buttonId: 'disagree', event: 'disagree' })
    }
    wx.showModal({
      title: '提示',
      content: '部分功能需要位置权限，您可以在设置中手动开启。',
      showCancel: false
    })
  },

  _searchFoodNear: function(pointIdx) {
    var p = this.data.points[pointIdx]
    if (!p) return
    this._foodPointIdx = pointIdx
    var that = this
    this.setData({ foodResults: [], showFoodPanel: true, foodLoading: true })
    gaode.poiAround(p.longitude, p.latitude, '美食|餐厅|小吃|火锅|面馆|快餐|咖啡|奶茶|烧烤|日料', 3000).then(function(data) {
      var pois = (data.pois || []).map(function(item) {
        var loc = (item.location || '').split(',')
        return {
          name: item.name || '',
          address: item.address || '',
          lat: parseFloat(loc[1]) || 0,
          lng: parseFloat(loc[0]) || 0,
          distance: parseInt(item.distance) || 0,
          rating: item.biz_ext && item.biz_ext.rating ? parseFloat(item.biz_ext.rating) : 0
        }
      }).filter(function(item) { return item.name && item.lat })
      var ALPHA = 0.3
      var maxDist = 0
      pois.forEach(function(item) { if (item.distance > maxDist) maxDist = item.distance })
      pois.forEach(function(item) {
        var distScore = maxDist > 0 ? (1 - item.distance / maxDist) : 1
        var ratingScore = item.rating > 0 ? item.rating / 5 : 0.5
        item._score = ALPHA * distScore + (1 - ALPHA) * ratingScore
        item._distKm = item.distance >= 1000 ? (item.distance / 1000).toFixed(1) + 'km' : item.distance + 'm'
        var full = item.rating > 0 ? Math.round(item.rating) : 0
        var empty = item.rating > 0 ? 5 - full : 0
        item._stars = ''
        for (var s = 0; s < full; s++) item._stars += '★'
        for (var s = 0; s < empty; s++) item._stars += '☆'
      })
      pois.sort(function(a, b) { return b._score - a._score })
      that.setData({ foodResults: pois.slice(0, 20), foodLoading: false })
    }).catch(function(e) {
      console.error('[food search]', e)
      that.setData({ foodLoading: false })
      wx.showToast({ title: '搜索失败', icon: 'none' })
    })
  },

  closeFoodPanel: function() {
    this.setData({ showFoodPanel: false, foodResults: [] })
  },

  _addFoodToRoute: function(e) {
    var idx = parseInt(e.currentTarget.dataset.index)
    var food = this.data.foodResults[idx]
    if (!food) return
    if (this.data.points.length >= MAX_POINTS) {
      wx.showToast({ title: '最多添加' + MAX_POINTS + '个途经点', icon: 'none' })
      return
    }
    var points = this.data.points.slice()
    var insertAt = this._foodPointIdx + 1
    if (insertAt > points.length) insertAt = points.length
    points.splice(insertAt, 0, {
      id: Date.now(),
      title: food.name,
      latitude: food.lat,
      longitude: food.lng,
      address: food.address
    })
    this.setData({ points: points })
    store.set('selectedPoints', points)
    var times = this.data.pointTimes.slice()
    times.splice(insertAt, 0, '')
    this.setData({ pointTimes: times })
    this.renderMap()
    this.setData({ showFoodPanel: false, foodResults: [] })
    wx.showToast({ title: '已添加 ' + food.name, icon: 'success' })
  }
})
