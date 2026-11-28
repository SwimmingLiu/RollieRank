const api = require("../../services/api.js");
const cloudSync = require("../../services/cloud-sync.js");
const storage = require("../../utils/storage.js");
const profile = require("../../services/profile.js");
const credits = require("../../services/tool-credits.js");
const format = require("../../utils/format.js");
const tabSwipe = require("../../utils/tab-swipe.js");
const { publisherName, cleanPeriod, paperCardParts, LOGO } = require("../../utils/catalog.js");
const { ASSET, storageKey } = require("../../config.js");

const FEEDBACK_SEEN_KEY = storageKey("rr:feedback-seen-reply-at");

const TABS = [
  { key: "all", label: "全部" },
  { key: "done", label: "已完成" },
  { key: "draft", label: "录入中" },
];
Page({
  data: {
    name: "卷友",
    avatar: "",
    defaultAvatar: "/assets/avatars/rank-1.svg",
    hasWechatProfile: false,
    profileSheetOpen: false,
    position: null,
    records: [],
    drafts: [],
    tab: "all",
    tabs: TABS,
    loading: true,
    refreshing: false,
    syncing: false,
    asset: ASSET,
    uiBase: "/assets/ui",
    keyword: "",
    searching: false,
    visible: [],
    positionOpen: false,
    tabSwipeOffset: 0,
    tabSwiping: false,
    creditSignedIn: false,
    creditLoginOpen: false,
    creditUid: 0,
    creditBalance: 0,
    creditHeld: 0,
    feedbackHasReply: false,
  },

  onShow() {
    this.resetTabSwipe();
    const cachedUid = credits.uid();
    if (cachedUid && cachedUid !== this.data.creditUid) this.setData({ creditUid: cachedUid });
    this.refresh();
    this.refreshFeedbackBadge();
    this.restoreCloud(!this.synced);
  },

  onHide() {
    this.resetTabSwipe();
  },

  onUnload() {
    clearTimeout(this.tabSwipeClickTimer);
  },

  onRefresherRefresh() {
    this.setData({ refreshing: true });
    Promise.all([this.sync(true), this.refreshCredits({ skipProfile: true })]).finally(() => this.setData({ refreshing: false }));
  },

  async restoreCloud(forceSync) {
    await cloudSync.ensureSession();
    await Promise.all([
      forceSync ? this.sync(false) : Promise.resolve(),
      this.refreshProfile(),
      cloudSync.syncPosition().then(result => {
        if (!result || !result.ok) return;
        const nextPos = result.position ? { id: result.position.id, label: result.position.label || result.position.title } : null;
        if ((nextPos?.id || "") !== (this.data.position?.id || "")) {
          this.setData({ position: nextPos });
        }
      }).catch(() => {}),
      this.refreshCredits({ skipProfile: true }),
    ]);
  },

  // 先展示本机记录，再向服务端同步订正后的成绩；离线也不丢历史。
  refresh() {
    const history = storage.history();
    const position = storage.position();
    const versions = getApp().globalData.versions;
    const withIdentity = record => {
      const version = versions.find(item => item.id === record.versionId) || record;
      const institution = version.institution || record.identity?.split(" · ")[0] || "";
      const projectHead = String(version.project || "").split(" · ")[0];
      const year = String(version.project || record.identity || "").match(/20\d{2}/)?.[0] || "";
      const period = cleanPeriod(projectHead, version.period);
      const card = paperCardParts({ ...version, title: version.title || record.title });
      return {
        ...record,
        publisher: publisherName(institution),
        logo: ASSET[LOGO[institution === "花生" ? "四海" : institution]] || "",
        edition: [year, period].filter(Boolean).join(" · "),
        paper: card.compactTitle,
        scoreText: format.scoreCard(record.totalCents),
        progress: record.questionCount ? record.answered / record.questionCount * 100 : 0,
      };
    };
    const records = history.map(withIdentity);
    const drafts = Object.values(storage.draftIndex()).map(draft => withIdentity({ ...draft, draft: true }));
    const attemptsByPaper = new Map();
    for (const item of [...records, ...drafts]) {
      const scope = item.paperId || versions.find(version => version.id === item.versionId)?.paperId || item.versionId;
      if (!attemptsByPaper.has(scope)) attemptsByPaper.set(scope, []);
      attemptsByPaper.get(scope).push(item);
    }
    for (const attempts of attemptsByPaper.values()) {
      if (attempts.length < 2) continue;
      attempts.sort((a, b) => (a.createdAt || a.updatedAt || 0) - (b.createdAt || b.updatedAt || 0));
      attempts.forEach((item, index) => { item.attemptNumber = index + 1; });
    }
    this.setData({
      loading: false,
      name: storage.name(),
      avatar: profile.avatarUrl(),
      defaultAvatar: profile.defaultAvatar(),
      hasWechatProfile: storage.hasWechatProfile(),
      position: position ? { id: position.id, label: position.label || position.title } : null,
      records,
      drafts,
    });
    this.applyFilter();
  },

  async sync(notify) {
    if (this.data.syncing) return;
    this.setData({ syncing: true });
    try {
      const signedIn = await cloudSync.ensureSession();
      const [attempts, posResult] = await Promise.all([
        api.sync(),
        notify ? cloudSync.syncPosition() : Promise.resolve(null),
      ]);
      if (signedIn && attempts.scope === "account") storage.replaceHistory(attempts);
      else for (const attempt of attempts) storage.upsertAttempt(attempt);
      this.synced = true;
      this.refresh();
      if (notify) wx.showToast({ title: attempts.length ? "已同步最新成绩" : "已是最新", icon: "none" });
    } catch (error) {
      if (notify) wx.showToast({ title: error.message, icon: "none" });
    } finally {
      this.setData({ syncing: false });
    }
  },

  async refreshProfile() {
    try {
      const saved = await profile.read();
      if (!saved) return;
      this.setData({
        name: storage.name(),
        avatar: profile.avatarUrl(saved.avatarId, saved.avatarUrl),
        hasWechatProfile: storage.hasWechatProfile(),
      });
    } catch {
      // 本机已有昵称和头像时，网络失败不影响记录页。
    }
  },

  async refreshCredits({ skipProfile = false } = {}) {
    try {
      const cap = await credits.capabilities().catch(() => ({ login: false }));
      const loginOpen = Boolean(cap?.login);
      if (!credits.hasSession() && loginOpen) {
        await cloudSync.ensureSession();
      }
      if (!credits.hasSession()) {
        this.setData({
          creditSignedIn: false,
          creditLoginOpen: loginOpen,
          creditUid: 0,
          creditBalance: 0,
          creditHeld: 0,
        });
        return;
      }
      const wallet = await credits.wallet(0);
      this.setData({
        creditSignedIn: true,
        creditLoginOpen: loginOpen,
        creditUid: wallet.uid || credits.uid() || 0,
        creditBalance: wallet.balance,
        creditHeld: wallet.held,
      });
      if (!skipProfile) this.refreshProfile();
    } catch {
      this.setData({ creditSignedIn: false });
    }
  },

  copyUid() {
    if (!this.data.creditUid) return;
    const text = String(this.data.creditUid);
    require("../../utils/clipboard.js").copyText(this, text, `已复制 UID ${text}`);
  },

  applyFilter() {
    const { tab, keyword } = this.data;
    const key = String(keyword || "").trim().toLowerCase();
    const { records, drafts } = this.data;
    const items = tab === "draft" ? drafts : tab === "done" ? records : [...drafts, ...records];
    const visible = items.filter(record => !key || [record.title, record.publisher, record.edition, record.paper].join(" ").toLowerCase().includes(key));
    this.setData({ visible });
  },

  setTab(event) {
    this.setData({ tab: event.currentTarget.dataset.key });
    this.applyFilter();
  },

  toggleSearch() {
    const searching = !this.data.searching;
    this.setData({ searching, keyword: searching ? this.data.keyword : "" });
    if (!searching) this.applyFilter();
  },

  onKeyword(event) {
    this.setData({ keyword: event.detail.value });
    this.applyFilter();
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
    if (this.data.positionOpen || event.target?.dataset?.swipeIgnore) return;
    const point = event.touches?.[0];
    if (!point || event.touches.length > 1) {
      this.tabSwipeSession = null;
      return;
    }
    this.tabSwipeMoved = false;
    clearTimeout(this.tabSwipeClickTimer);
    const width = (wx.getWindowInfo && wx.getWindowInfo().windowWidth) || 375;
    this.tabSwipeSession = tabSwipe.createSwipeSession({
      currentKey: "records",
      x: point.clientX,
      y: point.clientY,
      now: Date.now(),
      width,
    });
  },

  moveTabSwipe(event) {
    if (!this.tabSwipeSession || this.data.positionOpen) return;
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
    if (!session || this.data.positionOpen) {
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

  openRecord(event) {
    if (this.tabSwipeMoved) return;
    const record = this.data.visible[event.currentTarget.dataset.index];
    const url = record.draft
      ? "/pages/practice/practice?versionId=" + encodeURIComponent(record.versionId) + "&attemptId=" + encodeURIComponent(record.id)
      : "/pages/report/report?attemptId=" + encodeURIComponent(record.id);
    wx.navigateTo({ url });
  },

  openPosition() {
    if (this.tabSwipeMoved) return;
    this.setData({ positionOpen: true });
  },

  closePosition() {
    this.setData({ positionOpen: false });
  },

  selectPosition(event) {
    this.setData({ position: event.detail.position || null, positionOpen: false });
  },

  openAnalytics() {
    if (this.tabSwipeMoved) return;
    wx.navigateTo({ url: "/pages/analytics/analytics" });
  },

  openProfile() {
    if (this.tabSwipeMoved) return;
    wx.navigateTo({ url: "/pages/profile/profile" });
  },

  openProfileSheet() {
    if (this.tabSwipeMoved) return;
    this.setData({ profileSheetOpen: true });
  },

  closeProfileSheet() {
    this.setData({ profileSheetOpen: false });
  },

  onProfileSaved() {
    this.setData({
      profileSheetOpen: false,
      name: storage.name(),
      avatar: profile.avatarUrl(),
      defaultAvatar: profile.defaultAvatar(),
      hasWechatProfile: storage.hasWechatProfile(),
    });
  },

  openCredits() {
    if (this.tabSwipeMoved) return;
    wx.navigateTo({ url: "/pages/credits/credits" });
  },

  async refreshFeedbackBadge() {
    try {
      const res = await api.request("feedback/mine?guestId=" + encodeURIComponent(storage.guestId()));
      const seenAt = Number(wx.getStorageSync(FEEDBACK_SEEN_KEY) || 0);
      const feedbackHasReply = Number(res?.latestReplyAt || 0) > seenAt;
      if (feedbackHasReply !== this.data.feedbackHasReply) {
        this.setData({ feedbackHasReply });
      }
    } catch {
      // 网络失败不影响记录页展示。
    }
  },

  openFeedback() {
    if (this.tabSwipeMoved) return;
    const tab = this.data.feedbackHasReply ? "?tab=mine" : "";
    wx.navigateTo({ url: "/pages/feedback/feedback" + tab });
  },
});
