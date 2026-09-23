var store = require('../../utils/store')
var favoriteService = require('../../utils/favorite-service')
var gaode = require('../../utils/gaode')
var cities = require('../../utils/cities')
var optimizer = require('../../utils/route-optimizer')
var shareCard = require('../../utils/share-card-renderer')
var routeData = require('../../utils/route-data')
var weatherService = require('../../utils/weather')
var schedule = require('../../utils/schedule')

var MAX_POINTS = 20

Page({
  data: {
    latitude: 39.9042,
    longitude: 116.4074,
    scale: 12,
    markers: [],
    polyline: null,
    polygons: [],
    points: [],
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
    showTimePanel: false,
    pointTimes: [],
    editingTimeIdx: -1,
    timePickValue: [0, 0],
    hourRange: [],
    minuteRange: [],
    savedRoutes: [],
    showSavedPanel: false,
    showPrivacy: false,
    routeTimeText: '',
    segmentTimes: [],
    weatherData: null,
    weatherLoading: false,
    weatherError: '',
    weatherExpanded: false,
    pointsHidden: false,
    shareCanvasH: 0,
    tripMode: false,
    tripIdx: 0,
    tripInfo: ''
  },

  onLoad: function(options) {
    this._segmentRouteCache = {}
    this._routeFetchId = 0
    this._tripFetchId = 0
    this._weatherRequestId = 0
    var app = getApp()
    if (app.globalData.showPrivacy) {
      this.setData({ showPrivacy: true })
    }
    this.mapCtx = wx.createMapContext('travelMap', this)
    this.setData({ markers: [], polyline: null })
    var provList = cities.PROVINCE_DATA.map(function(p) { return p.prov })
    var citySubList = cities.PROVINCE_DATA[1].cities
    this.setData({ provList: provList, citySubList: citySubList })
    this._fetchWeather(this.data.latitude, this.data.longitude)
    this.getUserLocation()
    this.loadSavedRoutes()
    if (options && options.share) {
      try {
        var d = JSON.parse(decodeURIComponent(options.share))
        if (d && d.p && Array.isArray(d.p) && d.p.length > 0 && d.p.length <= MAX_POINTS) {
          var valid = d.p.every(function(pt) {
            var lat, lng
            if (Array.isArray(pt)) {
              if (pt.length < 3) return false
              lat = pt[1]; lng = pt[2]
            } else {
              if (!pt) return false
              lat = pt.latitude; lng = pt.longitude
            }
            return typeof lat === 'number' && typeof lng === 'number' &&
              lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
          })
          if (valid) {
            var sharedPoints = routeData.normalizePoints(d.p.map(function(pt) {
              if (Array.isArray(pt)) {
                return { title: String(pt[0] || ''), latitude: pt[1], longitude: pt[2] }
              }
              return { title: pt.title || '', latitude: pt.latitude, longitude: pt.longitude }
            }), MAX_POINTS)
            store.set('selectedPoints', sharedPoints)
            this._sharedTimes = routeData.normalizeTimes(d.t, sharedPoints.length)
          }
        }
      } catch (e) { console.error('[share parse]', e) }
    }
    var hours = []
    for (var h = 0; h < 24; h++) { hours.push((h < 10 ? '0' : '') + h) }
    var minutes = []
    for (var m = 0; m < 60; m += 5) { minutes.push((m < 10 ? '0' : '') + m) }
    this.setData({ hourRange: hours, minuteRange: minutes })
    if (!options || !options.share) {
      this._restoreDraft()
    }
  },

  _restoreDraft: function() {
    var existing = store.get('selectedPoints') || []
    if (existing.length > 0) return
    try {
      var draft = wx.getStorageSync('draft_route')
      if (!draft || !Array.isArray(draft.points) || draft.points.length === 0) return
      var points = routeData.normalizePoints(draft.points, MAX_POINTS)
      if (points.length === 0) return
      store.set('selectedPoints', points)
      this._draftTimes = routeData.normalizeTimes(draft.times, points.length)
      if (draft.city && draft.city !== '全国') {
        store.set('currentCity', draft.city)
        this.setData({ cityName: draft.city })
        var that = this
        cities.PROVINCE_DATA.forEach(function(p, i) {
          var j = p.cities.indexOf(draft.city)
          if (j >= 0) {
            that.setData({ provIdx: i, citySubIdx: j, citySubList: p.cities })
          }
        })
      }
    } catch (e) { console.error('[draft restore]', e) }
  },

  _persistDraft: function() {
    try {
      wx.setStorageSync('draft_route', {
        points: this.data.points,
        times: this.data.pointTimes,
        city: this.data.cityName,
        savedAt: Date.now()
      })
    } catch (e) { console.error('[draft save]', e) }
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
        that._fetchWeather(res.latitude, res.longitude)
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
                  return
                }
              }
            }
          }
        }).catch(function(e) {
          console.error('[getLocation regeocode]', e)
        })
      },
      fail: function(e) {
        console.error('[getLocation]', e)
      }
    })
  },

  loadPoints: function() {
    var points = routeData.normalizePoints(store.get('selectedPoints'), MAX_POINTS)
    store.set('selectedPoints', points)
    this.setData({ points: points })
    var times
    if (this._sharedTimes) {
      times = this._sharedTimes.slice()
      this._sharedTimes = null
    } else if (this._draftTimes) {
      times = this._draftTimes.slice()
      this._draftTimes = null
    } else {
      times = this.data.pointTimes
    }
    times = routeData.normalizeTimes(times, points.length)
    this.setData({ pointTimes: times })
    this.renderMap()
    if (points.length > 0) this._persistDraft()
    if (points.length > 0) {
      var last = points[points.length - 1]
      this.setData({ latitude: last.latitude, longitude: last.longitude, scale: 14 })
      this.syncCityFromPoint(last)
    }
  },

  syncCityFromPoint: function(point) {
    this._fetchWeather(point.latitude, point.longitude)
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
            return
          }
        }
      }
    }).catch(function(e) { console.error('[regeocode city]', e) })
  },

  _fetchWeather: function(latitude, longitude) {
    if (!routeData.isValidCoordinate(latitude, longitude)) return
    this._weatherCoords = { latitude: latitude, longitude: longitude }
    var requestId = ++this._weatherRequestId
    var that = this
    this.setData({ weatherData: null, weatherLoading: true, weatherError: '', weatherExpanded: false })
    weatherService.getForecast(latitude, longitude).then(function(data) {
      if (that._weatherRequestId !== requestId) return
      that.setData({ weatherData: data, weatherLoading: false, weatherError: '' })
    }).catch(function(err) {
      if (that._weatherRequestId !== requestId) return
      console.error('[weather forecast]', err)
      that.setData({
        weatherLoading: false,
        weatherError: err && err.message ? err.message : '天气获取失败'
      })
    })
  },

  retryWeather: function() {
    var coords = this._weatherCoords || { latitude: this.data.latitude, longitude: this.data.longitude }
    this._fetchWeather(coords.latitude, coords.longitude)
  },

  toggleWeather: function() {
    if (!this.data.weatherData) return
    this.setData({ weatherExpanded: !this.data.weatherExpanded })
  },

  renderMap: function() {
    this._routeFetchId += 1
    var points = this.data.points
    if (points.length === 0) {
      this.setData({ markers: [], polyline: null, routeTimeText: '', segmentTimes: [], polygons: [] })
      return
    }

    var markers = points.filter(function(p) {
      return p && typeof p.latitude === 'number' && typeof p.longitude === 'number'
    }).map(function(p, i) {
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

    var polygons = []
    points.forEach(function(p) {
      var rect = optimizer.parseBounds(p.bounds)
      if (rect) {
        polygons.push({
          points: rect,
          fillColor: '#1989fa26',
          strokeColor: '#1989fa',
          strokeWidth: 2
        })
      }
    })

    this.setData({ markers: markers, polygons: polygons })

    if (points.length >= 2) {
      this.fetchRoutePolylines(points, this._routeFetchId)
    } else {
      this.setData({ polyline: null, routeTimeText: '', segmentTimes: [] })
    }
  },

  fetchRoutePolylines: function(points, fetchId) {
    var that = this
    that.setData({ routeTimeText: '计算中...', segmentTimes: [] })
    var city = this.data.cityName || ''

    function segmentPromise(origin, dest) {
      var cacheKey = [origin.lng, origin.lat, dest.lng, dest.lat, city].join('|')
      if (that._segmentRouteCache[cacheKey]) {
        return Promise.resolve(that._segmentRouteCache[cacheKey])
      }
      return gaode.transitRoute(origin, dest, city).then(function(data) {
        var route = data.route
        var coords = []
        var duration = 0
        var transits = route && route.transits
        if (transits && transits.length > 0) {
          var selected = transits[0]
          var minDuration = parseInt(selected.duration) || Infinity
          for (var t = 0; t < transits.length; t++) {
            var dur = parseInt(transits[t].duration) || 0
            if (dur > 0 && dur < minDuration) {
              minDuration = dur
              selected = transits[t]
            }
          }
          duration = minDuration < Infinity ? minDuration : 0
          var segs = selected.segments || []
          segs.forEach(function(seg) {
            if (seg.walking && seg.walking.steps) {
              seg.walking.steps.forEach(function(step) {
                if (step.polyline) coords = coords.concat(gaode.decodePolyline(step.polyline))
              })
            }
            if (seg.bus && seg.bus.buslines && seg.bus.buslines.length > 0) {
              var fl = null
              for (var b = 0; b < seg.bus.buslines.length; b++) {
                if (seg.bus.buslines[b] && seg.bus.buslines[b].polyline) {
                  fl = seg.bus.buslines[b]; break
                }
              }
              if (fl) coords = coords.concat(gaode.decodePolyline(fl.polyline))
            }
          })
        }
        if (transits && transits.length > 0 && coords.length === 0) {
          coords = [
            { longitude: origin.lng, latitude: origin.lat },
            { longitude: dest.lng, latitude: dest.lat }
          ]
        }
        var result = { coords: coords, duration: duration, success: !!(transits && transits.length) }
        if (result.success) that._segmentRouteCache[cacheKey] = result
        return result
      }).catch(function(e) {
        console.error('[route seg fail]', e)
        return { coords: [], duration: 0, success: false }
      })
    }

    var BATCH = 4
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
      if (that._routeFetchId !== fetchId) return
      var segmentTimes = []
      var totalSeconds = 0
      var successCount = 0
      var allCoords = []
      results.forEach(function(r) {
        if (r.success) successCount += 1
        allCoords = allCoords.concat(r.coords)
        segmentTimes.push(r.duration)
        totalSeconds += r.duration
      })
      if (successCount === 0) {
        that.setData({ routeTimeText: '路线计算失败，请重试', segmentTimes: segmentTimes, polyline: null })
        return
      }
      var hours = Math.floor(totalSeconds / 3600)
      var mins = Math.floor((totalSeconds % 3600) / 60)
      var timeText = ''
      if (hours > 0) timeText += hours + '小时 '
      timeText += mins + ' 分钟'
      var prefix = successCount < results.length ? '部分路段约 ' : '公交约 '
      that.setData({
        routeTimeText: prefix + timeText + ' · ' + successCount + '/' + segmentTimes.length + ' 个路段',
        segmentTimes: segmentTimes
      })
      var SEG_COLORS = [
        '#e64340', '#1989fa', '#ff8833', '#07c160',
        '#e040fb', '#00bcd4', '#ffab00', '#536dfe',
        '#d50000', '#009688', '#ff6d00', '#7c4dff'
      ]
      var polylines = []
      results.forEach(function(r, segIdx) {
        if (r.coords.length > 0) {
          polylines.push({
            points: r.coords,
            color: SEG_COLORS[segIdx % SEG_COLORS.length],
            width: 5, arrowLine: true,
            borderColor: '#ffffff', borderWidth: 2,
            dottedLine: segIdx % 2 === 1
          })
        }
      })
      if (polylines.length === 0) {
        polylines = [{
          points: allCoords,
          color: '#e64340', width: 5, arrowLine: true,
          borderColor: '#ffffff', borderWidth: 2
        }]
      }
      that.setData({ polyline: polylines })
    })
  },

  onMapTap: function(e) {
    if (!e.detail || !routeData.isValidCoordinate(e.detail.latitude, e.detail.longitude)) return
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
    if (!point || !routeData.isValidCoordinate(point.latitude, point.longitude)) {
      wx.showToast({ title: '无效坐标', icon: 'none' })
      return
    }
    if (this.data.points.length >= MAX_POINTS) {
      wx.showToast({ title: '最多添加' + MAX_POINTS + '个途经点', icon: 'none' })
      return
    }
    var points = this.data.points.slice()
    point.id = routeData.createPointId()
    points.push(point)
    this.setData({ points: points })
    store.set('selectedPoints', points)
    this.renderMap()
    this.setData({ latitude: point.latitude, longitude: point.longitude, scale: 14 })
    this.syncCityFromPoint(point)
    var times = this.data.pointTimes.slice()
    times.push('')
    this.setData({ pointTimes: times })
    this._persistDraft()
  },

  onPOITap: function(e) {
    var detail = e.detail || {}
    var name = detail.name || '地图位置'
    var lat = detail.latitude
    var lng = detail.longitude
    var addr = detail.address || ''
    if (!routeData.isValidCoordinate(lat, lng)) return
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
      itemList: ['查看路线', '删除此点'],
      success: function(res) {
        if (res.tapIndex === 0 && that.data.points.length >= 2) {
          wx.navigateTo({ url: '/pages/routes/routes' })
        } else if (res.tapIndex === 1) {
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
    this.setData({
      sorting: true, sortIdx: index,
      ghostTitle: item.title, ghostLabel: label,
      ghostY: touch.clientY - 30, sortStartY: touch.clientY
    })
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
    this._persistDraft()
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
    this._persistDraft()
  },

  autoFillTimes: function() {
    var points = this.data.points
    if (points.length < 2) return
    if (this.data.routeTimeText === '计算中...') {
      wx.showToast({ title: '路线仍在计算，请稍候', icon: 'none' })
      return
    }
    var result = schedule.buildSchedule(this.data.pointTimes[0] || '09:00', this.data.segmentTimes, points.length, 60)
    this.setData({ pointTimes: result.times })
    this._persistDraft()
    wx.showToast({
      title: result.usedFallback ? '部分路段按 60 分钟估算' : '已按路程填充',
      icon: 'none'
    })
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
    this._persistDraft()
  },

  focusPoint: function(e) {
    if (this.data.sorting) return
    var idx = e.currentTarget.dataset.index
    var p = this.data.points[idx]
    if (!p) return
    var that = this
    wx.showActionSheet({
      itemList: ['定位到此点', '查看路线'],
      success: function(res) {
        if (res.tapIndex === 0) {
          that.setData({ latitude: p.latitude, longitude: p.longitude, scale: 15 })
        } else if (res.tapIndex === 1 && that.data.points.length >= 2) {
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
    this._fetchWeather(coords.lat, coords.lng)
  },

  goRoutes: function() {
    wx.navigateTo({ url: '/pages/routes/routes' })
  },

  loadSavedRoutes: function() {
    this.setData({ savedRoutes: favoriteService.list() })
  },

  saveRoute: function() {
    var points = this.data.points
    if (points.length === 0) { wx.showToast({ title: '请先添加途经点', icon: 'none' }); return }
    var defName = (points[0] && points[0].title ? points[0].title : '') + ' 等' + points.length + '站'
    var that = this
    wx.showModal({
      title: '收藏路线',
      editable: true,
      placeholderText: defName,
      success: function(res) {
        if (!res.confirm) return
        var name = (res.content || '').trim() || defName
        var saved = favoriteService.add(points, that.data.pointTimes, that.data.cityName, name)
        if (!saved) {
          wx.showToast({ title: '收藏失败，请重试', icon: 'none' })
          return
        }
        that.setData({ savedRoutes: favoriteService.list() })
        wx.showToast({ title: '已收藏「' + name + '」', icon: 'success' })
      }
    })
  },

  loadRoute: function(e) {
    var id = e.currentTarget.dataset.id
    var route = favoriteService.getById(id)
    if (!route) return
    var points = routeData.normalizePoints(route.points, MAX_POINTS)
    var times = routeData.normalizeTimes(route.times, points.length)
    this.setData({ points: points, pointTimes: times, showSavedPanel: false })
    store.set('selectedPoints', points)
    this.renderMap()
    this._persistDraft()
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
          if (routes) {
            that.setData({ savedRoutes: routes })
            wx.showToast({ title: '已删除', icon: 'none' })
          } else {
            wx.showToast({ title: '删除失败，请重试', icon: 'none' })
          }
        }
      }
    })
  },

  toggleSavedPanel: function() {
    this.setData({ showSavedPanel: !this.data.showSavedPanel })
  },

  togglePoints: function() {
    this.setData({ pointsHidden: !this.data.pointsHidden })
  },

  drawShareCard: function() {
    var points = this.data.points
    if (points.length === 0) {
      wx.showToast({ title: '请先添加途经点', icon: 'none' })
      return
    }
    var times = this.data.pointTimes
    var cityName = this.data.cityName || ''
    var H = shareCard.calcHeight(points.length)
    var that = this
    this.setData({ shareCanvasH: H }, function() {
      var ctx = wx.createCanvasContext('shareCanvas', that)
      shareCard.drawShareCard(ctx, points, times, cityName)
      ctx.draw(false, function() {
        setTimeout(function() {
          wx.canvasToTempFilePath({
            canvasId: 'shareCanvas',
            width: 375, height: H,
            destWidth: 750, destHeight: H * 2,
            success: function(res) {
              wx.showActionSheet({
                itemList: ['保存到相册', '转发给朋友'],
                success: function(r) {
                  if (r.tapIndex === 0) {
                    wx.saveImageToPhotosAlbum({
                      filePath: res.tempFilePath,
                      success: function() { wx.showToast({ title: '已保存到相册', icon: 'success' }) },
                      fail: function(e) {
                        if (e.errMsg && e.errMsg.indexOf('auth') !== -1) {
                          wx.showModal({
                            title: '需要相册权限',
                            content: '请在设置中开启保存到相册的权限',
                            confirmText: '去设置',
                            success: function(m) {
                              if (m.confirm) wx.openSetting()
                            }
                          })
                        } else {
                          wx.showToast({ title: '保存失败', icon: 'none' })
                        }
                      }
                    })
                  } else if (r.tapIndex === 1) {
                    wx.showShareImageMenu({ path: res.tempFilePath })
                  }
                }
              })
            },
            fail: function(e) { console.error('[share card]', e) }
          })
        }, 120)
      })
    })
  },

  onShareAppMessage: function() {
    var points = this.data.points
    var title = points.length > 0 ? (points[0].title + ' → ' + points[points.length - 1].title) : '旅行规划'
    var path = '/pages/index/index'
    if (points.length > 0) {
      var payload = {
        p: points.map(function(pt) {
          var t = pt.title || ''
          if (t.length > 8) t = t.slice(0, 8)
          return [t, Math.round(pt.latitude * 1e5) / 1e5, Math.round(pt.longitude * 1e5) / 1e5]
        }),
        t: this.data.pointTimes
      }
      var share = encodeURIComponent(JSON.stringify(payload))
      if (share.length < 2200) path += '?share=' + share
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
          that._routeFetchId += 1
          that._tripFetchId += 1
          that.setData({ points: [], markers: [], polyline: null, polygons: [], pointTimes: [], routeTimeText: '' })
          store.set('selectedPoints', [])
          try { wx.removeStorageSync('draft_route') } catch (e) {}
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
      app._privacyResolve({ event: 'agree' })
      app._privacyResolve = null
    }
  },

  disagreePrivacy: function() {
    var app = getApp()
    this.setData({ showPrivacy: false })
    app.globalData.showPrivacy = false
    if (app._privacyResolve) {
      app._privacyResolve({ event: 'disagree' })
      app._privacyResolve = null
    }
    wx.showModal({
      title: '提示',
      content: '部分功能需要位置权限，您可以在设置中手动开启。',
      showCancel: false
    })
  },

  onSavedLoad: function(e) {
    var id = e.detail.id
    this.loadRoute({ currentTarget: { dataset: { id: id } } })
  },

  onSavedDelete: function(e) {
    this.deleteSavedRoute({ currentTarget: { dataset: { id: e.detail.id } } })
  },

  onSavedClose: function() {
    this.toggleSavedPanel()
  },

  copyItinerary: function() {
    var pts = this.data.points
    if (pts.length === 0) {
      wx.showToast({ title: '请先添加途经点', icon: 'none' })
      return
    }
    var times = this.data.pointTimes
    var lines = []
    lines.push('【旅行路线】' + (this.data.cityName ? this.data.cityName + ' · ' : '') + pts.length + '个地点')
    pts.forEach(function(p, i) {
      var t = times[i] ? times[i] + ' ' : ''
      lines.push((i + 1) + '. ' + t + (p.title || '未命名地点'))
    })
    if (/\d+\s*分钟/.test(this.data.routeTimeText)) {
      lines.push('预计用时：' + this.data.routeTimeText.replace(/^(公交约|部分路段约|至少约)\s*/, '').replace(/\s*·\s*\d+(?:\/\d+)?\s*个路段$/, ''))
    }
    wx.setClipboardData({
      data: lines.join('\n'),
      success: function() { wx.showToast({ title: '行程已复制', icon: 'success' }) }
    })
  },

  startTrip: function() {
    if (this.data.points.length < 2) {
      wx.showToast({ title: '至少需要 2 个途经点', icon: 'none' })
      return
    }
    this._routeFetchId += 1
    this._tripFetchId += 1
    this.setData({ tripMode: true, tripIdx: 0, pointsHidden: false })
    this._tripFetch()
  },

  _tripFetch: function() {
    var idx = this.data.tripIdx
    var pts = this.data.points
    if (idx >= pts.length - 1) return
    var that = this
    var origin = { lng: pts[idx].longitude, lat: pts[idx].latitude }
    var dest = { lng: pts[idx + 1].longitude, lat: pts[idx + 1].latitude }
    var fetchId = ++this._tripFetchId
    this.setData({ tripInfo: '路线规划中...' })
    gaode.transitRoute(origin, dest, this.data.cityName || '').then(function(data) {
      if (!that.data.tripMode || that.data.tripIdx !== idx || that._tripFetchId !== fetchId) return
      var transits = (data.route && data.route.transits) || []
      if (transits.length === 0) {
        that.setData({ tripInfo: '未找到公交路线' })
        return
      }
      var selected = transits[0]
      var minDur = parseInt(selected.duration) || Infinity
      transits.forEach(function(t) {
        var dur = parseInt(t.duration) || 0
        if (dur > 0 && dur < minDur) {
          minDur = dur
          selected = t
        }
      })
      var walkingM = parseInt(selected.walking_distance) || 0
      var timeText = minDur < Infinity ? '约 ' + Math.round(minDur / 60) + ' 分钟' : '已找到公交路线'
      that.setData({ tripInfo: timeText + (walkingM > 0 ? ' · 步行 ' + Math.round(walkingM / 100) / 10 + ' 公里' : '') })

      var coords = []
      var segs = selected.segments || []
      segs.forEach(function(seg) {
        if (seg.walking && seg.walking.steps) {
          seg.walking.steps.forEach(function(step) {
            if (step.polyline) coords = coords.concat(gaode.decodePolyline(step.polyline))
          })
        }
        if (seg.bus && seg.bus.buslines && seg.bus.buslines.length > 0) {
          var fl = seg.bus.buslines[0]
          if (fl && fl.polyline) coords = coords.concat(gaode.decodePolyline(fl.polyline))
        }
      })
      var tripMarkers = [
        { id: 0, latitude: pts[idx].latitude, longitude: pts[idx].longitude, width: 30, height: 30,
          callout: { content: '📍 ' + pts[idx].title, display: 'ALWAYS', borderRadius: 4, padding: 6, bgColor: '#07c160' } },
        { id: 1, latitude: pts[idx + 1].latitude, longitude: pts[idx + 1].longitude, width: 30, height: 30,
          callout: { content: '下一站 ' + pts[idx + 1].title, display: 'ALWAYS', borderRadius: 4, padding: 6, bgColor: '#1989fa' } }
      ]
      that.setData({
        markers: tripMarkers,
        polyline: [{
          points: coords.length > 0 ? coords : [
            { latitude: pts[idx].latitude, longitude: pts[idx].longitude },
            { latitude: pts[idx + 1].latitude, longitude: pts[idx + 1].longitude }
          ],
          color: '#1989fa', width: 6, arrowLine: true, borderColor: '#ffffff', borderWidth: 2
        }],
        latitude: (pts[idx].latitude + pts[idx + 1].latitude) / 2,
        longitude: (pts[idx].longitude + pts[idx + 1].longitude) / 2
      })
      if (that.mapCtx) {
        var allPts = [
          { latitude: pts[idx].latitude, longitude: pts[idx].longitude },
          { latitude: pts[idx + 1].latitude, longitude: pts[idx + 1].longitude }
        ]
        that.mapCtx.includePoints({ points: allPts.concat(coords), padding: [40, 40, 40, 40] })
      }
    }).catch(function(e) {
      if (!that.data.tripMode || that.data.tripIdx !== idx || that._tripFetchId !== fetchId) return
      console.error('[trip fetch]', e)
      that.setData({ tripInfo: '路线获取失败' })
    })
  },

  tripArrive: function() {
    var idx = this.data.tripIdx
    var pts = this.data.points
    if (idx >= pts.length - 2) {
      wx.showToast({ title: '🎉 行程完成！', icon: 'success' })
      this.exitTrip()
      return
    }
    var that = this
    this.setData({ tripIdx: idx + 1 }, function() { that._tripFetch() })
  },

  exitTrip: function() {
    this._tripFetchId += 1
    this.setData({ tripMode: false, tripIdx: 0, tripInfo: '' })
    this.renderMap()
  }
})
