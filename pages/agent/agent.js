// pages/agent/agent.js
const app = getApp()

Page({
  data: {
    messages: [],
    input: '',
    sending: false,
    scrollToBottom: true
  },

  onLoad() {
    this.setData({
      messages: [{
        role: 'assistant',
        content: '你好！我是旅行助手。可以帮你查天气、搜景点、规划路线。试试说「北京今天天气怎么样」或「帮我规划从天安门到鸟巢的路线」'
      }]
    })
  },

  onInput(e) {
    this.setData({ input: e.detail.value })
  },

  send() {
    const text = this.data.input.trim()
    if (!text || this.data.sending) return

    const msgs = [...this.data.messages, { role: 'user', content: text }]
    this.setData({ messages: msgs, input: '', sending: true })

    const loadingMsg = { role: 'assistant', content: '思考中...', loading: true }
    this.setData({ messages: [...msgs, loadingMsg] })

    wx.request({
      url: this._apiUrl(),
      method: 'POST',
      data: { message: text },
      header: { 'Content-Type': 'application/json' },
      timeout: 120000,
      success: (res) => {
        const answer = res.data && res.data.answer ? res.data.answer : '无响应'
        const finalMsgs = [...msgs, { role: 'assistant', content: answer }]
        this.setData({ messages: finalMsgs, sending: false })
      },
      fail: (err) => {
        const finalMsgs = [...msgs, { role: 'assistant', content: '请求失败: ' + (err.errMsg || '网络错误') }]
        this.setData({ messages: finalMsgs, sending: false })
      }
    })
  },

  _apiUrl() {
    const dev = wx.getStorageSync('agent_dev_url') || 'https://service.example.com/api/chat'
    return dev
  }
})
