const storage = require("../../utils/storage.js");
const profile = require("../../services/profile.js");

Page({
  data: { name: "", saving: false },

  onShow() {
    this.setData({ name: storage.name() });
  },

  onName(event) {
    this.setData({ name: event.detail.value });
  },

  async saveName(event) {
    if (this.data.saving) return;
    const name = String(event.detail.value.name || "").trim();
    if (!name) {
      wx.showToast({ title: "请输入昵称", icon: "none" });
      return;
    }
    this.setData({ saving: true });
    try {
      const saved = await profile.saveName(name);
      this.setData({ name: saved.name });
      wx.showToast({ title: "昵称已保存", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "昵称保存失败，请重试", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },
});
