function parseTime(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null
  var parts = value.split(':')
  return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

function formatTime(totalMinutes) {
  var value = ((totalMinutes % 1440) + 1440) % 1440
  var hour = Math.floor(value / 60)
  var minute = value % 60
  return (hour < 10 ? '0' : '') + hour + ':' + (minute < 10 ? '0' : '') + minute
}

function buildSchedule(startTime, segmentSeconds, pointCount, dwellMinutes) {
  var startMinutes = parseTime(startTime)
  if (startMinutes === null) startMinutes = 9 * 60
  var count = Math.max(0, parseInt(pointCount) || 0)
  var dwell = typeof dwellMinutes === 'number' && dwellMinutes >= 0 ? Math.round(dwellMinutes) : 60
  var durations = Array.isArray(segmentSeconds) ? segmentSeconds : []
  var times = count > 0 ? [formatTime(startMinutes)] : []
  var totalMinutes = startMinutes
  var usedFallback = false

  for (var i = 1; i < count; i++) {
    if (i > 1) totalMinutes += dwell
    var seconds = parseInt(durations[i - 1]) || 0
    var travelMinutes
    if (seconds > 0) {
      travelMinutes = Math.max(5, Math.ceil(seconds / 300) * 5)
    } else {
      travelMinutes = 60
      usedFallback = true
    }
    totalMinutes += travelMinutes
    times.push(formatTime(totalMinutes))
  }

  return { times: times, usedFallback: usedFallback }
}

module.exports = {
  parseTime: parseTime,
  formatTime: formatTime,
  buildSchedule: buildSchedule
}
