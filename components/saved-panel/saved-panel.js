Component({
  properties: {
    savedRoutes: { type: Array, value: [] },
    showSavedPanel: Boolean
  },

  methods: {
    onClose: function() {
      this.triggerEvent('close')
    },

    onLoad: function(e) {
      var id = e.currentTarget.dataset.id
      this.triggerEvent('load', { id: id })
    },

    onDelete: function(e) {
      var id = e.currentTarget.dataset.id
      this.triggerEvent('delete', { id: id })
    }
  }
})
