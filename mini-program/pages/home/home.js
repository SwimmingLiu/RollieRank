const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const catalogUtil = require("../../utils/catalog.js");
const { minutes, score } = require("../../utils/format.js");
const { ASSET } = require("../../config.js");

Page({
  data: {
    loading: true,
    error: "",
    institutions: [],
    recent: [],
    asset: ASSET,
    uiBase: "/assets/ui",
    recentIndex: 0,
    timerRunning: false,
    timerPaused: false,
    timerText: "",
  },

  onLoad() {
    this.load();
  },

  onShow() {
    this.refreshTimer();
    this.timerTick = setInterval(() => this.refreshTimer(), 1000);
    // 从练习返回时刷新最近记录，不重新拉取目录缓存。
    this.refreshRecent();
  },

  onHide() {
    clearInterval(this.timerTick);
  },

  onUnload() {
    clearInterval(this.timerTick);
  },

  onPullDownRefresh() {
    this.load(true).finally(() => wx.stopPullDownRefresh());
  },

  async load(force) {
    this.setData({ loading: !this.data.institutions.length, error: "" });
    try {
      const versions = await api.catalog(force);
      getApp().globalData.versions = versions;
      const institutions = catalogUtil.groupByInstitution(versions).map(({ name, logo, label }) => ({ name, logo, label }));
      this.setData({ institutions, loading: false });
      this.refreshRecent();
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  retry() {
    this.load(true);
  },

  // 最近练习取三份不同套卷的最好一次，避免同一张卷重复占据首页。
  refreshRecent() {
    const seen = new Set();
    const recent = [];
    const drafts = storage.draftIndex();
    // 未交卷的草稿优先出现，避免只能重新开始。
    for (const [versionId, draft] of Object.entries(drafts)) {
      recent.push({
        id: draft.id,
        draft: true,
        versionId,
        title: draft.title || "未完成练习",
        answered: draft.answered || 0,
        questionCount: draft.questionCount || 0,
      });
      seen.add(versionId);
      if (recent.length === 3) break;
    }
    const list = storage.history().slice().sort((a, b) => b.totalCents - a.totalCents);
    for (const record of list) {
      if (seen.has(record.versionId)) continue;
      seen.add(record.versionId);
      recent.push({
        ...record,
        scoreText: score(record.totalCents),
      });
      if (recent.length === 3) break;
    }

    const versions = getApp().globalData.versions;
    const activeId = this.data.recent[this.data.recentIndex]?.id;
    const cards = recent.map(record => {
      const version = versions.find(candidate => candidate.id === record.versionId) || record;
      const institution = version.institution || "";
      const edition = catalogUtil.periodLabel(version.period);
      const number = String(version.number || "").padStart(2, "0");
      const paperTitle = catalogUtil.numberedPaper(version) ? "行测 " + number + " 套" : record.title;
      const year = String(version.project || record.title).match(/20\d{2}/)?.[0] || "";
      return {
        ...record,
        institution,
        edition,
        paperTitle,
        year,
        logo: catalogUtil.LOGO[institution] || "",
        publisher: catalogUtil.publisherName(institution),
        progress: record.questionCount ? record.answered / record.questionCount * 100 : 0,
      };
    });
    this.setData({ recent: cards, recentIndex: Math.max(0, cards.findIndex(card => card.id === activeId)) });
  },

  openInstitution(event) {
    const { name } = event.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/catalog/catalog?institution=${encodeURIComponent(name)}` });
  },

  openRecent(event) {
    const { id, draft, versionId: version } = this.data.recent[event.currentTarget.dataset.index];
    if (draft) {
      wx.navigateTo({ url: `/pages/practice/practice?versionId=${version}&attemptId=${id}` });
      return;
    }
    wx.navigateTo({ url: `/pages/report/report?attemptId=${id}` });
  },


  refreshTimer() {
    const timer = wx.getStorageSync("rr:timer") || {};
    const runningMs = timer.startedAt ? (timer.elapsedMs || 0) + Date.now() - (timer.segmentStartedAt || timer.startedAt) : 0;
    const timerRunning = Boolean(timer.running && !timer.paused && runningMs >= 0 && runningMs <= 6 * 60 * 60 * 1000);
    const timerPaused = !timerRunning && Boolean(timer.paused);
    const timerText = timerRunning ? minutes(runningMs) : timerPaused ? minutes(timer.elapsedMs || 0) : "";
    if (timerText !== this.data.timerText || timerRunning !== this.data.timerRunning || timerPaused !== this.data.timerPaused) {
      this.setData({ timerText, timerRunning, timerPaused });
    }
  },

  startDeck(event) {
    this.deckY = event.touches[0]?.clientY;
  },

  flipDeck(event) {
    const offset = event.changedTouches[0]?.clientY - this.deckY;
    const length = this.data.recent.length;
    if (length < 2 || !Number.isFinite(offset) || Math.abs(offset) < 32) return;
    this.setData({ recentIndex: (this.data.recentIndex + (offset < 0 ? 1 : -1) + length) % length });
  },

  openTimer() {
    wx.navigateTo({ url: "/pages/timer/timer" });
  },
});
