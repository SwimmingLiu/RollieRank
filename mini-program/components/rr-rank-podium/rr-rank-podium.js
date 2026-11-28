Component({
  options: { virtualHost: true, styleIsolation: "apply-shared" },
  properties: {
    winners: { type: Array, value: [] },
  },
  data: { failed: {} },
  observers: {
    winners() {
      if (Object.keys(this.data.failed).length) this.setData({ failed: {} });
    },
  },
  methods: {
    onSelect(event) {
      const id = event.currentTarget.dataset.id;
      if (id) this.triggerEvent("select", { publicId: id });
    },
    onAvatarError(event) {
      const index = event.currentTarget.dataset.index;
      if (index === undefined || this.data.failed[index]) return;
      this.setData({ [`failed.${index}`]: true });
    },
  },
});
