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
        var pages = getCurrentPages()
        var currentPage = pages && pages.length ? pages[pages.length - 1] : null
        if (currentPage && currentPage.setData && currentPage.data && currentPage.data.showPrivacy !== undefined) {
          currentPage.setData({ showPrivacy: true })
        }
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
