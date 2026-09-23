'use strict'

var fs = require('fs')
var path = require('path')
var childProcess = require('child_process')

var root = path.resolve(__dirname, '..')
var ignored = { '.git': true, 'node_modules': true, 'coverage': true }
var errors = []

function walk(directory, result) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach(function(entry) {
    if (ignored[entry.name]) return
    var fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(fullPath, result)
    else result.push(fullPath)
  })
}

function relative(file) {
  return path.relative(root, file).replace(/\\/g, '/')
}

var files = []
walk(root, files)

files.filter(function(file) { return path.extname(file) === '.js' }).forEach(function(file) {
  var result = childProcess.spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status !== 0) errors.push(relative(file) + ': JavaScript 语法错误\n' + (result.stderr || result.stdout))
})

files.filter(function(file) { return path.extname(file) === '.json' }).forEach(function(file) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
  } catch (error) {
    errors.push(relative(file) + ': JSON 无效：' + error.message)
  }
})

files.filter(function(file) { return path.extname(file) === '.wxml' }).forEach(function(file) {
  var source = fs.readFileSync(file, 'utf8')
  var tags = source.match(/<[^>]+>/g) || []
  tags.forEach(function(tag) {
    if (/\bwx:for\s*=/.test(tag) && /\bwx:(?:if|elif|else)\s*=/.test(tag)) {
      errors.push(relative(file) + ': wx:for 与 wx:if/wx:elif/wx:else 不能写在同一节点')
    }
  })

  var scriptFile = file.replace(/\.wxml$/, '.js')
  if (!fs.existsSync(scriptFile)) return
  var definition = null
  var oldPage = global.Page
  var oldComponent = global.Component
  global.Page = function(value) { definition = value }
  global.Component = function(value) { definition = value }
  try {
    delete require.cache[require.resolve(scriptFile)]
    require(scriptFile)
  } catch (error) {
    errors.push(relative(scriptFile) + ': 加载失败：' + error.message)
  } finally {
    global.Page = oldPage
    global.Component = oldComponent
  }
  if (!definition) return
  var handlers = {}
  Object.keys(definition).forEach(function(key) {
    if (typeof definition[key] === 'function') handlers[key] = true
  })
  Object.keys(definition.methods || {}).forEach(function(key) {
    if (typeof definition.methods[key] === 'function') handlers[key] = true
  })
  var eventPattern = /\b(?:bind|catch):?[a-z][\w-]*\s*=\s*"([^"]+)"/gi
  var match
  while ((match = eventPattern.exec(source))) {
    if (!handlers[match[1]]) errors.push(relative(file) + ': 模板事件缺少处理函数 ' + match[1])
  }
})

var appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
;(appConfig.pages || []).forEach(function(page) {
  ;['.js', '.json', '.wxml', '.wxss'].forEach(function(extension) {
    var file = path.join(root, page + extension)
    if (!fs.existsSync(file)) errors.push(page + extension + ': app.json 中声明的页面文件不存在')
  })
})

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('项目结构、语法、JSON、模板约束与事件绑定检查通过')
