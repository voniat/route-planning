var ALPHA = 0.3

function scoreFoodPois(rawPois) {
  var pois = (rawPois || []).map(function(item) {
    var loc = (item.location || '').split(',')
    var photos = item.photos || []
    var photo = photos.length > 0 && photos[0] && photos[0].url ? photos[0].url.replace('http://', 'https://') : ''
    return {
      name: item.name || '',
      address: item.address || '',
      photo: photo,
      lat: parseFloat(loc[1]) || 0,
      lng: parseFloat(loc[0]) || 0,
      distance: parseInt(item.distance) || 0,
      rating: item.biz_ext && item.biz_ext.rating ? parseFloat(item.biz_ext.rating) : 0
    }
  }).filter(function(item) { return item.name && item.lat })

  var maxDist = 0
  pois.forEach(function(item) { if (item.distance > maxDist) maxDist = item.distance })

  pois.forEach(function(item) {
    var distScore = maxDist > 0 ? (1 - item.distance / maxDist) : 1
    var ratingScore = item.rating > 0 ? item.rating / 5 : 0.5
    item._score = ALPHA * distScore + (1 - ALPHA) * ratingScore
    item._distKm = item.distance >= 1000 ? (item.distance / 1000).toFixed(1) + 'km' : item.distance + 'm'

    var full = item.rating > 0 ? Math.round(item.rating) : 0
    var empty = item.rating > 0 ? 5 - full : 0
    item._stars = ''
    for (var s = 0; s < full; s++) item._stars += '★'
    for (var s = 0; s < empty; s++) item._stars += '☆'
  })

  pois.sort(function(a, b) { return b._score - a._score })
  return pois.slice(0, 20)
}

module.exports = { scoreFoodPois: scoreFoodPois }
