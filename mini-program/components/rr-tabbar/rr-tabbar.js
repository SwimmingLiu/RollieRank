Component({
  properties: { active: { type: String, value: "home" } },
  data: {
    items: [
      { key: "home", label: "首页", url: "/pages/home/home" },
      { key: "records", label: "个人中心", url: "/pages/records/records" },
    ],
    base: "/assets",
  },
  methods: {
    go(event) {
      const { url, key } = event.currentTarget.dataset;
      if (key === this.data.active) return;
      wx.switchTab({ url });
    },
  },
});
