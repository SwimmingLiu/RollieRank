const api = require("../../services/api");
const storage = require("../../utils/storage");
const format = require("../../utils/format");
const { ASSET } = require("../../config");

const MODES = [
  { key: "full", label: "完整长报告" },
  { key: "score", label: "精简成绩卡" },
  { key: "types", label: "题型图" },
];

Page({
  data: {
    loading: true,
    error: "",
    mode: "full",
    modes: MODES,
    summary: null,
    bands: [],
    name: "卷友",
    asset: ASSET,
    uiBase: "/assets/ui",
    saving: false,
  },

  onLoad(query) {
    this.attemptId = query.attemptId || "";
    this.load().then(() => setTimeout(() => this.draw(), 60));
  },

  async load() {
    try {
      const attempts = await api.sync([this.attemptId]);
      const attempt = attempts[0];
      if (!attempt) throw new Error("这份成绩不在当前身份下。");
      this.attempt = attempt;
      this.setData({
        loading: false,
        name: storage.name(),
        summary: {
          title: attempt.paperTitle,
          identity: [attempt.institution, attempt.period, attempt.variant].filter(Boolean).join(" · "),
          score: format.score(attempt.report.totalCents),
          max: format.score(attempt.report.maxCents),
          correct: attempt.report.correct,
          wrong: attempt.report.wrong,
          rate: format.percent(attempt.report.rate),
        },
        bands: attempt.report.breakdown.map(type => ({
          name: type.name,
          pct: format.rate(type.maxCents ? type.centsEarned / type.maxCents : 0),
          detail: `${format.score(type.centsEarned)} / ${format.score(type.maxCents)}`,
        })),
      });
    } catch (error) {
      const local = storage.getAttempt(this.attemptId);
      if (local) {
        this.setData({
          loading: false,
          name: storage.name(),
          summary: {
            title: local.title,
            identity: [local.institution, local.period, local.variant].filter(Boolean).join(" · "),
            score: format.score(local.totalCents),
            max: format.score(local.maxCents),
            correct: local.correct,
            wrong: local.wrong,
            rate: format.percent(local.rate),
          },
          bands: (local.subjects || []).map(subject => ({
            name: subject.name,
            pct: format.rate(subject.maxCents ? subject.centsEarned / subject.maxCents : 0),
            detail: `${format.score(subject.centsEarned)} / ${format.score(subject.maxCents)}`,
          })),
        });
      } else {
        this.setData({ loading: false, error: error.message });
      }
    }
  },

  setMode(event) {
    this.setData({ mode: event.currentTarget.dataset.key });
    // 画布高度随模式变化，切换后等布局完成再重画。
    setTimeout(() => this.draw(), 60);
  },

  // 预览区域是被 canvas 绘制的，导出前先按屏幕尺寸画一次，保证所见即所存。
  onReady() {
    this.draw();
  },

  draw() {
    const query = this.createSelectorQuery();
    query.select("#shareCanvas").fields({ node: true, size: true }).exec(res => {
      const item = res && res[0];
      if (!item || !item.node) return;
      const dpr = wx.getWindowInfo ? (wx.getWindowInfo().pixelRatio || 2) : 2;
      const canvas = item.node;
      const width = item.width;
      const height = this.data.mode === "full" ? item.height : item.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      this.render(ctx, width, height);
    });
  },

  render(ctx, width, height) {
    const { summary, bands, name, mode } = this.data;
    if (!summary) return;
    ctx.fillStyle = "#fcf8f1";
    ctx.fillRect(0, 0, width, height);
    // 主卡片
    const pad = 18;
    this.roundRect(ctx, pad, pad, width - pad * 2, height - pad * 2, 20);
    ctx.fillStyle = mode === "score" ? "#f4e3be" : "#fffdf8";
    ctx.fill();
    ctx.fillStyle = "#79767d";
    ctx.font = "12px sans-serif";
    ctx.fillText(summary.identity, pad + 22, pad + 34);
    ctx.fillStyle = "#302b29";
    ctx.font = "600 16px sans-serif";
    ctx.fillText(summary.title, pad + 22, pad + 58);
    // 分数
    ctx.fillStyle = "#302b29";
    ctx.font = "700 56px Georgia, serif";
    ctx.fillText(summary.score, pad + 22, pad + 132);
    ctx.fillStyle = "#79767d";
    ctx.font = "12px sans-serif";
    ctx.fillText(`/ ${summary.max} 分 · 得分率 ${summary.rate}`, pad + 22, pad + 156);
    ctx.fillText(`正确 ${summary.correct} · 错误 ${summary.wrong}`, pad + 22, pad + 176);
    // 六条板块得分率
    let y = pad + 210;
    for (const band of bands) {
      ctx.fillStyle = "#4a443f";
      ctx.font = "13px sans-serif";
      ctx.fillText(band.name, pad + 22, y);
      ctx.fillStyle = "#79767d";
      ctx.font = "12px sans-serif";
      ctx.fillText(`${band.pct}%`, width - pad - 26 - ctx.measureText(`${band.pct}%`).width, y);
      ctx.fillStyle = "#efd9d4";
      this.roundRect(ctx, pad + 96, y - 9, width - pad * 2 - 150, 8, 4);
      ctx.fill();
      ctx.fillStyle = "#ef7d82";
      this.roundRect(ctx, pad + 96, y - 9, Math.max(6, (width - pad * 2 - 150) * Math.min(100, band.pct) / 100), 8, 4);
      ctx.fill();
      y += 34;
    }
    // 身份与水印
    ctx.fillStyle = "#302b29";
    ctx.font = "600 13px sans-serif";
    ctx.fillText(name, pad + 22, height - pad - 36);
    ctx.fillStyle = "#b7b1a7";
    ctx.font = "11px sans-serif";
    ctx.fillText("卷卷小榜 · RollieRank", pad + 22, height - pad - 18);
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  async save() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      const query = this.createSelectorQuery();
      const item = await new Promise(resolve => query.select("#shareCanvas").fields({ node: true, size: true }).exec(res => resolve(res && res[0])));
      if (!item || !item.node) throw new Error("分享图还没有准备好。");
      const canvas = item.node;
      const temp = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas,
          fileType: "png",
          destWidth: canvas.width,
          destHeight: canvas.height,
          success: res => resolve(res.tempFilePath),
          fail: reject,
        });
      });
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({ filePath: temp, success: resolve, fail: reject });
      });
      wx.showToast({ title: "已保存到相册", icon: "success" });
    } catch (error) {
      const message = String(error.errMsg || error.message || "");
      if (message.includes("auth") || message.includes("deny")) {
        wx.showModal({ title: "需要相册权限", content: "请在设置中允许保存图片到相册后重试。", confirmText: "去设置", showCancel: false, success: () => wx.openSetting() });
      } else {
        wx.showToast({ title: error.message || "保存失败，请重试", icon: "none" });
      }
    } finally {
      this.setData({ saving: false });
    }
  },

  onShareAppMessage() {
    const summary = this.data.summary;
    return {
      title: summary ? `${summary.title} · ${summary.score} 分` : "卷卷小榜",
      path: "/pages/home/home",
    };
  },
});
