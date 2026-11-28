const api = require("../../services/api.js");
const cloudSync = require("../../services/cloud-sync.js");
const storage = require("../../utils/storage.js");
const format = require("../../utils/format.js");
const catalog = require("../../utils/catalog.js");
const shareUtil = require("../../utils/share.js");
const { reportBands, buildComparison } = require("../../utils/report.js");
const {
  WIDTH,
  STYLES,
  DEFAULT_STYLE,
  getStyle,
  splitScoreParts,
  enrichBands,
  bandCountUnit,
  outcomeMetrics,
  rulerTicks,
  drawDonut,
  drawMiniRing,
  drawRichRadar,
  posterHeight,
  drawPoster,
} = require("../../utils/poster.js");
const { ASSET, storageKey } = require("../../config.js");

const STYLE_STORAGE_KEY = storageKey("rr_share_style");

const MODES = [
  { key: "full", label: "长图" },
  { key: "score", label: "成绩卡" },
  { key: "types", label: "题型" },
  { key: "radar", label: "雷达" },
];

const STYLE_OPTIONS = STYLES.map(({ key, label, name, swatch, layout, dark }) => ({
  key,
  label,
  name,
  swatch,
  layout,
  dark,
}));

function savedStyle() {
  try {
    const val = wx.getStorageSync(STYLE_STORAGE_KEY);
    if (STYLES.some(item => item.key === val)) return val;
  } catch {
    // Fallback to default style when storage is unavailable.
  }
  return DEFAULT_STYLE;
}

function canvasImage(canvas, src) {
  if (!src) return Promise.resolve(null);
  return new Promise(resolve => {
    const image = canvas.createImage();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function stampDate(ts) {
  const raw = format.dateTime(ts || Date.now()).slice(0, 10);
  if (!raw) return "";
  return raw.slice(5).replace(/-/g, ".");
}

function canvasToTemp(canvas) {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas,
      fileType: "png",
      destWidth: canvas.width,
      destHeight: canvas.height,
      success: res => resolve(res.tempFilePath),
      fail: reject,
    });
  });
}

function waitFonts() {
  try {
    return getApp()?.globalData?.fontsReady || Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

Page({
  data: {
    loading: true,
    error: "",
    mode: "full",
    modes: MODES,
    style: DEFAULT_STYLE,
    styles: STYLE_OPTIONS,
    isRings: false,
    isDark: false,
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
    donutSrc: "",
    previewTop: 0,
    summary: null,
    outcomes: null,
    rulerTicks: ["0", "50", "100"],
    rulerSubMarks: [10, 20, 30, 40, 60, 70, 80, 90],
    bestBand: null,
    bandUnitLabel: "对题 / 总题",
    comparison: null,
    sections: [],
    timing: null,
    qrSrc: "",
    referralEnabled: false,
    referralRewardText: "",
  },

  onLoad(query) {
    this.attemptId = query.attemptId || "";
    this.radarCache = {};
    this.donutCache = {};
    this.ringsCache = {};
    const initialStyle = savedStyle();
    const theme = getStyle(initialStyle);
    const cachedRef = shareUtil.cachedReferralState();
    this.setData({
      style: theme.key,
      isRings: theme.layout === "rings",
      isDark: theme.dark,
      referralEnabled: cachedRef.enabled,
      referralRewardText: cachedRef.rewardText,
    });
    this.load();
    this.refreshReferral();
  },

  onUnload() {
    this.unloaded = true;
  },

  onShow() {
    this.refreshReferral();
  },

  async refreshReferral() {
    const state = await shareUtil.syncReferral();
    if (this.unloaded) return;
    this.setData({
      referralEnabled: state.enabled,
      referralRewardText: state.rewardText,
    });
    if (state.signedIn) {
      const personalQr = await shareUtil.loadPersonalQrFile();
      if (personalQr && personalQr !== this.data.qrSrc && !this.unloaded) {
        this.imagePromise = null;
        this.setData({ qrSrc: personalQr }, () => {
          if (this.summary) this.paint();
        });
      }
    } else if (this.data.qrSrc) {
      this.imagePromise = null;
      this.setData({ qrSrc: "" }, () => {
        if (this.summary) this.paint();
      });
    }
  },

  retry() {
    this.setData({ loading: true, error: "" });
    this.load();
  },

  onResize() {
    if (this.summary) this.fit();
  },

  async load() {
    try {
      await cloudSync.ensureSession();
      const [attempt] = await api.sync([this.attemptId]);
      if (!attempt) throw new Error("这份成绩不在当前身份下。");
      storage.upsertAttempt(attempt);
      this.apply(attempt, attempt.report);
      try {
        const standing = await api.request(
          "positions/leaderboard?versionId=" + encodeURIComponent(attempt.versionId) +
          "&guestId=" + encodeURIComponent(storage.guestId()) + "&scope=nationwide"
        );
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
    this.bands = enrichBands(reportBands(report.breakdown));
    const version = getApp().globalData.versions.find(item => item.id === attempt.versionId);
    const timing = attempt.timing;
    const comparison = buildComparison({ ...attempt, report }, storage.history());
    const identity = catalog.attemptIdentity(version, attempt);
    const parts = identity.split(" · ");
    const paperName = parts.length > 1 ? parts.pop() : identity;
    const seriesName = parts.join(" · ") || catalog.publisherName(attempt.institution || "");
    const dateStamp = stampDate(attempt.createdAt);
    const scoreRate = report.rate ?? (report.maxCents ? report.totalCents / report.maxCents : 0);
    const scorePct = Math.max(0, Math.min(100, Math.round(scoreRate * 10000) / 100));
    const pinPct = Math.max(2, Math.min(98, scorePct));
    const scoreText = format.scoreCard(report.totalCents);
    const { scoreInt, scoreDec } = splitScoreParts(scoreText);
    const maxText = format.score(report.maxCents);

    this.summary = {
      identity,
      seriesName,
      paperName,
      dateStamp,
      subLine: [seriesName, dateStamp].filter(Boolean).join(" · "),
      score: scoreText,
      scoreInt,
      scoreDec,
      scoreCompact: scoreInt.length >= 3,
      max: maxText,
      rate: format.percent(scoreRate),
      scorePct,
      pinPct,
      correct: report.correct,
      wrong: report.wrong,
      blank: report.blank,
      rank: null,
      count: 0,
    };
    this.comparison = comparison;
    this.radarCache = {};
    this.donutCache = {};
    this.ringsCache = {};
    const bestBand = this.bands.find(b => b.isBest) || null;

    this.setData({
      loading: false,
      summary: this.summary,
      outcomes: outcomeMetrics(this.summary),
      rulerTicks: rulerTicks(maxText),
      bestBand,
      bandUnitLabel: bandCountUnit(this.bands),
      comparison,
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
    const key = event.currentTarget.dataset.key;
    if (this.data.saving || this.data.mode === key) return;
    this.setData({ mode: key, ready: false, previewSrc: "" }, () => this.fit());
  },

  setStyle(event) {
    const key = event.currentTarget.dataset.key;
    if (this.data.saving || this.data.style === key) return;
    const theme = getStyle(key);
    try {
      wx.setStorageSync(STYLE_STORAGE_KEY, theme.key);
    } catch {
      // Ignore storage failures.
    }
    this.setData({
      style: theme.key,
      isRings: theme.layout === "rings",
      isDark: theme.dark,
      ready: false,
      previewSrc: "",
    }, () => this.fit());
  },

  fit() {
    this.createSelectorQuery().select(".share__preview-inner").boundingClientRect(size => {
      if (!size?.width) return;
      const available = Math.max(200, size.width - 12);
      const scale = Math.min(1, available / WIDTH);
      this.setData({ previewScale: scale, previewWidth: Math.floor(WIDTH * scale) }, () => {
        this.createSelectorQuery().select(".share__artifact").boundingClientRect(rect => {
          if (!rect?.height) return;
          const transformed = Math.abs(rect.width - WIDTH) > 1;
          const height = transformed ? rect.height : rect.height * scale;
          this.setData({ previewHeight: Math.ceil(height), previewTop: 0 }, async () => {
            await this.prepareGraphics();
            this.paint();
          });
        }).exec();
      });
    }).exec();
  },

  getCanvas(selector) {
    return new Promise(resolve => {
      this.createSelectorQuery().select(selector).fields({ node: true }).exec(([result]) => resolve(result?.node));
    });
  },

  async prepareGraphics() {
    await waitFonts();
    const styleKey = this.data.style;
    const theme = getStyle(styleKey);
    const mode = this.data.mode;
    const tasks = [];

    if ((mode === "full" || mode === "radar") && this.bands?.length) {
      tasks.push(this.prepareRadar(styleKey));
    }
    if ((mode === "full" || mode === "score") && theme.layout !== "rings") {
      tasks.push(this.prepareDonut(styleKey));
    }
    if (theme.layout === "rings" && (mode === "full" || mode === "score" || mode === "types") && this.bands?.length) {
      tasks.push(this.prepareRings(styleKey));
    }
    await Promise.all(tasks);
  },

  async prepareRadar(styleKey) {
    if (this.radarCache[styleKey]) {
      if (this.data.style === styleKey && this.data.radarSrc !== this.radarCache[styleKey]) {
        this.setData({ radarSrc: this.radarCache[styleKey] });
      }
      return;
    }
    try {
      const canvas = await this.getCanvas("#radarCanvas");
      if (!canvas) return;
      const width = 406;
      const height = 306;
      const dpr = wx.getWindowInfo?.().pixelRatio || 2;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      drawRichRadar(ctx, this.bands, 0, 0, width, height, styleKey);
      const path = await canvasToTemp(canvas);
      this.radarCache[styleKey] = path;
      if (this.data.style === styleKey) {
        await new Promise(resolve => this.setData({ radarSrc: path }, resolve));
      }
    } catch {
      // Allow retry on next switch.
    }
  },

  async prepareDonut(styleKey) {
    if (this.donutCache[styleKey]) {
      if (this.data.style === styleKey && this.data.donutSrc !== this.donutCache[styleKey]) {
        this.setData({ donutSrc: this.donutCache[styleKey] });
      }
      return;
    }
    try {
      const canvas = await this.getCanvas("#donutCanvas");
      if (!canvas) return;
      const size = 124;
      const dpr = wx.getWindowInfo?.().pixelRatio || 2;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      drawDonut(ctx, size, this.summary, styleKey);
      const path = await canvasToTemp(canvas);
      this.donutCache[styleKey] = path;
      if (this.data.style === styleKey) {
        await new Promise(resolve => this.setData({ donutSrc: path }, resolve));
      }
    } catch {
      // Allow retry on next switch.
    }
  },

  async prepareRings(styleKey) {
    if (this.ringsCache[styleKey]) {
      if (this.data.style === styleKey) {
        const srcs = this.ringsCache[styleKey];
        this.setData({
          sections: this.bands.map((band, idx) => ({ ...band, ringSrc: srcs[idx] || "" })),
        });
      }
      return;
    }
    try {
      const canvas = await this.getCanvas("#ringCanvas");
      if (!canvas) return;
      const size = 82;
      const dpr = wx.getWindowInfo?.().pixelRatio || 2;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      const ctx = canvas.getContext("2d");
      const srcs = [];
      for (const band of this.bands) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);
        drawMiniRing(ctx, size, band.pctInt, band.isBest, band.isLow, styleKey);
        srcs.push(await canvasToTemp(canvas));
      }
      this.ringsCache[styleKey] = srcs;
      if (this.data.style === styleKey) {
        await new Promise(resolve => this.setData({
          sections: this.bands.map((band, idx) => ({ ...band, ringSrc: srcs[idx] || "" })),
        }, resolve));
      }
    } catch {
      // Allow retry on next switch.
    }
  },

  async paint() {
    if (!this.data.previewWidth) return;
    await waitFonts();
    const mode = this.data.mode;
    const style = this.data.style;
    const number = (this.paintNumber || 0) + 1;
    this.paintNumber = number;
    const canvas = await this.getCanvas("#shareCanvas");
    if (!canvas || number !== this.paintNumber) return;
    const qrSource = this.data.qrSrc || ASSET.qrcode;
    this.imagePromise ||= Promise.all([
      canvasImage(canvas, ASSET.logo),
      canvasImage(canvas, this.publisher),
      canvasImage(canvas, ASSET.keepsake),
      canvasImage(canvas, qrSource).then(img => img || (qrSource !== ASSET.qrcode ? canvasImage(canvas, ASSET.qrcode) : null)),
      canvasImage(canvas, "/assets/ui/trophy-ochre.svg"),
      canvasImage(canvas, "/assets/ui/trophy-gold.svg"),
    ]);
    const [brand, publisher, keepsake, qrcode, trophy, trophyGold] = await this.imagePromise;
    if (number !== this.paintNumber) return;
    // The export uses a 900 px artboard independently of the on-screen fit.
    canvas.width = WIDTH * 2;
    canvas.height = posterHeight(mode, this.bands, this.data.timing, this.comparison, style) * 2;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(2, 2);
    drawPoster(ctx, {
      mode,
      style,
      summary: this.summary,
      bands: this.bands,
      timing: this.data.timing,
      comparison: this.comparison,
      images: { brand, publisher, keepsake, qrcode, trophy, trophyGold },
    });
    try {
      const tempFilePath = await canvasToTemp(canvas);
      if (number === this.paintNumber) this.setData({ previewSrc: tempFilePath, ready: true });
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
        wx.showModal({
          title: "需要相册权限",
          content: "允许保存图片到相册后可重试。",
          confirmText: "去设置",
          success: result => { if (result.confirm) wx.openSetting(); },
        });
      } else {
        wx.showToast({ title: "保存失败，请重试", icon: "none" });
      }
    } finally {
      this.setData({ saving: false });
    }
  },

  onShareAppMessage() {
    const basePath = this.versionId
      ? "/pages/practice/practice?versionId=" + encodeURIComponent(this.versionId)
      : "/pages/home/home";
    return {
      title: this.title ? this.title + " · " + this.summary.score + " 分" : "卷卷小榜",
      path: shareUtil.withReferralPath(basePath),
    };
  },

  onShareTimeline() {
    const query = this.versionId ? "versionId=" + encodeURIComponent(this.versionId) : "";
    return {
      title: this.title ? this.title + " · " + this.summary.score + " 分" : "卷卷小榜",
      query: shareUtil.withReferralQuery(query),
    };
  },
});
