'use strict'

var fs = require('fs')
var path = require('path')
var childProcess = require('child_process')

var root = path.resolve(__dirname, '..')
var trackedResult = childProcess.spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
if (trackedResult.status !== 0) {
  console.error('无法读取 Git 跟踪文件和待提交文件')
  process.exit(1)
}

var files = trackedResult.stdout.split('\0').filter(Boolean)
var errors = []
var forbidden = [
  /^utils\/config\.js$/i,
  /(^|\/)project\.private\.config\.json$/i,
  /(^|\/)\.env(?:\.|$)/i,
  /\.(?:pem|key|p12|pfx)$/i
]

files.forEach(function(file) {
  var normalized = file.replace(/\\/g, '/')
  if (forbidden.some(function(pattern) { return pattern.test(normalized) })) {
    errors.push(normalized + ': 敏感配置不应被 Git 跟踪')
  }
})

var secretPatterns = [
  { name: '私钥', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: '腾讯云访问密钥', pattern: /AKID[A-Za-z0-9]{20,}/ },
  { name: 'OpenAI 密钥', pattern: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: 'GitHub 令牌', pattern: /gh[ps]_[A-Za-z0-9]{30,}/ },
  { name: 'Google API 密钥', pattern: /AIza[A-Za-z0-9_-]{30,}/ }
]
var textExtensions = /\.(?:js|json|wxml|wxss|md|yml|yaml|txt|env)$/i

files.forEach(function(file) {
  var normalized = file.replace(/\\/g, '/')
  if (!textExtensions.test(normalized) || normalized === 'scripts/security-check.js') return
  var fullPath = path.join(root, file)
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size > 1024 * 1024) return
  var source = fs.readFileSync(fullPath, 'utf8')
  secretPatterns.forEach(function(item) {
    if (item.pattern.test(source)) errors.push(normalized + ': 疑似包含' + item.name)
  })
  var assignmentPattern = /(?:AMAP_WEB_SERVICE_KEY|OPEN_METEO_API_KEY|PROXY_TOKEN|proxyToken)\s*[:=]\s*['"]?([A-Za-z0-9_-]{20,})/g
  var match
  while ((match = assignmentPattern.exec(source))) {
    if (!/^(?:replace|your|test)-/i.test(match[1])) {
      errors.push(normalized + ': 疑似硬编码服务密钥或代理令牌')
    }
  }
})

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('敏感文件与常见密钥模式检查通过')
