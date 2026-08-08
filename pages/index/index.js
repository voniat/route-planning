var store = require('../../utils/store')
var common = require('../../utils/common')
var favoriteService = require('../../utils/favorite-service')
var gaode = require('../../utils/gaode')
var cities = require('../../utils/cities')
var foodScorer = require('../../utils/food-scorer')

function parseBounds(bounds) {
  if (!bounds || typeof bounds !== 'string') return null
  var out = []
  var pts = bounds.split(';')
  for (var i = 0; i < pts.length; i++) {
    var parts = pts[i].split(',')
    var lng = parseFloat(parts[0])
    var lat = parseFloat(parts[1])
    if (!isNaN(lng) && !isNaN(lat)) out.push({ longitude: lng, latitude: lat })
  }
  if (out.length < 2) return null
  var minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  out.forEach(function(p) {
    if (p.longitude < minLng) minLng = p.longitude
    if (p.latitude < minLat) minLat = p.latitude
    if (p.longitude > maxLng) maxLng = p.longitude
    if (p.latitude > maxLat) maxLat = p.latitude
  })
  return [
    { longitude: minLng, latitude: minLat },
    { longitude: maxLng, latitude: minLat },
    { longitude: maxLng, latitude: maxLat },
    { longitude: minLng, latitude: maxLat }
  ]
}

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
    foodResults: [],
    showFoodPanel: false,
    foodLoading: false,
    pointsHidden: false,
    shareCanvasH: 0,
    aiBtnX: 0,
    aiBtnY: 0
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
    this.loadSavedRoutes()
    this._initAiBtn()
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
            store.set('selectedPoints', d.p.map(function(pt) {
              if (Array.isArray(pt)) {
                return { title: String(pt[0] || ''), latitude: pt[1], longitude: pt[2] }
              }
              return { title: pt.title || '', latitude: pt.latitude, longitude: pt.longitude }
            }))
            if (Array.isArray(d.t)) {
              this._sharedTimes = d.t
            }
          }
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
    var kw = store.get('nearbyKeyword')
    var pidx = store.get('nearbyPointIdx')
    if (kw && pidx != null) {
      store.set('nearbyKeyword', null)
      store.set('nearbyPointIdx', null)
      var that = this
      setTimeout(function() { that._searchFoodNear(pidx, kw) }, 400)
    }
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
    var points = store.get('selectedPoints') || []
    this.setData({ points: points })
    var times
    if (this._sharedTimes && this._sharedTimes.length) {
      times = this._sharedTimes.slice()
      this._sharedTimes = null
    } else {
      times = this.data.pointTimes
    }
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
            return
          }
        }
      }
    }).catch(function(e) { console.error('[regeocode city]', e) })
  },

  renderMap: function() {
    var points = this.data.points
    if (points.length === 0) {
      this.setData({ markers: [], polyline: null, routeTimeText: '', polygons: [] })
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
      var rect = parseBounds(p.bounds)
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
      this.fetchRoutePolylines(points)
    } else {
      this.setData({ polyline: null, routeTimeText: '' })
    }
  },

  fetchRoutePolylines: function(points) {
    var that = this
    var fetchId = Date.now()
    this._routeFetchId = fetchId
    that.setData({ routeTimeText: '计算中...' })
    var city = this.data.cityName || ''

    function segmentPromise(origin, dest) {
      return gaode.transitRoute(origin, dest, city).then(function(data) {
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
      if (that._routeFetchId !== fetchId) return
      var segmentTimes = []
      var totalSeconds = 0
      var anySuccess = false
      var allCoords = []
      results.forEach(function(r) {
        if (r.coords.length > 0) anySuccess = true
        allCoords = allCoords.concat(r.coords)
        segmentTimes.push(r.duration)
        totalSeconds += r.duration
      })
      if (!anySuccess) {
        that.setData({ routeTimeText: '路线计算失败，请重试', polyline: null })
        return
      }
      var hours = Math.floor(totalSeconds / 3600)
      var mins = Math.floor((totalSeconds % 3600) / 60)
      var timeText = ''
      if (hours > 0) timeText += hours + '小时 '
      timeText += mins + ' 分钟'
      that.setData({ routeTimeText: '至少约 ' + timeText + ' · ' + segmentTimes.length + ' 个路段' })
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
        th = th % 24
        times[i] = (th < 10 ? '0' : '') + th + ':' + (tm < 10 ? '0' : '') + tm
      }
      h += 1
      if (h >= 24) h = h % 24
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

  goAgent: function() {
    var city = this.data.cityName || '北京'
    wx.navigateTo({ url: '/pages/agent/agent?city=' + encodeURIComponent(city) })
  },

  _initAiBtn: function() {
    var sys = wx.getSystemInfoSync()
    var saved = wx.getStorageSync('aiBtnPos')
    var x = saved && typeof saved.x === 'number' ? saved.x : sys.windowWidth - 55
    var y = saved && typeof saved.y === 'number' ? saved.y : sys.windowHeight - 200
    this.setData({ aiBtnX: x, aiBtnY: y })
  },

  onAiBtnStart: function(e) {
    this._aiDrag = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      origX: this.data.aiBtnX,
      origY: this.data.aiBtnY,
      moved: false
    }
    this.setData({ aiDragging: true })
  },

  onAiBtnMove: function(e) {
    if (!this._aiDrag) return
    var dx = e.touches[0].clientX - this._aiDrag.startX
    var dy = e.touches[0].clientY - this._aiDrag.startY
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this._aiDrag.moved = true
    this.setData({
      aiBtnX: this._aiDrag.origX + dx,
      aiBtnY: this._aiDrag.origY + dy
    })
  },

  onAiBtnEnd: function(e) {
    if (!this._aiDrag) return
    if (this._aiDrag.moved) {
      wx.setStorageSync('aiBtnPos', { x: this.data.aiBtnX, y: this.data.aiBtnY })
    }
    this._aiDrag = null
    this.setData({ aiDragging: false })
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
        favoriteService.add(points, that.data.pointTimes, that.data.cityName, name)
        that.setData({ savedRoutes: favoriteService.list() })
        wx.showToast({ title: '已收藏「' + name + '」', icon: 'success' })
      }
    })
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

  togglePoints: function() {
    this.setData({ pointsHidden: !this.data.pointsHidden })
  },

  drawShareCard: function() {
    var points = this.data.points
    if (points.length === 0) {
      wx.showToast({ title: '请先添加途经点', icon: 'none' })
      return
    }
    var W = 375
    var PAD = 20
    var HEADER = 92
    var ITEM_H = 62
    var FOOTER = 56
    var H = HEADER + ITEM_H * points.length + FOOTER
    var times = this.data.pointTimes
    var cityName = this.data.cityName || ''
    var that = this
    this.setData({ shareCanvasH: H }, function() {
      var ctx = wx.createCanvasContext('shareCanvas', that)
      ctx.setFillStyle('#ffffff')
      ctx.fillRect(0, 0, W, H)
      var grad = ctx.createLinearGradient(0, 0, W, 0)
      grad.addColorStop(0, '#1989fa')
      grad.addColorStop(1, '#07c160')
      ctx.setFillStyle(grad)
      ctx.fillRect(0, 0, W, HEADER)
      ctx.setFillStyle('#ffffff')
      ctx.setFontSize(20)
      ctx.fillText('今日行程 · ' + cityName, PAD, 42)
      var now = new Date()
      ctx.setFontSize(13)
      ctx.fillText('规划于 ' + (now.getMonth() + 1) + '月' + now.getDate() + '日', PAD, 66)
      for (var i = 0; i < points.length; i++) {
        var p = points[i]
        var y = HEADER + i * ITEM_H + ITEM_H / 2
        var cy = y - 9
        ctx.beginPath()
        ctx.arc(PAD + 12, cy, 11, 0, Math.PI * 2)
        var c = '#1989fa'
        if (i === 0) c = '#07c160'
        else if (i === points.length - 1) c = '#e64340'
        ctx.setFillStyle(c)
        ctx.fill()
        ctx.setFillStyle('#ffffff')
        ctx.setFontSize(13)
        ctx.fillText(String(i + 1), PAD + 8, y - 4)
        var name = p.title || ''
        ctx.setFillStyle('#333333')
        ctx.setFontSize(16)
        ctx.fillText(that._truncateText(ctx, name, W - PAD * 2 - 36 - 70), PAD + 36, y)
        var t = times[i] || ''
        if (t) {
          ctx.setFillStyle('#1989fa')
          ctx.setFontSize(13)
          ctx.fillText(t, W - PAD - 60, y)
        }
        if (i < points.length - 1) {
          ctx.setStrokeStyle('#f0f0f0')
          ctx.setLineWidth(1)
          ctx.beginPath()
          ctx.moveTo(PAD + 36, HEADER + (i + 1) * ITEM_H)
          ctx.lineTo(W - PAD, HEADER + (i + 1) * ITEM_H)
          ctx.stroke()
        }
      }
      ctx.setFillStyle('#999999')
      ctx.setFontSize(12)
      ctx.fillText('旅行路线规划 · ' + points.length + ' 个地点', PAD, H - 24)
      ctx.draw(false, function() {
        setTimeout(function() {
          wx.canvasToTempFilePath({
            canvasId: 'shareCanvas',
            width: W, height: H,
            destWidth: W * 2, destHeight: H * 2,
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

  _truncateText: function(ctx, text, maxW) {
    if (!text) return ''
    if (ctx.measureText(text).width <= maxW) return text
    while (text.length > 1) {
      text = text.slice(0, text.length - 1)
      if (ctx.measureText(text + '…').width <= maxW) break
    }
    return text + '…'
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
          that.setData({ points: [], markers: [], polyline: null, polygons: [], pointTimes: [], routeTimeText: '' })
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

  _searchFoodNear: function(pointIdx, keyword) {
    var p = this.data.points[pointIdx]
    if (!p) return
    this._foodPointIdx = pointIdx
    var that = this
    var kw = keyword || '美食|餐厅|小吃|火锅|面馆|快餐|咖啡|奶茶|烧烤|日料'
    this.setData({ foodResults: [], showFoodPanel: true, foodLoading: true })
    gaode.poiAround(p.longitude, p.latitude, kw, 3000).then(function(data) {
      var results = foodScorer.scoreFoodPois(data.pois)
      that.setData({ foodResults: results, foodLoading: false })
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
