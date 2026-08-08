Component({
  properties: {
    show: Boolean
  },

  methods: {
    onAgree: function() {
      this.triggerEvent('agree')
    },

    onDisagree: function() {
      this.triggerEvent('disagree')
    }
  }
})
