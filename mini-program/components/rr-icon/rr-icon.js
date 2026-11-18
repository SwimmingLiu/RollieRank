const { ASSET_BASE } = require("../../config");

Component({
  properties: {
    name: { type: String, value: "" },
    size: { type: Number, value: 40 },
    color: { type: String, value: "" },
  },
  data: { src: "" },
  observers: {
    name(name) {
      this.setData({ src: name ? `${ASSET_BASE}/assets/ui/${name}.svg` : "" });
    },
  },
  lifetimes: {
    attached() {
      const { name } = this.data;
      if (name) this.setData({ src: `${ASSET_BASE}/assets/ui/${name}.svg` });
    },
  },
});
