var STORAGE_KEY = 'saved_routes'
var MAX_ROUTES = 50

function _validateRoute(r) {
  return r && typeof r.id === 'number' && typeof r.name === 'string' &&
    Array.isArray(r.points) && r.points.length > 0
}

function list() {
  try {
    var routes = wx.getStorageSync(STORAGE_KEY)
    if (!routes) return []
    if (typeof routes === 'string') routes = JSON.parse(routes)
    if (!Array.isArray(routes)) return []
    return routes.filter(_validateRoute)
  } catch (e) {
    console.error('[favorite list]', e)
    return []
  }
}

function save(routes) {
  try {
    wx.setStorageSync(STORAGE_KEY, routes)
    return true
  } catch (e) {
    if (e.errMsg && e.errMsg.indexOf('storage') !== -1) {
      wx.showToast({ title: '存储空间不足，请清理旧收藏', icon: 'none' })
    }
    console.error('[favorite save]', e)
    return false
  }
}

function add(points, times, cityName, customName) {
  if (!points || points.length === 0) return null
  var routes = list()
  if (routes.length >= MAX_ROUTES) {
    wx.showToast({ title: '收藏已满，已自动删除最旧的路线', icon: 'none' })
    routes.shift()
  }
  var route = {
    id: Date.now(),
    name: customName || (points[0].title + ' 等' + points.length + '站'),
    city: cityName || '',
    points: points.slice(),
    times: (times || []).slice(),
    savedAt: new Date().toLocaleString()
  }
  routes.push(route)
  save(routes)
  return route
}

function remove(id) {
  var routes = list()
  var filtered = routes.filter(function (r) { return r.id !== id })
  if (filtered.length === routes.length) return false
  save(filtered)
  return filtered
}

function getById(id) {
  var routes = list()
  for (var i = 0; i < routes.length; i++) {
    if (routes[i].id === id) return routes[i]
  }
  return null
}

module.exports = { list: list, add: add, remove: remove, getById: getById }
