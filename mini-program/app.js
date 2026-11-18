const storage = require("./storage");

App({
  globalData: {
    statusBarHeight: 20,
    menuButton: null,
    // 目录只在内存缓存一次；记录保存在本机存储。
    versions: [],
    catalogAt: 0,
  },

  onLaunch() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    this.globalData.statusBarHeight = info.statusBarHeight || 20;
    this.globalData.menuButton = menu;
    // 首次启动准备本机身份，之后保持同一凭证参与榜单。
    storage.guestId();
  },

  navMetrics() {
    const { statusBarHeight, menuButton } = this.globalData;
    const bar = menuButton ? menuButton.height + (menuButton.top - statusBarHeight) * 2 : 44;
    return {
      statusBarHeight,
      navHeight: Math.max(bar, 44),
      titleHeight: menuButton ? menuButton.height : 32,
    };
  },
});
