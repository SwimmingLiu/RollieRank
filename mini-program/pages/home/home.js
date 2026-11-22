const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const catalogUtil = require("../../utils/catalog.js");
const tabSwipe = require("../../utils/tab-swipe.js");
const { homeTimerView } = require("../../utils/timing.js");
const { formatElapsed } = require("../../vendor/practice-timer.js");
const { ASSET, WEB_APP_ORIGIN } = require("../../config.js");

Page({
  data: {
    loading: true,
    refreshing: false,
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
    tabSwipeOffset: 0,
    tabSwiping: false,
    timerOpen: false,
    timerStatus: "ready",
    timerText: "",
  },

  onLoad(options) {
    const inviteCode = typeof options?.inviteCode === "string" ? options.inviteCode.trim() : "";
    if (/^[a-zA-Z0-9_-]{16}$/.test(inviteCode)) {
      getApp().globalData.pendingInviteCode = inviteCode;
    }
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
    this.resetTabSwipe();
    this.refreshTimer();
    this.timerTick = setInterval(() => this.refreshTimer(), 1000);
    // 从练习返回时刷新最近记录，不重新拉取目录缓存。
    this.refreshRecent();
  },

  onHide() {
    clearInterval(this.timerTick);
    this.resetTabSwipe();
  },

  onUnload() {
    clearInterval(this.timerTick);
    clearTimeout(this.tabSwipeClickTimer);
  },

  onRefresherRefresh() {
    this.setData({ refreshing: true });
    this.load(true).finally(() => this.setData({ refreshing: false }));
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
      recent.push(record);
      if (recent.length === 3) break;
    }

    const versions = getApp().globalData.versions;
    const activeId = this.data.recent[this.data.recentIndex]?.id;
    const cards = recent.map(record => {
      const version = versions.find(candidate => candidate.id === record.versionId) || record;
      const institution = version.institution || "";
      const projectHead = String(version.project || "").split(" · ")[0];
      const edition = catalogUtil.cleanPeriod(projectHead, version.period);
      const card = catalogUtil.paperCardParts({ ...version, title: version.title || record.title });
      const paperTitle = card.shortTitle;
      const year = String(version.project || record.title).match(/20\d{2}/)?.[0] || "";
      const answered = record.draft
        ? record.answered || 0
        : Math.max(0, (record.questionCount || 0) - (record.blank || 0));
      return {
        ...record,
        answered,
        institution,
        edition,
        paperTitle,
        year,
        logo: catalogUtil.LOGO[institution] || "",
        publisher: catalogUtil.publisherName(institution),
        progress: record.questionCount ? answered / record.questionCount * 100 : 0,
      };
    });
    this.setData({ recent: cards, recentIndex: Math.max(0, cards.findIndex(card => card.id === activeId)) });
  },

  openInstitution(event) {
    if (this.tabSwipeMoved) return;
    const { name } = event.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/catalog/catalog?institution=${encodeURIComponent(name)}` });
  },

  openRecent(event) {
    if (this.deckMoved || this.tabSwipeMoved) return;
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

  resetTabSwipe() {
    this.tabSwipeSession = null;
    this.tabSwipeMoved = false;
    clearTimeout(this.tabSwipeClickTimer);
    if (this.data.tabSwipeOffset || this.data.tabSwiping) {
      this.setData({ tabSwipeOffset: 0, tabSwiping: false });
    }
  },

  startTabSwipe(event) {
    if (this.data.timerOpen || this.data.openingWeb) return;
    const point = event.touches?.[0];
    if (!point || event.touches.length > 1) {
      this.tabSwipeSession = null;
      return;
    }
    this.tabSwipeMoved = false;
    clearTimeout(this.tabSwipeClickTimer);
    const width = (wx.getWindowInfo && wx.getWindowInfo().windowWidth) || 375;
    this.tabSwipeSession = tabSwipe.createSwipeSession({
      currentKey: "home",
      x: point.clientX,
      y: point.clientY,
      now: Date.now(),
      width,
    });
  },

  moveTabSwipe(event) {
    if (!this.tabSwipeSession || this.data.timerOpen) return;
    const point = event.touches?.[0];
    if (!point) return;
    const state = tabSwipe.updateSwipeSession(this.tabSwipeSession, { x: point.clientX, y: point.clientY });
    if (state.axis !== "x") return;
    if (state.moved) this.tabSwipeMoved = true;
    if (state.offset !== this.data.tabSwipeOffset || !this.data.tabSwiping) {
      this.setData({ tabSwipeOffset: state.offset, tabSwiping: state.offset !== 0 });
    }
  },

  endTabSwipe(event) {
    const session = this.tabSwipeSession;
    this.tabSwipeSession = null;
    if (!session || this.data.timerOpen) {
      if (this.data.tabSwipeOffset || this.data.tabSwiping) this.setData({ tabSwipeOffset: 0, tabSwiping: false });
      return;
    }
    const point = event.changedTouches?.[0];
    const result = point
      ? tabSwipe.finishSwipeSession(session, { x: point.clientX, y: point.clientY, now: Date.now() })
      : { switchTo: null, moved: session.moved };
    if (result.moved) {
      this.tabSwipeMoved = true;
      clearTimeout(this.tabSwipeClickTimer);
      this.tabSwipeClickTimer = setTimeout(() => { this.tabSwipeMoved = false; }, 120);
    }
    if (this.data.tabSwipeOffset || this.data.tabSwiping) {
      this.setData({ tabSwipeOffset: 0, tabSwiping: false });
    }
    if (result.switchTo) {
      wx.switchTab({ url: result.switchTo.url });
    }
  },

  cancelTabSwipe() {
    this.tabSwipeSession = null;
    if (this.data.tabSwipeOffset || this.data.tabSwiping) {
      this.setData({ tabSwipeOffset: 0, tabSwiping: false });
    }
  },

  startDeck(event) {
    const point = event.touches[0];
    this.deckX = point?.clientX;
    this.deckY = point?.clientY;
    this.deckAxis = null;
    this.deckMoved = false;
    this.setData({ deckDragging: true });
  },

  moveDeck(event) {
    const point = event.touches[0];
    if (!point) return;
    if (!Number.isFinite(this.deckX) || !Number.isFinite(this.deckY)) return;
    const dx = point.clientX - this.deckX;
    const dy = point.clientY - this.deckY;
    if (!this.deckAxis && Math.hypot(dx, dy) >= 8) {
      this.deckAxis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
      if (this.deckAxis === "x") {
        this.deckMoved = true;
        if (this.data.deckOffset || this.data.deckScale !== 1 || this.data.deckDragging) {
          this.setData({ deckOffset: 0, deckScale: 1, deckDragging: false });
        }
      } else {
        this.cancelTabSwipe();
      }
    }
    if (this.deckAxis === "x") {
      this.moveTabSwipe(event);
      return;
    }
    if (this.data.recent.length < 2) return;
    const offset = Math.max(-84, Math.min(0, dy));
    if (Math.abs(offset) >= 8) this.deckMoved = true;
    const progress = Math.abs(offset) / 84;
    this.setData({ deckOffset: offset, deckScale: 1 - progress * .025 });
  },

  flipDeck(event) {
    const axis = this.deckAxis;
    const offset = Number.isFinite(this.deckY) ? event.changedTouches[0]?.clientY - this.deckY : 0;
    const length = this.data.recent.length;
    this.deckX = undefined;
    this.deckY = undefined;
    this.deckAxis = null;
    if (this.deckMoved) setTimeout(() => { this.deckMoved = false; }, 0);
    if (axis !== "x" && length >= 2 && Number.isFinite(offset) && offset <= -38) {
      const next = (this.data.recentIndex + 1) % length;
      this.setData({ recentIndex: next, deckOffset: 42, deckScale: .975, deckDragging: false }, () => {
        setTimeout(() => this.setData({ deckOffset: 0, deckScale: 1 }), 16);
      });
      return;
    }
    this.setData({ deckOffset: 0, deckScale: 1, deckDragging: false });
  },

  cancelDeck() {
    this.deckX = undefined;
    this.deckY = undefined;
    this.deckAxis = null;
    this.deckMoved = true;
    setTimeout(() => { this.deckMoved = false; }, 0);
    this.setData({ deckOffset: 0, deckScale: 1, deckDragging: false });
  },

  openTimer() {
    if (this.tabSwipeMoved) return;
    // 原稿从首页打开计时抽屉，底下仍是当前练习卡片。
    this.setData({ timerOpen: true });
  },

  closeTimer() {
    this.setData({ timerOpen: false });
    this.refreshTimer();
  },
});
