const storage = require("./utils/storage.js");

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
    this.globalData.windowWidth = info.windowWidth || 0;
    this.globalData.menuButton = menu;
    // 首次启动准备本机身份，之后保持同一凭证参与榜单。
    storage.guestId();
  },

  navMetrics() {
    const { statusBarHeight, menuButton } = this.globalData;
    // 导航栏高度与系统胶囊一致：胶囊上下各留同样的间距，标题与胶囊居中对齐。
    const navHeight = menuButton
      ? menuButton.height + Math.max(4, (menuButton.top - statusBarHeight) * 2)
      : 44;
    // 右侧活动区避开胶囊：胶囊左边界到屏幕右边的距离再加一点间距。
    const windowWidth = this.globalData.windowWidth || 0;
    const rightInset = menuButton && windowWidth
      ? Math.max(0, windowWidth - menuButton.left + 8)
      : 0;
    return { statusBarHeight, navHeight, rightInset };
  },
});
