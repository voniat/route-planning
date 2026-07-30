App({
  onLaunch: function() {
    this._bindPrivacy()
  },

  _bindPrivacy: function() {
    if (typeof wx.onNeedPrivacyAuthorization === 'function') {
      var app = this
      wx.onNeedPrivacyAuthorization(function(resolve) {
        app._privacyResolve = resolve
        app.globalData.showPrivacy = true
      })
    }
  },

  globalData: {
    selectedPoints: [],
    currentIndex: 0,
    currentCity: '',
    showPrivacy: false
  }
})
