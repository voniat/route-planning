Component({
  properties: {
    foodResults: { type: Array, value: [] },
    foodLoading: Boolean,
    showFoodPanel: Boolean
  },

  methods: {
    onClose: function() {
      this.triggerEvent('close')
    },

    onAdd: function(e) {
      var idx = parseInt(e.currentTarget.dataset.index)
      this.triggerEvent('add', { index: idx })
    }
  }
})
