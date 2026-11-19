const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const format = require("../../utils/format.js");
const catalog = require("../../utils/catalog.js");
const { reportBands } = require("../../utils/report.js");
const { WIDTH, posterHeight, drawPoster } = require("../../utils/poster.js");
const { ASSET } = require("../../config.js");

const MODES = [
  { key: "full", label: "长图" },
  { key: "score", label: "成绩卡" },
  { key: "types", label: "题型" },
  { key: "radar", label: "雷达" },
];

function canvasImage(canvas, src) {
  if (!src) return Promise.resolve(null);
  return new Promise(resolve => {
    const image = canvas.createImage();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

Page({
  data: {
    loading: true,
    error: "",
    mode: "full",
    modes: MODES,
    uiBase: "/assets/ui",
    ready: false,
    saving: false,
    previewSrc: "",
    previewWidth: 0,
    previewHeight: 0,
    previewTop: 0,
  },

  onLoad(query) {
    this.attemptId = query.attemptId || "";
    this.load();
  },

  onResize() {
    if (this.summary) this.fit();
  },

  async load() {
    try {
      const [attempt] = await api.sync([this.attemptId]);
      if (!attempt) throw new Error("这份成绩不在当前身份下。");
      this.apply(attempt, attempt.report);
      try {
        const standing = await api.request("positions/leaderboard?versionId=" + encodeURIComponent(attempt.versionId) +
          "&guestId=" + encodeURIComponent(storage.guestId()) + "&scope=nationwide");
        if (standing.self) this.summary = { ...this.summary, rank: standing.self.rank, count: standing.count };
        this.paint();
      } catch {
        // A saved report can be exported while ranks are unavailable.
      }
    } catch (error) {
      const local = storage.getAttempt(this.attemptId);
      if (local) this.apply(local, { ...local, breakdown: local.subjects });
      else this.setData({ loading: false, error: error.message });
    }
  },

  apply(attempt, report) {
    this.versionId = attempt.versionId;
    this.title = attempt.paperTitle || attempt.title;
    this.publisher = ASSET[catalog.LOGO[attempt.institution]] || "";
    this.bands = reportBands(report.breakdown);
    this.summary = {
      identity: this.identity || catalog.attemptIdentity(null, attempt),
      score: format.score(report.totalCents),
      max: format.score(report.maxCents),
      correct: report.correct,
      wrong: report.wrong,
      blank: report.blank,
    };
    this.setData({ loading: false }, () => this.fit());
  },

  setMode(event) {
    if (this.data.saving || this.data.mode === event.currentTarget.dataset.key) return;
    this.setData({ mode: event.currentTarget.dataset.key, ready: false, previewSrc: "" }, () => this.fit());
  },

  fit() {
    this.createSelectorQuery().select(".share__preview").boundingClientRect(size => {
      if (!size?.width || !size.height) return;
      const mode = this.data.mode;
      const height = posterHeight(mode, this.bands);
      const fitWidth = (size.width - 36) / WIDTH;
      const scale = mode === "full" ? fitWidth : Math.min(fitWidth, (size.height - 4) / height);
      this.setData({
        previewWidth: Math.floor(WIDTH * scale),
        previewHeight: Math.floor(height * scale),
        previewTop: Date.now() % 2,
      }, () => this.paint());
    }).exec();
  },

  async paint() {
    if (!this.data.previewWidth) return;
    const mode = this.data.mode;
    const number = (this.paintNumber || 0) + 1;
    this.paintNumber = number;
    const canvas = await new Promise(resolve => {
      this.createSelectorQuery().select("#shareCanvas").fields({ node: true }).exec(([result]) => resolve(result?.node));
    });
    if (!canvas || number !== this.paintNumber) return;
    this.imagePromise ||= Promise.all([
      canvasImage(canvas, ASSET.logo),
      canvasImage(canvas, this.publisher),
      canvasImage(canvas, "/assets/score-ribbon.svg"),
    ]);
    const [brand, publisher, medal] = await this.imagePromise;
    if (number !== this.paintNumber) return;
    // The export uses a 900 px artboard independently of the on-screen fit.
    canvas.width = WIDTH * 2;
    canvas.height = posterHeight(mode, this.bands) * 2;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    drawPoster(ctx, { mode, summary: this.summary, bands: this.bands, images: { brand, publisher, medal } });
    // An image obeys the scroll-view clip on runtimes that place canvas above the WebView.
    try {
      const result = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas, fileType: "png", destWidth: canvas.width, destHeight: canvas.height,
          success: resolve, fail: reject,
        });
      });
      if (number === this.paintNumber) this.setData({ previewSrc: result.tempFilePath, ready: true });
    } catch {
      if (number === this.paintNumber) this.setData({ ready: false, error: "分享图生成失败，请返回重试。" });
    }
  },

  async save() {
    if (!this.data.ready || this.data.saving) return;
    this.setData({ saving: true });
    try {
      await new Promise((resolve, reject) => wx.saveImageToPhotosAlbum({
        filePath: this.data.previewSrc, success: resolve, fail: reject,
      }));
      wx.showToast({ title: "已保存到相册", icon: "success" });
    } catch (error) {
      const message = String(error.errMsg || error.message || "");
      if (/auth|deny/.test(message)) {
        wx.showModal({ title: "需要相册权限", content: "允许保存图片到相册后可重试。", confirmText: "去设置", showCancel: false, success: () => wx.openSetting() });
      } else {
        wx.showToast({ title: "保存失败，请重试", icon: "none" });
      }
    } finally {
      this.setData({ saving: false });
    }
  },

  onShareAppMessage() {
    return {
      title: this.title ? this.title + " · " + this.summary.score + " 分" : "卷卷小榜",
      path: this.versionId ? "/pages/practice/practice?versionId=" + encodeURIComponent(this.versionId) : "/pages/home/home",
    };
  },
});
