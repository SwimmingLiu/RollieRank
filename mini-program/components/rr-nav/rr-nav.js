const app = getApp();

Component({
  properties: {
    title: { type: String, value: "" },
    back: { type: Boolean, value: true },
    action: { type: String, value: "" },
    actionIcon: { type: String, value: "" },
  },
  data: { statusBarHeight: 20, navHeight: 44, rightInset: 0 },
  lifetimes: {
    attached() {
      const m = app && app.navMetrics ? app.navMetrics() : { statusBarHeight: 20, navHeight: 44, rightInset: 0 };
      this.setData(m);
    },
  },
  methods: {
    goBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) wx.navigateBack();
      else wx.switchTab({ url: "/pages/home/home" });
    },
    onAction() {
      this.triggerEvent("action");
    },
  },
});
