var store = require('../../utils/store')
var common = require('../../utils/common')
var gaode = require('../../utils/gaode')
var cities = require('../../utils/cities')
var routeData = require('../../utils/route-data')
var MAX_POINTS = 20

function detectCity(kw) {
  var all = []
  cities.PROVINCE_DATA.forEach(function(p) { all = all.concat(p.cities) })
  var sorted = all.filter(function(c) { return c !== '全国' }).sort(function(a, b) { return b.length - a.length })
  for (var i = 0; i < sorted.length; i++) {
    if (kw.indexOf(sorted[i]) >= 0) return sorted[i]
  }
  return ''
}

function doSearchRequest(ctx, kw, requestId) {
  var city = detectCity(kw) || (store.get('currentCity') || '')
  gaode.poiSearch(kw, city).then(function(data) {
    if (ctx._searchRequestId !== requestId) return
    ctx._searching = false
    wx.hideLoading()
    var added = store.get('selectedPoints') || []
    var pois = data.pois || data.poi_list || data.results || data.list || []
    var results = cleanResults(pois, added)

    var points = store.get('selectedPoints') || []
    if (points.length > 0) {
      var last = points[points.length - 1]
      results.forEach(function(r) {
        r._dist = common.haversine(last.latitude, last.longitude, r.latitude, r.longitude)
        r._distStr = common.formatDist(r._dist)
      })
    }

    ctx.setData({ results: results, searched: true })
  }).catch(function(err) {
    if (ctx._searchRequestId !== requestId) return
    ctx._searching = false
    wx.hideLoading()
    wx.showToast({ title: err.message || '搜索失败', icon: 'none' })
  })
}

function cleanResults(rawList, added) {
  var seen = {}
  var results = []
  rawList.forEach(function(item, i) {
    var loc = (item.location || '').split(',')
    var lat = parseFloat(loc[1])
    var lng = parseFloat(loc[0])
    if (!routeData.isValidCoordinate(lat, lng)) return
    var key = lat.toFixed(5) + ',' + lng.toFixed(5)
    if (seen[key]) return
    seen[key] = true
    var photoUrl = ''
    var photos = item.photos || []
    if (photos.length > 0 && photos[0] && photos[0].url) {
      photoUrl = photos[0].url.replace('http://', 'https://')
    }
    results.push({
      id: item.id || 'poi-' + i,
      title: item.name || item.title || '',
      address: item.address || item.addr || '',
      latitude: lat,
      longitude: lng,
      bounds: item.bounds || '',
      typecode: item.typecode || '',
      photo: photoUrl,
      added: added.some(function(p) {
        return Math.abs(p.latitude - lat) < 0.0001 && Math.abs(p.longitude - lng) < 0.0001
      })
    })
  })
  return results
}

Page({
  data: {
    keyword: '',
    results: [],
    suggestions: [],
    searched: false,
    showSuggestions: false,
    history: []
  },

  onLoad: function(options) {
    this._suggestRequestId = 0
    this._searchRequestId = 0
    if (options && options.city && !store.get('currentCity')) {
      store.set('currentCity', decodeURIComponent(options.city))
    }
    try {
      var h = wx.getStorageSync('search_history') || []
      this.setData({ history: Array.isArray(h) ? h : [] })
    } catch (e) { this.setData({ history: [] }) }
  },

  _saveHistory: function(kw) {
    var history = this.data.history.slice()
    var existingIdx = -1
    for (var i = 0; i < history.length; i++) {
      if (history[i] === kw) { existingIdx = i; break }
    }
    if (existingIdx >= 0) history.splice(existingIdx, 1)
    history.unshift(kw)
    if (history.length > 10) history.pop()
    this.setData({ history: history })
    try { wx.setStorageSync('search_history', history) } catch (e) {}
  },

  onInput: function(e) {
    var kw = (e.detail.value || '').slice(0, 50)
    var wasSearching = this._searching
    this._searching = false
    this._searchRequestId += 1
    if (wasSearching) wx.hideLoading()
    this.setData({ keyword: kw })
    this._suggestRequestId += 1
    if (!kw.trim()) { this.setData({ suggestions: [], showSuggestions: false }); return }
    var that = this
    var requestId = this._suggestRequestId
    clearTimeout(this._inputTimer)
    this._inputTimer = setTimeout(function() {
      gaode.inputTips(kw, store.get('currentCity') || '').then(function(data) {
        if (that._searching || that._suggestRequestId !== requestId || that.data.keyword !== kw) return
        var tips = data.tips || []
        var suggestions = tips.filter(function(t) { return t && t.name }).slice(0, 10).map(function(t, index) {
          return {
            name: t.name,
            district: t.district || '',
            id: t.id || '',
            _key: (t.id || t.name + '|' + (t.district || '')) + '|' + index
          }
        })
        that.setData({ suggestions: suggestions, showSuggestions: suggestions.length > 0 })
      }).catch(function(e) { console.error('[search inputTips]', e) })
    }, 300)
  },

  selectSuggestion: function(e) {
    var name = e.currentTarget.dataset.name
    if (!name) return
    this.setData({ keyword: name, suggestions: [], showSuggestions: false })
    this.doSearch()
  },

  hideSuggestions: function() {
    var that = this
    setTimeout(function() { that.setData({ showSuggestions: false }) }, 200)
  },

  doSearch: function() {
    var kw = this.data.keyword.trim()
    if (!kw) return
    clearTimeout(this._inputTimer)
    this._searching = true
    this._suggestRequestId += 1
    this._searchRequestId += 1
    var requestId = this._searchRequestId
    this.setData({ results: [], searched: false, suggestions: [], showSuggestions: false })
    wx.showLoading({ title: '搜索中...' })
    var that = this
    this._saveHistory(kw)
    doSearchRequest(that, kw, requestId)
  },

  tapHistory: function(e) {
    var kw = e.currentTarget.dataset.kw
    if (!kw) return
    this.setData({ keyword: kw })
    this.doSearch()
  },

  clearHistory: function() {
    this.setData({ history: [] })
    try { wx.setStorageSync('search_history', []) } catch (e) {}
  },

  deleteHistoryItem: function(e) {
    var idx = parseInt(e.currentTarget.dataset.index)
    var history = this.data.history.slice()
    if (idx < 0 || idx >= history.length) return
    history.splice(idx, 1)
    this.setData({ history: history })
    try { wx.setStorageSync('search_history', history) } catch (e) {}
  },

  onPhotoError: function(e) {
    var idx = parseInt(e.currentTarget.dataset.index)
    if (idx >= 0 && idx < this.data.results.length) {
      var obj = {}
      obj['results[' + idx + '].photo'] = ''
      this.setData(obj)
    }
  },

  previewPhoto: function(e) {
    var url = e.currentTarget.dataset.url
    if (!url) return
    wx.previewImage({ urls: [url] })
  },

  selectResult: function(e) {
    if (this._selecting) return
    var id = e.currentTarget.dataset.id
    var results = this.data.results
    var idx = -1
    for (var i = 0; i < results.length; i++) {
      if (String(results[i].id) === String(id)) { idx = i; break }
    }
    if (idx === -1) return
    var item = results[idx]
    this._selecting = true
    var points = (store.get('selectedPoints') || []).slice()
    if (points.length >= MAX_POINTS) {
      wx.showToast({ title: '最多添加' + MAX_POINTS + '个途经点', icon: 'none' })
      this._selecting = false
      return
    }
    points.push({
      id: routeData.createPointId(),
      poiId: item.id || '',
      title: item.title,
      latitude: item.latitude,
      longitude: item.longitude,
      address: item.address,
      bounds: item.bounds || '',
      typecode: item.typecode || ''
    })
    points = routeData.normalizePoints(points, MAX_POINTS)
    store.set('selectedPoints', points)
    this._persistDraftPoints(points)
    var obj = {}
    obj['results[' + idx + '].added'] = true
    this.setData(obj)
    wx.showToast({ title: '已添加到路线', icon: 'success' })
    this._fetchBounds(item, idx)
    setTimeout(function() { wx.navigateBack() }, 800)
  },

  _fetchBounds: function(item, idx) {
    if (item.bounds) return
    if (String(item.typecode || '').indexOf('11') !== 0) return
    var that = this
    gaode.poiDetail(item.id).then(function(data) {
      var pois = data.pois || []
      var detail = pois[0] || {}
      if (!detail.bounds) return
      var obj = {}
      obj['results[' + idx + '].bounds'] = detail.bounds
      that.setData(obj)
      var points = (store.get('selectedPoints') || []).slice()
      for (var i = 0; i < points.length; i++) {
        if ((String(points[i].poiId) === String(item.id) || String(points[i].id) === String(item.id)) && !points[i].bounds) {
          points[i].bounds = detail.bounds
          break
        }
      }
      store.set('selectedPoints', points)
      that._persistDraftPoints(points)
    }).catch(function(e) { console.error('[poi detail]', e) })
  },

  clearKeyword: function() {
    clearTimeout(this._inputTimer)
    this._suggestRequestId += 1
    this._searchRequestId += 1
    if (this._searching) wx.hideLoading()
    this._searching = false
    this.setData({ keyword: '', results: [], suggestions: [], showSuggestions: false, searched: false })
  },

  _persistDraftPoints: function(points) {
    try {
      var draft = wx.getStorageSync('draft_route') || {}
      var normalized = routeData.normalizePoints(points, MAX_POINTS)
      draft.points = normalized
      draft.times = routeData.normalizeTimes(draft.times, normalized.length)
      draft.city = store.get('currentCity') || draft.city || ''
      draft.savedAt = Date.now()
      wx.setStorageSync('draft_route', draft)
    } catch (e) {
      console.error('[search draft save]', e)
    }
  },

  onUnload: function() {
    clearTimeout(this._inputTimer)
    this._suggestRequestId += 1
    this._searchRequestId += 1
    if (this._searching) wx.hideLoading()
    this._searching = false
  },

  chooseLocation: function() {
    wx.navigateBack()
  }
})
