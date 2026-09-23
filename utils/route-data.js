var _pointSeq = 0

function isFiniteNumber(value) {
  return typeof value === 'number' && isFinite(value)
}

function isValidCoordinate(latitude, longitude) {
  return isFiniteNumber(latitude) && isFiniteNumber(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
}

function createPointId() {
  _pointSeq += 1
  return 'point-' + Date.now() + '-' + _pointSeq
}

function normalizePoints(input, maxPoints) {
  if (!Array.isArray(input)) return []
  var limit = typeof maxPoints === 'number' && maxPoints > 0 ? maxPoints : input.length
  var seenIds = {}
  var points = []

  for (var i = 0; i < input.length && points.length < limit; i++) {
    var raw = input[i]
    if (!raw || !isValidCoordinate(raw.latitude, raw.longitude)) continue

    var id = raw.id
    var idKey = typeof id + ':' + String(id)
    if ((typeof id !== 'string' && typeof id !== 'number') || seenIds[idKey]) {
      id = createPointId()
      idKey = typeof id + ':' + String(id)
    }
    seenIds[idKey] = true

    points.push({
      id: id,
      poiId: raw.poiId || '',
      title: String(raw.title || raw.address || '未命名地点').slice(0, 100),
      latitude: raw.latitude,
      longitude: raw.longitude,
      address: typeof raw.address === 'string' ? raw.address : '',
      bounds: typeof raw.bounds === 'string' ? raw.bounds : '',
      typecode: typeof raw.typecode === 'string' ? raw.typecode : ''
    })
  }
  return points
}

function normalizeTimes(input, pointCount) {
  var source = Array.isArray(input) ? input : []
  var times = []
  for (var i = 0; i < pointCount; i++) {
    var value = typeof source[i] === 'string' ? source[i] : ''
    times.push(/^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '')
  }
  return times
}

module.exports = {
  createPointId: createPointId,
  isValidCoordinate: isValidCoordinate,
  normalizePoints: normalizePoints,
  normalizeTimes: normalizeTimes
}
