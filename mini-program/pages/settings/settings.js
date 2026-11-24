const storage = require("../../utils/storage.js");
const profile = require("../../services/profile.js");

Page({
  data: { name: "", saving: false },

  onShow() {
    this.setData({ name: storage.hasCustomName() ? storage.name() : "" });
  },

  onUnload() {
    if (this._backTimer) {
      clearTimeout(this._backTimer);
      this._backTimer = null;
    }
  },

  onName(event) {
    this.setData({ name: event.detail.value });
  },

  async saveName(event) {
    if (this.data.saving) return;
    const name = String(event.detail.value.name || this.data.name || "").trim();
    if (!name) {
      wx.showToast({ title: "请输入昵称", icon: "none" });
      return;
    }
    this.setData({ saving: true });
    try {
      const saved = await profile.saveName(name);
      this.setData({ name: saved.name });
      wx.showToast({ title: "昵称已保存", icon: "success", duration: 900 });
      this._backTimer = setTimeout(() => {
        this._backTimer = null;
        if (getCurrentPages().length > 1) {
          wx.navigateBack({
            delta: 1,
            fail: () => this.setData({ saving: false }),
          });
        } else {
          wx.redirectTo({
            url: "/pages/profile/profile",
            fail: () => this.setData({ saving: false }),
          });
        }
      }, 650);
    } catch (error) {
      this.setData({ saving: false });
      wx.showToast({ title: error.message || "昵称保存失败，请重试", icon: "none" });
    }
  },
});
