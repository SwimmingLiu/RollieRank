const { API_BASE } = require("../../config.js");
const { linkQuery, validTicket } = require("../../utils/web-bridge.js");

Page({
  data: { kind: "poster", busy: false, error: "" },

  onLoad(query) {
    this.paper = linkQuery(query);
    this.ticket = validTicket(query.ticket) ? query.ticket : "";
    this.setData({ kind: query.kind === "invite" ? "invite" : "poster" });
    if (this.data.kind === "poster") this.save();
  },

  async save() {
    if (this.data.busy) return;
    const file = this.ticket;
    if (!file) {
      this.setData({ error: "海报已过期，请返回重新生成。" });
      return;
    }
    this.setData({ busy: true, error: "" });
    try {
      if (!this.filePath) {
        // downloadFile returns a task immediately. The status and path arrive in its callback.
        const image = await new Promise((resolve, reject) => wx.downloadFile({
          url: API_BASE + "/api/miniprogram-web/poster?ticket=" + file,
          success: resolve,
          fail: reject,
        }));
        if (image.statusCode !== 200) throw new Error("海报已过期，请返回重新生成。");
        this.filePath = image.tempFilePath;
      }
      await new Promise((resolve, reject) => wx.saveImageToPhotosAlbum({
        filePath: this.filePath, success: resolve, fail: reject,
      }));
      wx.showToast({ title: "已保存到相册", icon: "success" });
      wx.navigateBack();
    } catch (error) {
      const permission = /auth|deny/.test(error.errMsg || "");
      this.setData({ error: permission ? "请允许小程序保存照片后重试。" : error.message || "保存失败，请重试。", permission });
    } finally {
      this.setData({ busy: false });
    }
  },

  onShareAppMessage() {
    return { title: "卷卷小榜 · 同卷练习", path: "/pages/web/web?share=1" + this.paper };
  },

  openAlbumSettings() {
    wx.openSetting();
  },
});
