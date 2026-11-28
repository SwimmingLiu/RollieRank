Component({
  options: { virtualHost: true, styleIsolation: "apply-shared" },
  properties: {
    name: { type: String, value: "" },
    size: { type: Number, value: 16 },
  },
  data: { src: "" },
  observers: {
    name(name) {
      this.setData({ src: name ? `/assets/ui/${name}.svg` : "" });
    },
  },
  lifetimes: {
    attached() {
      const { name } = this.data;
      if (name) this.setData({ src: `/assets/ui/${name}.svg` });
    },
  },
});
