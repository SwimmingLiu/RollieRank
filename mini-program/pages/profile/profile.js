const { ASSET } = require("../../config.js");
const storage = require("../../utils/storage.js");
const profile = require("../../services/profile.js");

Page({
  data: { name: "", avatar: "", defaultAvatar: ASSET.profile, phoneEnabled: false, phoneLast4: "", busy: false },

  async onShow() {
    this.setData({ name: storage.name(), avatar: profile.avatarUrl() });
    try {
      const { phoneEnabled } = await profile.capabilities();
      if (!phoneEnabled) return;
      const current = await profile.read();
      this.setData({ phoneEnabled, phoneLast4: current?.phoneLast4 || "" });
    } catch {
      this.setData({ phoneEnabled: false });
    }
  },

  onAvatar(event) {
    if (event.detail.avatarUrl) this.save(() => profile.saveAvatar(event.detail.avatarUrl));
  },

  onPhone(event) {
    if (this.data.phoneEnabled && event.detail.code) this.save(() => profile.savePhone(event.detail.code));
  },

  async save(operation) {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      const saved = await operation();
      this.setData({ avatar: profile.avatarUrl(saved.avatarId), phoneLast4: saved.phoneLast4 });
      wx.showToast({ title: "已保存", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "资料保存失败，请重试", icon: "none" });
    } finally {
      this.setData({ busy: false });
    }
  },

  openSettings() {
    wx.navigateTo({ url: "/pages/settings/settings" });
  },
});
