const { ASSET_BASE } = require("../../config");

Component({
  properties: { active: { type: String, value: "home" } },
  data: {
    items: [
      { key: "home", label: "首页", url: "/pages/home/home" },
      { key: "records", label: "练习记录", url: "/pages/records/records" },
    ],
    base: ASSET_BASE,
  },
  methods: {
    go(event) {
      const { url, key } = event.currentTarget.dataset;
      if (key === this.data.active) return;
      wx.switchTab({ url });
    },
  },
});
