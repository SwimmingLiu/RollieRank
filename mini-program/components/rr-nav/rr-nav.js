Component({
  options: { virtualHost: true },
  properties: {
    title: { type: String, value: "" },
    back: { type: Boolean, value: true },
    action: { type: String, value: "" },
    actionIcon: { type: String, value: "" },
    actionLabel: { type: String, value: "" },
    actionDot: { type: Boolean, value: false },
    logo: { type: String, value: "" },
    leading: { type: Boolean, value: false },
  },
  data: { statusBarHeight: 20, navHeight: 44, menuClearance: 104 },
  lifetimes: {
    attached() {
      this.updateLayout();
    },
  },
  pageLifetimes: {
    show() {
      this.updateLayout();
    },
    resize() {
      this.updateLayout();
    },
  },
  methods: {
    updateLayout() {
      this.setData(getApp().navMetrics());
    },
    goBack() {
      if (getCurrentPages().length > 1) wx.navigateBack();
      else wx.switchTab({ url: "/pages/home/home" });
    },
    onAction() {
      this.triggerEvent("action");
    },
  },
});
