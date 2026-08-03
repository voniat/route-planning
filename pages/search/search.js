var store = require('../../utils/store')
var common = require('../../utils/common')
var gaode = require('../../utils/gaode')
var MAX_POINTS = 20

function doSearchRequest(ctx, kw) {
  var city = store.get('currentCity') || ''
  gaode.poiSearch(kw, city).then(function(data) {
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
    wx.hideLoading()
    wx.showToast({ title: err.message || '搜索失败', icon: 'none' })
  })
}

function cleanResults(rawList, added) {
  var seen = {}
  var results = []
  rawList.forEach(function(item, i) {
    var loc = (item.location || '').split(',')
    var lat = parseFloat(loc[1]) || 0
    var lng = parseFloat(loc[0]) || 0
    var key = lat.toFixed(5) + ',' + lng.toFixed(5)
    if (seen[key]) return
    seen[key] = true
    results.push({
      id: item.id || 'poi-' + i,
      title: item.name || item.title || '',
      address: item.address || item.addr || '',
      latitude: lat,
      longitude: lng,
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
    this._searching = false
    this.setData({ keyword: kw })
    if (!kw.trim()) { this.setData({ suggestions: [], showSuggestions: false }); return }
    var that = this
    clearTimeout(this._inputTimer)
    this._inputTimer = setTimeout(function() {
      gaode.inputTips(kw).then(function(data) {
        if (that._searching) return
        var tips = data.tips || []
        var suggestions = tips.slice(0, 10).map(function(t) { return { name: t.name, district: t.district || '', id: t.id } })
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
    this.setData({ suggestions: [], showSuggestions: false })
    wx.showLoading({ title: '搜索中...' })
    var that = this
    this._saveHistory(kw)
    doSearchRequest(that, kw)
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

  selectResult: function(e) {
    if (this._selecting) return
    var id = e.currentTarget.dataset.id
    var results = this.data.results
    var idx = -1
    for (var i = 0; i < results.length; i++) {
      if (results[i].id === id) { idx = i; break }
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
      id: item.id || Date.now(),
      title: item.title,
      latitude: item.latitude,
      longitude: item.longitude,
      address: item.address
    })
    store.set('selectedPoints', points)
    var obj = {}
    obj['results[' + idx + '].added'] = true
    this.setData(obj)
    wx.showToast({ title: '已添加到路线', icon: 'success' })
    setTimeout(function() { wx.navigateBack() }, 800)
  },

  clearKeyword: function() {
    this.setData({ keyword: '', results: [], suggestions: [], showSuggestions: false, searched: false })
  },

  chooseLocation: function() {
    wx.navigateBack()
  }
})
