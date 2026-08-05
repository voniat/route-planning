var store = require('../../utils/store')
var gaode = require('../../utils/gaode')
var common = require('../../utils/common')

var MAX_POINTS = 20

function _uid() {
  var id = wx.getStorageSync('agent_uid')
  if (!id) { id = 'wx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); wx.setStorageSync('agent_uid', id) }
  return id
}

function _historySummary(msgs) {
  var lines = []
  for (var i = 0; i < msgs.length && i < 6; i++) {
    var m = msgs[i]
    if (!m.loading) lines.push((m.role === 'user' ? '用户: ' : '助手: ') + m.content.slice(0, 80))
  }
  return lines.join('\n')
}

function _buildContext() {
  var points = store.get('selectedPoints') || []
  var city = store.get('currentCity') || '北京'
  return { points: points, city: city }
}

// ── Action 执行 ──

function _execActions(actions, that) {
  var pts = (store.get('selectedPoints') || []).slice()
  var run = []

  actions.forEach(function(a) {
    switch (a.type) {
      case 'add':
        if (pts.length < MAX_POINTS && a.lat && a.lng) {
          pts.push({ latitude: a.lat, longitude: a.lng, title: a.name || '未命名地点', id: Date.now() + Math.random() })
        }
        break
      case 'remove':
        if (a.index >= 0 && a.index < pts.length) pts.splice(a.index, 1)
        break
      case 'reorder':
        if (a.indices && a.indices.length === pts.length) {
          var re = []; a.indices.forEach(function(i) { re.push(pts[i]) }); pts = re
        }
        break
      case 'clear':
        pts = []
        break
      case 'setCity':
        if (a.name) store.set('currentCity', a.name)
        break
      case 'search':
        run.push(function() {
          wx.navigateTo({ url: '/pages/search/search?city=' + encodeURIComponent(a.city || store.get('currentCity') || '') + '&keyword=' + encodeURIComponent(a.keyword || '') })
        })
        break
      case 'nearby':
        run.push(function() {
          var idx = a.pointIndex || (pts.length - 1); var p = pts[idx]
          if (p) gaode.poiAround(p.longitude, p.latitude, a.keyword || '美食', 3000).then(function(d) {
            var pois = (d.pois || []).map(function(f) { return { name: f.name, addr: f.address, lat: parseFloat(f.location.split(',')[1]), lng: parseFloat(f.location.split(',')[0]) } })
            that.setData({ actionResult: { type: 'nearby', data: pois, pointIdx: idx } })
          })
        })
        break
      case 'route':
        run.push(function() { if (pts.length >= 2) wx.navigateTo({ url: '/pages/routes/routes' }) })
        break
      case 'optimize':
        if (pts.length >= 3) {
          var best = _nearestNeighbor(pts)
          pts = best
        }
        break
    }
  })

  store.set('selectedPoints', pts)
  run.forEach(function(fn) { fn() })
  return pts
}

function _nearestNeighbor(pts) {
  var n = pts.length
  if (n < 3) return pts
  var visited = {}; visited[0] = true
  var order = [pts[0]]; var current = pts[0]
  while (order.length < n - 1) {
    var best = -1, bestDist = Infinity
    for (var i = 1; i < n - 1; i++) {
      if (visited[i]) continue
      var d = common.haversine(current.latitude, current.longitude, pts[i].latitude, pts[i].longitude)
      if (d < bestDist) { bestDist = d; best = i }
    }
    if (best < 0) break
    visited[best] = true; order.push(pts[best]); current = pts[best]
  }
  order.push(pts[n - 1])
  return order
}

// ── Page ──

Page({
  data: {
    messages: [],
    input: '',
    sending: false,
    actionResult: null
  },

  onLoad: function() {
    var ctx = _buildContext()
    var pnames = (ctx.points || []).map(function(p) { return p.title || '?' }).join(' → ')
    var welcome = '你好！我是 Taffy，你的旅行规划助手~'
    if (pnames) welcome += '\n\n当前路线: ' + pnames + '\n在「' + (ctx.city || '北京') + '」'
    welcome += '\n\n可以让我帮你：添加地点、删除站点、重新排序、搜索美食、查看路线，直接说就好~'
    this.setData({ messages: [{ role: 'assistant', content: welcome }] })
  },

  onShow: function() {
    var pages = getCurrentPages()
    var prev = pages[pages.length - 2]
    if (prev && prev.renderMap) prev.renderMap()
  },

  quickSend: function(e) {
    var text = e.currentTarget.dataset.text
    if (!text || this.data.sending) return
    this.setData({ input: text }, function() { this.send() }.bind(this))
  },

  onInput: function(e) {
    this.setData({ input: e.detail.value, actionResult: null })
  },

  send: function() {
    var text = this.data.input.trim()
    if (!text || this.data.sending) return

    var msgs = this.data.messages.concat([{ role: 'user', content: text }])
    this.setData({ messages: msgs, input: '', sending: true, actionResult: null })

    var loadingMsg = { role: 'assistant', content: '思考中...', loading: true }
    this.setData({ messages: msgs.concat([loadingMsg]) })

    var ctx = _buildContext()
    var that = this

    wx.request({
      url: this._apiUrl(),
      method: 'POST',
      data: {
        message: text,
        uid: _uid(),
        context: {
          city: ctx.city,
          points: (ctx.points || []).map(function(p) { return { name: p.title, lat: p.latitude, lng: p.longitude } }),
          historySummary: _historySummary(msgs)
        }
      },
      header: { 'Content-Type': 'application/json' },
      timeout: 120000,
      success: function(res) {
        var body = res.data || {}
        var reply = body.reply || body.answer || '无响应'
        var actions = body.actions

        var finalMsg = { role: 'assistant', content: reply }

        if (actions && actions.length > 0) {
          var newPts = _execActions(actions, that)
          var actNames = actions.map(function(a) {
            if (a.type === 'add') return '已添加「' + (a.name || '地点') + '」'
            if (a.type === 'remove') return '已删除第' + (a.index + 1) + '个点'
            if (a.type === 'reorder') return '已重新排序'
            if (a.type === 'clear') return '已清空所有途经点'
            if (a.type === 'setCity') return '城市已切换为' + a.name
            if (a.type === 'search') return '正在搜索「' + (a.keyword || '') + '」'
            if (a.type === 'optimize') return '已智能排序'
            if (a.type === 'route') return '查看路线中'
            if (a.type === 'nearby') return '已搜索附近' + (a.keyword || '美食')
            return a.type
          })
          finalMsg.actionTags = actNames
        }

        that.setData({ messages: msgs.concat([finalMsg]), sending: false })
      },
      fail: function(err) {
        var finalMsgs = msgs.concat([{ role: 'assistant', content: '请求失败: ' + (err.errMsg || '网络错误') }])
        that.setData({ messages: finalMsgs, sending: false })
      }
    })
  },

  _apiUrl: function() {
    return wx.getStorageSync('agent_dev_url') || 'http://127.0.0.1:5520/api/chat'
  }
})
