var common = require('./common')

function haversine(lat1, lng1, lat2, lng2) {
  return common.haversine(lat1, lng1, lat2, lng2)
}

function nearestNeighbor(points) {
  var n = points.length
  if (n < 3) return points.slice()

  var visited = {}
  visited[0] = true
  var result = [points[0]]
  var current = points[0]

  while (result.length < n - 1) {
    var best = -1
    var bestDist = Infinity
    for (var i = 1; i < n - 1; i++) {
      if (visited[i]) continue
      var d = haversine(current.latitude, current.longitude, points[i].latitude, points[i].longitude)
      if (d < bestDist) { bestDist = d; best = i }
    }
    if (best < 0) break
    visited[best] = true
    result.push(points[best])
    current = points[best]
  }

  result.push(points[n - 1])
  return result
}

function parseBounds(bounds) {
  if (!bounds || typeof bounds !== 'string') return null
  var out = []
  var pts = bounds.split(';')
  for (var i = 0; i < pts.length; i++) {
    var parts = pts[i].split(',')
    var lng = parseFloat(parts[0])
    var lat = parseFloat(parts[1])
    if (!isNaN(lng) && !isNaN(lat)) out.push({ longitude: lng, latitude: lat })
  }
  if (out.length < 2) return null

  var minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  out.forEach(function(p) {
    if (p.longitude < minLng) minLng = p.longitude
    if (p.latitude < minLat) minLat = p.latitude
    if (p.longitude > maxLng) maxLng = p.longitude
    if (p.latitude > maxLat) maxLat = p.latitude
  })

  return [
    { longitude: minLng, latitude: minLat },
    { longitude: maxLng, latitude: minLat },
    { longitude: maxLng, latitude: maxLat },
    { longitude: minLng, latitude: maxLat }
  ]
}

module.exports = {
  nearestNeighbor: nearestNeighbor,
  parseBounds: parseBounds
}
