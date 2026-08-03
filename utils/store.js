var _data = {}

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
}

module.exports = { get: get, set: set }
