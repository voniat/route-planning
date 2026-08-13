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
  parseBounds: parseBounds
}
