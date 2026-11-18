const storage = require("./utils/storage.js");
const { ASSET_BASE } = require("./config.js");
const { navigationLayout } = require("./utils/navigation.js");

App({
  globalData: {
    // 目录只在内存缓存一次，记录保存在本机存储。
    versions: [],
    catalogAt: 0,
  },

  onLaunch() {
    storage.guestId();
    // Load the same typefaces as the approved app without increasing the main package.
    if (!wx.loadFontFace) return;
    const fonts = [
      { family: "FangYuan", file: "FangYuanVariable", weight: "200 700" },
      { family: "Nunito", file: "NunitoVariable", weight: "200 1000" },
      { family: "Fraunces", file: "FrauncesVariable", weight: "100 900" },
    ];
    for (const { family, file, weight } of fonts) {
      wx.loadFontFace({
        global: true,
        family,
        source: 'url("' + ASSET_BASE + '/assets/fonts/' + file + '.woff2")',
        desc: { weight },
      });
    }
  },

  navMetrics() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const menu = wx.getMenuButtonBoundingClientRect?.();
    return navigationLayout(info, menu);
  },
});
