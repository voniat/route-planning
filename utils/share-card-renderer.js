var W = 375
var PAD = 20
var HEADER = 92
var ITEM_H = 62
var FOOTER = 56

function calcHeight(pointsLen) {
  return HEADER + ITEM_H * pointsLen + FOOTER
}

function drawShareCard(ctx, points, times, cityName) {
  var H = calcHeight(points.length)

  ctx.setFillStyle('#ffffff')
  ctx.fillRect(0, 0, W, H)

  var grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, '#1989fa')
  grad.addColorStop(1, '#07c160')
  ctx.setFillStyle(grad)
  ctx.fillRect(0, 0, W, HEADER)

  ctx.setFillStyle('#ffffff')
  ctx.setFontSize(20)
  ctx.fillText('今日行程 · ' + cityName, PAD, 42)

  var now = new Date()
  ctx.setFontSize(13)
  ctx.fillText('规划于 ' + (now.getMonth() + 1) + '月' + now.getDate() + '日', PAD, 66)

  for (var i = 0; i < points.length; i++) {
    var p = points[i]
    var y = HEADER + i * ITEM_H + ITEM_H / 2
    var cy = y - 9

    ctx.beginPath()
    ctx.arc(PAD + 12, cy, 11, 0, Math.PI * 2)
    var c = '#1989fa'
    if (i === 0) c = '#07c160'
    else if (i === points.length - 1) c = '#e64340'
    ctx.setFillStyle(c)
    ctx.fill()

    ctx.setFillStyle('#ffffff')
    ctx.setFontSize(13)
    ctx.fillText(String(i + 1), PAD + 8, y - 4)

    var name = p.title || ''
    ctx.setFillStyle('#333333')
    ctx.setFontSize(16)
    ctx.fillText(truncateText(ctx, name, W - PAD * 2 - 36 - 70), PAD + 36, y)

    var t = times[i] || ''
    if (t) {
      ctx.setFillStyle('#1989fa')
      ctx.setFontSize(13)
      ctx.fillText(t, W - PAD - 60, y)
    }

    if (i < points.length - 1) {
      ctx.setStrokeStyle('#f0f0f0')
      ctx.setLineWidth(1)
      ctx.beginPath()
      ctx.moveTo(PAD + 36, HEADER + (i + 1) * ITEM_H)
      ctx.lineTo(W - PAD, HEADER + (i + 1) * ITEM_H)
      ctx.stroke()
    }
  }

  ctx.setFillStyle('#999999')
  ctx.setFontSize(12)
  ctx.fillText('旅行路线规划 · ' + points.length + ' 个地点', PAD, H - 24)

  return H
}

function truncateText(ctx, text, maxW) {
  if (!text) return ''
  if (ctx.measureText(text).width <= maxW) return text
  while (text.length > 1) {
    text = text.slice(0, text.length - 1)
    if (ctx.measureText(text + '…').width <= maxW) break
  }
  return text + '…'
}

module.exports = {
  calcHeight: calcHeight,
  drawShareCard: drawShareCard
}
