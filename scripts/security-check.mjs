import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const self = 'scripts/security-check.mjs'
const errors = []

const listed = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
  cwd: root,
  encoding: 'utf8'
})
const files = listed.split('\0').filter(Boolean)

const forbidden = [
  /(^|\/)\.env$/i,
  /(^|\/)\.env\.(?!example$)[^/]+$/i,
  /\.(?:pem|key|p12|pfx)$/i
]

for (const file of files) {
  const normalized = file.replace(/\\/g, '/')
  if (forbidden.some((pattern) => pattern.test(normalized))) {
    errors.push(`${normalized}: 敏感配置不应被 Git 跟踪`)
  }
}

const secretPatterns = [
  { name: '私钥', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: '腾讯云访问密钥', pattern: /AKID[A-Za-z0-9]{20,}/ },
  { name: 'OpenAI 密钥', pattern: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: 'GitHub 令牌', pattern: /gh[ps]_[A-Za-z0-9]{30,}/ },
  { name: 'Google API 密钥', pattern: /AIza[A-Za-z0-9_-]{30,}/ }
]

const assignment =
  /(?:VITE_AMAP_KEY|VITE_AMAP_SECURITY_CODE|AMAP_WEB_SERVICE_KEY|OPEN_METEO_API_KEY|PROXY_TOKEN|proxyToken)\s*[:=]\s*['"]?([A-Za-z0-9_-]{16,})/g
const textExtensions = /\.(?:js|mjs|cjs|ts|tsx|json|wxml|wxss|md|yml|yaml|txt|env|html|css)$/i

for (const file of files) {
  const normalized = file.replace(/\\/g, '/')
  if (!textExtensions.test(normalized) || normalized === self) continue
  const fullPath = path.join(root, file)
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size > 1024 * 1024) continue
  const source = fs.readFileSync(fullPath, 'utf8')
  for (const item of secretPatterns) {
    if (item.pattern.test(source)) errors.push(`${normalized}: 疑似包含${item.name}`)
  }
  assignment.lastIndex = 0
  let match
  while ((match = assignment.exec(source))) {
    if (!/^(?:replace|your|test)-/i.test(match[1])) {
      errors.push(`${normalized}: 疑似硬编码密钥或令牌`)
    }
  }
}

for (const file of files) {
  const normalized = file.replace(/\\/g, '/')
  if (!normalized.startsWith('src/') || !textExtensions.test(normalized)) continue
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  if (/restapi\.amap\.com/.test(source)) {
    errors.push(`${normalized}: 前端不得直接访问高德 Web 服务（restapi.amap.com）`)
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('敏感文件与常见密钥模式检查通过')
