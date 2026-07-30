var gaode = require('./gaode')

function transitRoute(origin, dest, city) {
  return gaode.transitRoute(origin, dest, city)
}

function walkingRoute(origin, dest) {
  return gaode.walkingRoute(origin, dest)
}

function decodePolyline(str) {
  return gaode.decodePolyline(str)
}

module.exports = {
  transitRoute: transitRoute,
  walkingRoute: walkingRoute,
  decodePolyline: decodePolyline
}
