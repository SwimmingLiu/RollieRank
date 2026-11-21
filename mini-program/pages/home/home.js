const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const catalogUtil = require("../../utils/catalog.js");
const { scoreCard } = require("../../utils/format.js");
const { homeTimerView } = require("../../utils/timing.js");
const { formatElapsed } = require("../../vendor/practice-timer.js");
const { ASSET, WEB_APP_ORIGIN } = require("../../config.js");

Page({
  data: {
    loading: true,
    openingWeb: false,
    error: "",
    institutions: [],
    recent: [],
    asset: ASSET,
    uiBase: "/assets/ui",
    recentIndex: 0,
    deckOffset: 0,
    deckScale: 1,
    deckDragging: false,
    timerOpen: false,
    timerStatus: "ready",
    timerText: "",
  },

  onLoad() {
    if (WEB_APP_ORIGIN && !getApp().globalData.openNativeHome) {
      // The native tab stays the launch page so existing WeChat versions can start the app normally.
      this.setData({ openingWeb: true });
      wx.reLaunch({
        url: "/pages/web/web",
        fail: () => { this.setData({ openingWeb: false }); this.load(); },
      });
      return;
    }
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
    const candidates = Object.entries(storage.draftIndex()).map(([versionId, draft]) => ({
        id: draft.id,
        draft: true,
        versionId,
        title: draft.title || "未完成练习",
        answered: draft.answered || 0,
        questionCount: draft.questionCount || 0,
        updatedAt: draft.updatedAt || 0,
    }));
    candidates.push(...storage.history());
    candidates.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    const seen = new Set();
    const recent = [];
    for (const record of candidates) {
      if (seen.has(record.versionId)) continue;
      seen.add(record.versionId);
      recent.push({
        ...record,
        ...(record.draft ? {} : { scoreText: scoreCard(record.totalCents) }),
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
    if (this.deckMoved) return;
    const { id, draft, versionId: version } = this.data.recent[event.currentTarget.dataset.index];
    if (draft) {
      wx.navigateTo({ url: `/pages/practice/practice?versionId=${version}&attemptId=${id}` });
      return;
    }
    wx.navigateTo({ url: `/pages/report/report?attemptId=${id}` });
  },


  refreshTimer() {
    const { status, actualMs } = homeTimerView();
    const timerText = status === "ready" ? "" : formatElapsed(actualMs);
    if (timerText !== this.data.timerText || status !== this.data.timerStatus) {
      this.setData({ timerText, timerStatus: status });
    }
  },

  startDeck(event) {
    this.deckY = event.touches[0]?.clientY;
    this.deckMoved = false;
    this.setData({ deckDragging: true });
  },

  moveDeck(event) {
    if (this.data.recent.length < 2 || !Number.isFinite(this.deckY)) return;
    const point = event.touches[0];
    if (!point) return;
    const offset = Math.max(-84, Math.min(0, point.clientY - this.deckY));
    if (Math.abs(offset) >= 8) this.deckMoved = true;
    const progress = Math.abs(offset) / 84;
    this.setData({ deckOffset: offset, deckScale: 1 - progress * .025 });
  },

  flipDeck(event) {
    const offset = Number.isFinite(this.deckY) ? event.changedTouches[0]?.clientY - this.deckY : 0;
    const length = this.data.recent.length;
    this.deckY = undefined;
    if (this.deckMoved) setTimeout(() => { this.deckMoved = false; }, 0);
    if (length >= 2 && Number.isFinite(offset) && offset <= -38) {
      const next = (this.data.recentIndex + 1) % length;
      this.setData({ recentIndex: next, deckOffset: 42, deckScale: .975, deckDragging: false }, () => {
        setTimeout(() => this.setData({ deckOffset: 0, deckScale: 1 }), 16);
      });
      return;
    }
    this.setData({ deckOffset: 0, deckScale: 1, deckDragging: false });
  },

  cancelDeck() {
    this.deckY = undefined;
    this.deckMoved = true;
    setTimeout(() => { this.deckMoved = false; }, 0);
    this.setData({ deckOffset: 0, deckScale: 1, deckDragging: false });
  },

  openTimer() {
    // 原稿从首页打开计时抽屉，底下仍是当前练习卡片。
    this.setData({ timerOpen: true });
  },

  closeTimer() {
    this.setData({ timerOpen: false });
    this.refreshTimer();
  },
});
