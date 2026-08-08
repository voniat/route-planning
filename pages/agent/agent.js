var store = require('../../utils/store')
var common = require('../../utils/common')
var fav = require('../../utils/favorite-service')

var MAX_POINTS = 20

function _msg(role, content, extra) {
  var m = Object.assign({ role: role, content: content, lines: (content || '').split('\n') }, extra || {})
  return m
}

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
  var routes = fav.list().slice(0, 20).map(function(r) {
    return { id: r.id, name: r.name, city: r.city, count: r.points.length, savedAt: r.savedAt }
  })
  return { points: points, city: city, savedRoutes: routes }
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
        (function(kw, pidx) {
          run.push(function() {
            var idx = pidx >= 0 ? pidx : (pts.length - 1)
            var p = pts[idx]
            if (!p) return
            store.set('nearbyKeyword', kw || '美食|餐厅')
            store.set('nearbyPointIdx', idx)
            wx.switchTab({ url: '/pages/index/index' })
          })
        })(a.keyword, a.pointIndex)
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
      case 'loadFav':
        (function(id, name) {
          run.push(function() {
            var r = fav.getById(id)
            if (!r && name) {
              var all = fav.list()
              r = all.filter(function(x) { return x.name === name })[0]
              if (!r) r = all.filter(function(x) { return (x.name || '').indexOf(name) >= 0 })[0]
            }
            if (r) {
              var loaded = r.points.map(function(p) { return { latitude: p.latitude, longitude: p.longitude, title: p.title, id: Date.now() + Math.random() } })
              store.set('selectedPoints', loaded)
              if (r.city) store.set('currentCity', r.city)
              var pages = getCurrentPages()
              if (pages.length > 1 && pages[pages.length - 2].renderMap) pages[pages.length - 2].renderMap()
            }
          })
        })(a.id, a.name)
        break
      case 'deleteFav':
        (function(id, name) {
          run.push(function() {
            var r = fav.getById(id)
            if (!r && name) {
              var all = fav.list()
              r = all.filter(function(x) { return x.name === name })[0]
              if (!r) r = all.filter(function(x) { return (x.name || '').indexOf(name) >= 0 })[0]
            }
            if (r) fav.remove(r.id)
          })
        })(a.id, a.name)
        break
      case 'saveCurrent':
        (function(name) {
          run.push(function() {
            var cur = store.get('selectedPoints') || []
            if (cur.length > 0) { fav.add(cur, [], store.get('currentCity') || '', name || ''); wx.showToast({ title: name ? '已收藏「' + name + '」' : '已收藏', icon: 'success' }) }
          })
        })(a.name)
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

function _saveMsgs(msgs) {
  var plain = msgs.map(function(m) {
    return { role: m.role, content: m.content, actionTags: m.actionTags, loading: m.loading }
  })
  store.set('agentMsgs', plain)
}

Page({
  data: {
    messages: [],
    input: '',
    sending: false,
    actionResult: null
  },

  onLoad: function() {
    var saved = store.get('agentMsgs')
    if (saved && saved.length > 0) {
      var msgs = saved.map(function(m) { return _msg(m.role, m.content, { actionTags: m.actionTags, loading: m.loading }) })
      this.setData({ messages: msgs })
      return
    }
    var ctx = _buildContext()
    var pnames = (ctx.points || []).map(function(p, i) { return (i + 1) + '. ' + (p.title || '?') }).join('\n')
    var welcome = '你好！我是 Taffy，你的旅行规划助手~'
    if (pnames) welcome += '\n\n当前路线:\n' + pnames + '\n'
    welcome += '\n\n可以让我帮你：添加地点、删除站点、重新排序、搜索美食、查看路线，直接说就好~'
    var initMsgs = [_msg('assistant', welcome)]
    this.setData({ messages: initMsgs })
    _saveMsgs(initMsgs)
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

    var msgs = this.data.messages.concat([_msg('user', text)])
    this.setData({ messages: msgs, input: '', sending: true, actionResult: null })

    var startTime = Date.now()
    var loadingMsg = _msg('assistant', '思考中... 0s', { loading: true })
    msgs = msgs.concat([loadingMsg])
    this.setData({ messages: msgs })

    var ctx = _buildContext()
    var that = this
    var timer = setInterval(function() {
      var elapsed = Math.floor((Date.now() - startTime) / 1000)
      var dots = ''
      for (var d = 0; d < (elapsed % 3) + 1; d++) dots += '.'
      msgs[msgs.length - 1].content = '思考中' + dots + ' ' + elapsed + 's'
      msgs[msgs.length - 1].lines = [msgs[msgs.length - 1].content]
      that.setData({ messages: msgs.slice() })
    }, 1000)

    wx.request({
      url: this._apiUrl(),
      method: 'POST',
      data: {
        message: text,
        uid: _uid(),
        context: {
          city: ctx.city,
          points: (ctx.points || []).map(function(p) { return { name: p.title, lat: p.latitude, lng: p.longitude } }),
          savedRoutes: ctx.savedRoutes || []
        }
      },
      header: { 'Content-Type': 'application/json' },
      timeout: 120000,
      success: function(res) {
        clearInterval(timer)
        var body = res.data || {}
        var reply = body.reply || body.answer || '无响应'
        var actions = body.actions
        var finalMsg = _msg('assistant', reply)
        if (actions && actions.length > 0) {
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
            if (a.type === 'loadFav') return '已加载收藏路线「' + (a.name || '') + '」'
            if (a.type === 'deleteFav') return '已删除收藏「' + (a.name || '') + '」'
            if (a.type === 'saveCurrent') return '已收藏当前路线'
            return a.type
          })
          finalMsg.actionTags = actNames
          _execActions(actions, that)
        }
        that.setData({ messages: msgs.slice(0, -1).concat([finalMsg]), sending: false })
        _saveMsgs(msgs.slice(0, -1).concat([finalMsg]))
      },
      fail: function(err) {
        clearInterval(timer)
        var finalMsgs = msgs.slice(0, -1).concat([_msg('assistant', '请求失败: ' + (err.errMsg || '网络错误'))])
        that.setData({ messages: finalMsgs, sending: false })
        _saveMsgs(finalMsgs)
      }
    })
  },

  _apiUrl: function() {
    return wx.getStorageSync('agent_dev_url') || 'http://127.0.0.1:5520/api/chat'
  }
})
