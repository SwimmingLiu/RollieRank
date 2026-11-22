const storage = require("./utils/storage.js");
const { API_BASE, ASSET_BASE, STORAGE_NAMESPACE } = require("./config.js");
const { navigationLayout } = require("./utils/navigation.js");

App({
  globalData: {
    // 原生联调用正在运行的包核对接口地址，避免误操作生产包。
    apiBase: API_BASE,
    storageNamespace: STORAGE_NAMESPACE,
    // 目录只在内存缓存一次，记录保存在本机存储。
    versions: [],
    catalogAt: 0,
  },

  onLaunch() {
    storage.guestId();
    // Load the same typefaces as the approved app without increasing the main package.
    if (!wx.loadFontFace) {
      this.globalData.fontsReady = Promise.resolve();
      return;
    }
    const fonts = [
      { family: "FangYuan", file: "FangYuanVariable", weight: "200 700" },
      { family: "Nunito", file: "NunitoVariable", weight: "200 1000" },
      { family: "Fraunces", file: "FrauncesVariable", weight: "100 900" },
    ];
    const loads = fonts.map(({ family, file, weight }) => new Promise(resolve => {
      wx.loadFontFace({
        global: true,
        family,
        source: 'url("' + ASSET_BASE + '/assets/fonts/' + file + '.woff2")',
        desc: { weight },
        complete: resolve,
      });
    }));
    this.globalData.fontsReady = Promise.race([
      Promise.all(loads),
      new Promise(resolve => setTimeout(resolve, 2500)),
    ]);
  },

  navMetrics() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect?.();
    return navigationLayout(info, menu);
  },
});
