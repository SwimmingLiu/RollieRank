const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const format = require("../../utils/format.js");
const catalog = require("../../utils/catalog.js");
const { reportBands, drawRadar } = require("../../utils/report.js");
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
    asset: ASSET,
    publisherLogo: "",
    ready: false,
    saving: false,
    previewSrc: "",
    previewWidth: 0,
    previewHeight: 0,
    previewScale: 1,
    radarSrc: "",
    previewTop: 0,
    summary: null,
    sections: [],
    timing: null,
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
        if (standing.self) {
          this.summary = { ...this.summary, rank: standing.self.rank, count: standing.count };
          this.setData({ summary: this.summary });
        }
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
    const version = getApp().globalData.versions.find(item => item.id === attempt.versionId);
    const timing = attempt.timing;
    this.summary = {
      identity: catalog.attemptIdentity(version, attempt),
      score: format.scoreCard(report.totalCents),
      max: format.score(report.maxCents),
      correct: report.correct,
      wrong: report.wrong,
      blank: report.blank,
      rank: null,
      count: 0,
    };
    this.setData({
      loading: false,
      summary: this.summary,
      sections: this.bands,
      publisherLogo: this.publisher,
      timing: timing ? {
        planned: timing.plannedMs / 60000,
        actual: format.minutes(timing.actualMs),
        difference: (timing.actualMs >= timing.plannedMs ? "+" : "−") + format.minutes(Math.abs(timing.actualMs - timing.plannedMs)),
        modules: (timing.modules || []).map(module => ({
          name: module.name,
          planned: module.plannedMs / 60000,
          actual: format.minutes(module.actualMs),
        })),
      } : null,
    }, () => this.fit());
  },

  setMode(event) {
    if (this.data.saving || this.data.mode === event.currentTarget.dataset.key) return;
    this.setData({ mode: event.currentTarget.dataset.key, ready: false, previewSrc: "" }, () => this.fit());
  },

  fit() {
    this.createSelectorQuery().select(".share__preview").boundingClientRect(size => {
      if (!size?.width) return;
      const scale = Math.min(1, size.width / WIDTH);
      this.setData({ previewScale: scale, previewWidth: Math.floor(WIDTH * scale) }, () => {
        this.createSelectorQuery().select(".share__artifact").boundingClientRect(rect => {
          if (!rect?.height) return;
          // Mini-program runtimes differ on whether boundingClientRect includes the
          // transform. Width tells us which height was returned.
          const transformed = Math.abs(rect.width - WIDTH) > 1;
          const height = transformed ? rect.height : rect.height * scale;
          this.setData({ previewHeight: Math.ceil(height), previewTop: Date.now() % 2 }, async () => {
            await this.prepareRadar();
            this.paint();
          });
        }).exec();
      });
    }).exec();
  },

  async prepareRadar() {
    if (!["full", "radar"].includes(this.data.mode) || !this.bands?.length) return;
    if (this.radarPromise) return this.radarPromise;
    this.radarPromise = this.renderRadar();
    try {
      await this.radarPromise;
    } catch {
      this.radarPromise = null;
    }
  },

  async renderRadar() {
    const canvas = await new Promise(resolve => {
      this.createSelectorQuery().select("#radarCanvas").fields({ node: true }).exec(([result]) => resolve(result?.node));
    });
    if (!canvas) throw new Error("雷达画布尚未准备好");
    const width = 350;
    const height = 294;
    const dpr = wx.getWindowInfo?.().pixelRatio || 2;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const context = canvas.getContext("2d");
    context.scale(dpr, dpr);
    drawRadar(context, this.bands, 0, 0, width, height);
    const result = await new Promise((resolve, reject) => wx.canvasToTempFilePath({
      canvas,
      fileType: "png",
      destWidth: canvas.width,
      destHeight: canvas.height,
      success: resolve,
      fail: reject,
    }));
    await new Promise(resolve => this.setData({ radarSrc: result.tempFilePath }, resolve));
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
