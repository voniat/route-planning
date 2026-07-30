var _data = {}
var _listeners = {}

function get(key) {
  if (_data[key] !== undefined) return _data[key]
  try {
    var app = getApp()
    if (app && app.globalData && app.globalData[key] !== undefined) {
      return app.globalData[key]
    }
  } catch (e) {}
  return undefined
}

function set(key, value) {
  _data[key] = value
  try {
    var app = getApp()
    if (app && app.globalData) {
      app.globalData[key] = value
    }
  } catch (e) {}
  var subs = _listeners[key]
  if (subs) {
    for (var i = 0; i < subs.length; i++) {
      try { subs[i](value) } catch (e) {}
    }
  }
}

function subscribe(key, fn) {
  if (!_listeners[key]) _listeners[key] = []
  _listeners[key].push(fn)
  return {
    remove: function () {
      var arr = _listeners[key]
      if (!arr) return
      var idx = arr.indexOf(fn)
      if (idx >= 0) arr.splice(idx, 1)
    }
  }
}

module.exports = { get: get, set: set, subscribe: subscribe }
