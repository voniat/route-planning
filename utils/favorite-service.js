var STORAGE_KEY = 'saved_routes'
var MAX_ROUTES = 50
var MAX_POINTS = 20
var routeData = require('./route-data')

function _validateRoute(r) {
  return r && typeof r.id === 'number' && typeof r.name === 'string' &&
    routeData.normalizePoints(r.points, MAX_POINTS).length > 0
}

function list() {
  try {
    var routes = wx.getStorageSync(STORAGE_KEY)
    if (!routes) return []
    if (typeof routes === 'string') routes = JSON.parse(routes)
    if (!Array.isArray(routes)) return []
    return routes.filter(_validateRoute).map(function(route) {
      var points = routeData.normalizePoints(route.points, MAX_POINTS)
      route.points = points
      route.times = routeData.normalizeTimes(route.times, points.length)
      return route
    })
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
  points = routeData.normalizePoints(points, MAX_POINTS)
  if (points.length === 0) return null
  var routes = list()
  var removedOldest = false
  if (routes.length >= MAX_ROUTES) {
    routes.shift()
    removedOldest = true
  }
  var route = {
    id: Date.now(),
    name: customName || (points[0].title + ' 等' + points.length + '站'),
    city: cityName || '',
    points: points,
    times: routeData.normalizeTimes(times, points.length),
    savedAt: new Date().toLocaleString()
  }
  routes.push(route)
  if (!save(routes)) return null
  if (removedOldest) {
    wx.showToast({ title: '收藏已满，已自动删除最旧的路线', icon: 'none' })
  }
  return route
}

function remove(id) {
  var routes = list()
  var filtered = routes.filter(function (r) { return String(r.id) !== String(id) })
  if (filtered.length === routes.length) return false
  return save(filtered) ? filtered : false
}

function getById(id) {
  var routes = list()
  for (var i = 0; i < routes.length; i++) {
    if (String(routes[i].id) === String(id)) return routes[i]
  }
  return null
}

module.exports = { list: list, add: add, remove: remove, getById: getById }
