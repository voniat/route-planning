var store = require('../../utils/store')
var gaode = require('../../utils/gaode')

var LINE_COLORS = [
  '#e64340', '#1989fa', '#9c27b0', '#ff4081', '#009688'
]
var WALK_COLOR = '#1989fa'

function buildLineColorMap(segments) {
  var colorMap = {}
  var names = []
  segments.forEach(function(s) {
    if (s.bus && s.bus.buslines && s.bus.buslines.length > 0) {
      var n = s.bus.buslines[0].name
      if (n && names.indexOf(n) === -1) names.push(n)
    }
  })
  names.forEach(function(n, i) {
    colorMap[n] = LINE_COLORS[i % LINE_COLORS.length]
  })
  return colorMap
}

Page({
  data: {
    points: [],
    segments: [],
    segIdx: 0,
    activeTab: 'transit',
    transitSchemeIdx: 0,
    allTransits: [],
    loading: false,
    routeData: null,
    latitude: 39.9042,
    longitude: 116.4074,
    scale: 10,
    markers: [],
    polyline: [],
    fullMap: false
  },

  toggleFullMap: function() {
    this.setData({ fullMap: !this.data.fullMap })
  },

  onTaxiTap: function(e) {
    var from = e.currentTarget.dataset.from || '当前位置'
    var to = e.currentTarget.dataset.to || '目的地'
    wx.showModal({
      title: '🚕 建议打车',
      content: '上车：' + from + '\n下车：' + to,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  toggleAltLines: function(e) {
    var idx = parseInt(e.currentTarget.dataset.index)
    var steps = this.data.routeData && this.data.routeData.steps
    if (!steps || idx < 0 || idx >= steps.length) return
    var key = 'routeData.steps[' + idx + '].altExpanded'
    var val = !(steps[idx].altExpanded)
    var obj = {}
    obj[key] = val
    this.setData(obj)
  },

  onLoad: function() {
    this._routeCache = {}
    this.routeMapCtx = wx.createMapContext('routeMap', this)
    var points = store.get('selectedPoints') || []
    var segments = []
    for (var i = 0; i < points.length - 1; i++) {
      segments.push({
        from: points[i].title,
        to: points[i + 1].title,
        fromLat: points[i].latitude,
        fromLng: points[i].longitude,
        toLat: points[i + 1].latitude,
        toLng: points[i + 1].longitude
      })
    }
    this.setData({ points: points, segments: segments })
    if (segments.length > 0) {
      this.loadRoute(0)
    }
  },

  switchSegment: function(e) {
    var idx = e.currentTarget.dataset.index
    this.setData({ segIdx: idx })
    this.loadRoute(idx)
  },

  switchTab: function(e) {
    var tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab, transitSchemeIdx: 0, allTransits: [] })
    this.loadRoute(this.data.segIdx)
  },

  switchTransitScheme: function(e) {
    var idx = parseInt(e.currentTarget.dataset.index)
    var tab = this.data.activeTab
    if (tab !== 'transit' || idx >= this.data.allTransits.length) return
    this.setData({ transitSchemeIdx: idx })

    var seg = this.data.segments[this.data.segIdx]
    if (!seg) return
    var origin = { lng: seg.fromLng, lat: seg.fromLat }
    var dest = { lng: seg.toLng, lat: seg.toLat }
    var that = this
    this.setData({ loading: true, routeData: null })
    gaode.transitRoute(origin, dest, store.get('currentCity') || '').then(function(data) {
      that.setData({ loading: false })
      var route = data.route
      if (!route || !route.transits || !route.transits[idx]) {
        wx.showToast({ title: '方案不可用', icon: 'none' })
        return
      }
      var transit = route.transits[idx]
      transit.segments.forEach(function(s) { s._from = seg.from; s._to = seg.to })
      var lineColorMap = buildLineColorMap(transit.segments)
      var steps = that.parseTransitSteps(transit, lineColorMap)
      var polylines = that.buildTransitPolylines(transit, lineColorMap)
      that.setData({
        routeData: {
          steps: steps,
          distance: (parseFloat(transit.distance || 0) / 1000).toFixed(1),
          duration: Math.round(parseFloat(transit.duration || 0) / 60),
          cost: transit.cost || 0
        },
        polyline: polylines
      }, function() {
        var allPts = [{ latitude: seg.fromLat, longitude: seg.fromLng }, { latitude: seg.toLat, longitude: seg.toLng }]
        polylines.forEach(function(pl) {
          if (pl.points && pl.points.length) allPts = allPts.concat(pl.points)
        })
        if (that.routeMapCtx) {
          that.routeMapCtx.includePoints({ points: allPts, padding: [40, 40, 40, 40] })
        }
      })
    }).catch(function(err) {
      that.setData({ loading: false })
      wx.showToast({ title: '切换失败', icon: 'none' })
    })
  },

  loadRoute: function(idx) {
    var seg = this.data.segments[idx]
    if (!seg) return

    var tab = this.data.activeTab
    var cacheKey = idx + '_' + tab
    if (this._routeCache[cacheKey]) {
      var cached = this._routeCache[cacheKey]
      this.setData({
        routeData: cached.routeData,
        latitude: cached.latitude, longitude: cached.longitude,
        markers: cached.markers, polyline: cached.polyline,
        allTransits: cached.allTransits || [], transitSchemeIdx: cached.transitSchemeIdx || 0,
        loading: false
      })
      return
    }

    this.setData({ loading: true, routeData: null })

    var origin = { lng: seg.fromLng, lat: seg.fromLat }
    var dest = { lng: seg.toLng, lat: seg.toLat }

    var promise
    switch (tab) {
      case 'transit': promise = gaode.transitRoute(origin, dest, store.get('currentCity') || ''); break
      case 'walking': promise = gaode.walkingRoute(origin, dest); break
      default: promise = gaode.transitRoute(origin, dest, store.get('currentCity') || '')
    }

    var that = this
    var fetchId = Date.now()
    this._routeFetchId = fetchId
    promise.then(function(data) {
      if (that._routeFetchId !== fetchId) return
      that.setData({ loading: false })

      var route
      if (tab === 'transit') {
        route = data.route
      } else {
        var path = data.route && data.route.paths ? data.route.paths[0] : null
        route = path
      }

      if (!route || (tab === 'transit' && (!route.transits || route.transits.length === 0)) ||
          (tab !== 'transit' && !route.steps && !route.distance)) {
        wx.showToast({ title: '未找到路线', icon: 'none' })
        that.setData({ routeData: null })
        return
      }

      var routeData = {}
      if (tab === 'transit' && route.transits) {
        var allTransits = route.transits.map(function(t) { return { cost: t.cost || 0, distance: t.distance, duration: t.duration } })
        var transit = route.transits[0]
        transit.segments.forEach(function(s) {
          s._from = seg.from
          s._to = seg.to
        })
        var lineColorMap = buildLineColorMap(transit.segments)
        var steps = that.parseTransitSteps(transit, lineColorMap)
        routeData = {
          steps: steps,
          distance: (parseFloat(transit.distance || 0) / 1000).toFixed(1),
          duration: Math.round(parseFloat(transit.duration || 0) / 60),
          cost: transit.cost || 0
        }
        that.setData({ allTransits: allTransits, transitSchemeIdx: 0 })
      } else if (route.steps) {
        routeData = {
          steps: route.steps.map(function(s) {
            return {
              instruction: s.instruction || '',
              distance: parseInt(s.distance) || 0,
              duration: Math.round((parseInt(s.duration) || 0) / 60)
            }
          }),
          distance: (parseFloat(route.distance || 0) / 1000).toFixed(1),
          duration: Math.round(parseFloat(route.duration || 0) / 60)
        }
      } else if (route.distance) {
        routeData = {
          steps: [],
          distance: (parseFloat(route.distance || 0) / 1000).toFixed(1),
          duration: Math.round(parseFloat(route.duration || 0) / 60)
        }
      }

      var polylines = []
      if (tab === 'transit' && route.transits) {
        polylines = that.buildTransitPolylines(route.transits[0], lineColorMap)
      } else if (route.steps) {
        var walkPoints = []
        route.steps.forEach(function(step) {
          if (step.polyline) walkPoints = walkPoints.concat(gaode.decodePolyline(step.polyline))
        })
        if (walkPoints.length > 0) {
          polylines.push({ points: walkPoints, color: WALK_COLOR, width: 4, arrowLine: true })
        }
      }

      if (polylines.length === 0) {
        polylines = []
      }

      var center = {
        latitude: (seg.fromLat + seg.toLat) / 2,
        longitude: (seg.fromLng + seg.toLng) / 2
      }

      var markers = [
        { id: 0, latitude: seg.fromLat, longitude: seg.fromLng, width: 30, height: 30,
          callout: { content: seg.from, display: 'ALWAYS', borderRadius: 4, padding: 6 } },
        { id: 1, latitude: seg.toLat, longitude: seg.toLng, width: 30, height: 30,
          callout: { content: seg.to, display: 'ALWAYS', borderRadius: 4, padding: 6 } }
      ]

      that.setData({
        routeData: routeData,
        latitude: center.latitude,
        longitude: center.longitude,
        markers: markers,
        polyline: polylines
      }, function() {
        that._routeCache[cacheKey] = {
          routeData: routeData,
          latitude: center.latitude, longitude: center.longitude,
          markers: markers, polyline: polylines,
          allTransits: that.data.allTransits, transitSchemeIdx: that.data.transitSchemeIdx
        }
        var allPts = [{ latitude: seg.fromLat, longitude: seg.fromLng }, { latitude: seg.toLat, longitude: seg.toLng }]
        polylines.forEach(function(pl) {
          if (pl.points && pl.points.length) allPts = allPts.concat(pl.points)
        })
        if (that.routeMapCtx) {
          that.routeMapCtx.includePoints({ points: allPts, padding: [40, 40, 40, 40] })
        }
      })
    }).catch(function(err) {
      that.setData({ loading: false })
      wx.showToast({ title: err.message || '路线规划失败', icon: 'none' })
    })
  },

  buildTransitPolylines: function(transit, lineColorMap) {
    var polylines = []
    var segs = transit.segments || []
    segs.forEach(function(s) {
      if (s.walking && s.walking.steps) {
        var walkPoints = []
        s.walking.steps.forEach(function(step) {
          if (step.polyline) walkPoints = walkPoints.concat(gaode.decodePolyline(step.polyline))
        })
        if (walkPoints.length > 0) {
          polylines.push({ points: walkPoints, color: WALK_COLOR, width: 4, arrowLine: true, dottedLine: true })
        }
      }
      if (s.bus && s.bus.buslines && s.bus.buslines.length > 0) {
        var fl = s.bus.buslines[0]
        if (fl && fl.polyline) {
          var busPoints = gaode.decodePolyline(fl.polyline)
          if (busPoints.length > 0) {
            var lc = lineColorMap[fl.name] || '#1989fa'
            polylines.push({ points: busPoints, color: lc, width: 5, arrowLine: true, borderColor: '#ffffff', borderWidth: 2 })
          }
        }
      }
    })
    return polylines
  },

  parseTransitSteps: function(transit, lineColorMap) {
    var steps = []
    var segs = transit.segments || []
    var that = this
    segs.forEach(function(seg, segIdx) {
      if (seg.walking) steps.push(that._buildWalkingStep(seg, segs, segIdx))
      if (seg.bus && seg.bus.buslines && seg.bus.buslines.length > 0) steps.push(that._buildBusStep(seg.bus, lineColorMap))
    })
    return steps
  },

  _buildWalkingStep: function(seg, segs, segIdx) {
    var dur = Math.round((parseInt(seg.walking.duration) || 0) / 60)
    var fromName = '', toName = ''
    if (segIdx === 0) {
      fromName = seg._from || '起点'
    } else {
      var prevSeg = segs[segIdx - 1]
      if (prevSeg && prevSeg.bus && prevSeg.bus.buslines && prevSeg.bus.buslines[0]) {
        fromName = (prevSeg.bus.buslines[0].arrival_stop && prevSeg.bus.buslines[0].arrival_stop.name) || ''
      }
    }
    if (seg.bus && seg.bus.buslines && seg.bus.buslines[0]) {
      toName = (seg.bus.buslines[0].departure_stop && seg.bus.buslines[0].departure_stop.name) || ''
    } else if (segIdx === segs.length - 1) {
      toName = seg._to || '终点'
    }
    return {
      mode: 'WALKING',
      instruction: seg.walking.instruction || '步行前往',
      distance: parseInt(seg.walking.distance) || 0,
      duration: dur,
      transitType: '🚶 步行',
      fromName: fromName,
      toName: toName || '',
      showTaxi: dur > 20
    }
  },

  _buildBusStep: function(bus, lineColorMap) {
    var mainLine = bus.buslines[0]
    var typeTag = mainLine.type || ''
    var isMetro = typeTag.indexOf('地铁') !== -1 || typeTag.indexOf('SUBWAY') !== -1
    var isRail = typeTag.indexOf('火车') !== -1 || typeTag.indexOf('高铁') !== -1 || typeTag.indexOf('RAIL') !== -1
    var transitType = '🚌 公交'
    if (isMetro) transitType = '🚇 地铁'
    else if (isRail) transitType = '🚄 高铁/火车'
    var others = []
    for (var k = 1; k < bus.buslines.length; k++) {
      var ol = bus.buslines[k]
      others.push({
        name: ol.name,
        from: (ol.departure_stop && ol.departure_stop.name) || '',
        to: (ol.arrival_stop && ol.arrival_stop.name) || ''
      })
    }
    var lc = (lineColorMap && lineColorMap[mainLine.name]) || '#1989fa'
    return {
      mode: 'TRANSIT',
      instruction: '乘坐 ' + mainLine.name,
      distance: parseInt(mainLine.distance) || 0,
      duration: Math.round((parseInt(mainLine.duration) || 0) / 60),
      transitType: transitType,
      lineName: mainLine.name,
      lineColor: lc,
      fromStation: (mainLine.departure_stop && mainLine.departure_stop.name) || '',
      toStation: (mainLine.arrival_stop && mainLine.arrival_stop.name) || '',
      stations: parseInt(mainLine.via_num) || 0,
      altLines: others,
      altExpanded: false
    }
  }
})
