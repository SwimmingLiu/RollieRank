const api = require("../../services/api.js");
const cloudSync = require("../../services/cloud-sync.js");
const storage = require("../../utils/storage.js");
const format = require("../../utils/format.js");
const catalog = require("../../utils/catalog.js");
const shareUtil = require("../../utils/share.js");
const { ASSET } = require("../../config.js");
const { reportBands, buildComparison } = require("../../utils/report.js");
const { createPageSheetDrag } = require("../../utils/sheet-gesture.js");
const { formatElapsed } = require("../../vendor/practice-timer.js");

Page({
  data: {
    loading: true,
    refreshing: false,
    error: "",
    summary: null,
    publicView: false,
    bands: [],
    shownBands: [],
    showBands: false,
    comparison: null,
    vsOpen: false,
    sheetDragY: 0,
    sheetDragging: false,
    sheetClosing: false,
    sheetShadeOpacity: 1,
    standing: null,
    correctionNotice: null,
    commentCount: null,
    timing: null,
    timingOpen: false,
    referralRewardText: "",
    uiBase: "/assets/ui",
  },

  onLoad(query) {
    this.sheetDrag = createPageSheetDrag(this, { onDismiss: () => this.closeVsDetail() });
    this.attemptId = query.attemptId || "";
    const cachedRef = shareUtil.cachedReferralState();
    if (cachedRef.rewardText) this.setData({ referralRewardText: cachedRef.rewardText });
    this.refreshReferral();
    // 从同卷榜进入时只读展示他人公开的分数与题型，不加载其答卷。
    this.publicId = query.publicId || "";
    this.paperId = decodeURIComponent(query.paperId || "");
    this.scope = query.scope || "nationwide";
    this.positionId = decodeURIComponent(query.positionId || "");
    if (this.publicId) {
      this.setData({ publicView: true });
      this.loadPublic();
    } else {
      this.load();
    }
  },

  async loadPublic() {
    this.setData({ loading: true, error: "" });
    try {
      const position = this.positionId ? "&positionId=" + encodeURIComponent(this.positionId) : "";
      const query = `publicId=${encodeURIComponent(this.publicId)}&versionId=${encodeURIComponent(this.paperId)}&guestId=${encodeURIComponent(storage.guestId())}&scope=${encodeURIComponent(this.scope)}${position}`;
      const result = await api.request(`positions/public-result?${query}`);
      const person = result.result;
      this.setData({
        loading: false,
        publicView: true,
        summary: {
          title: person ? "公开成绩" : "",
          identity: [result.position && result.position.label, result.scope === "nationwide" ? "全国范围" : "岗位范围"].filter(Boolean).join(" · "),
          score: format.scoreCard(person.totalCents),
          max: format.score(person.maxCents),
          correct: "--",
          wrong: "--",
          rate: format.percent(person.rate),
          createdAt: format.dateTime(result.asOf),
          name: person.name,
          weak: [],
        },
      });
      this.setBands(person.subjects || []);
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  onShow() {
    // 审核订正后的成绩以服务端为准；每次回到报告都重新同步一次。
    if (this.attempt) this.sync();
    this.refreshReferral();
  },

  async refreshReferral() {
    const state = await shareUtil.syncReferral();
    if (state.rewardText !== this.data.referralRewardText) {
      this.setData({ referralRewardText: state.rewardText });
    }
  },

  onRefresherRefresh() {
    this.setData({ refreshing: true });
    (this.publicId ? this.loadPublic() : this.load()).finally(() => this.setData({ refreshing: false }));
  },

  syncIds() {
    const local = storage.getAttempt(this.attemptId);
    const others = local
      ? storage.history()
          .filter(item => item.id !== this.attemptId && (local.paperId && item.paperId ? item.paperId === local.paperId : item.versionId === local.versionId))
          .slice(0, 6)
          .map(item => item.id)
      : [];
    return [this.attemptId, ...others];
  },

  async load() {
    this.setData({ loading: true, error: "" });
    try {
      await cloudSync.ensureSession();
      const attempts = await api.sync(this.syncIds());
      attempts.forEach(item => storage.upsertAttempt(item));
      const attempt = attempts.find(item => item.id === this.attemptId) || attempts[0];
      if (!attempt) throw new Error("这份成绩不在当前身份下，请回到练习记录查看。");
      this.apply(attempt);
      this.refreshExtras(attempt);
    } catch (error) {
      const local = storage.getAttempt(this.attemptId);
      if (local) {
        // 网络不可用时仍展示本机快照，并说明不是最新结果。
        this.applyLocal(local);
        wx.showToast({ title: "离线：显示本机成绩", icon: "none" });
      } else {
        this.setData({ loading: false, error: error.message });
      }
    }
  },

  async sync() {
    if (this.publicId) return;
    try {
      const attempts = await api.sync(this.syncIds());
      attempts.forEach(item => storage.upsertAttempt(item));
      const attempt = attempts.find(item => item.id === this.attemptId) || attempts[0];
      if (attempt) {
        this.apply(attempt);
        this.refreshExtras(attempt);
      }
    } catch {
      // 静默失败：成绩已在本机，联网后再次进入即可更新。
    }
  },

  apply(attempt) {
    this.attempt = attempt;
    const report = attempt.report;
    const timing = attempt.timing;
    const version = getApp().globalData.versions.find(item => item.id === attempt.versionId);
    const comparison = this.publicId ? null : buildComparison(attempt, storage.history());
    if (attempt.paperTitle) {
      wx.setNavigationBarTitle?.({ title: `${attempt.paperTitle}估分报告 · 卷卷小榜` });
    }
    this.setData({
      loading: false,
      error: "",
      comparison,
      summary: {
        id: attempt.id,
        versionId: attempt.versionId,
        title: attempt.paperTitle,
        identity: catalog.attemptIdentity(version, attempt),
        score: format.scoreCard(report.totalCents),
        max: format.score(report.maxCents),
        correct: report.correct,
        wrong: report.wrong,
        blank: report.blank,
        rate: format.percent(report.rate),
        createdAt: format.dateTime(attempt.createdAt),
        answerRevision: attempt.answerRevision || 0,
      },
      timing: timing && timing.actualMs != null ? {
        actual: formatElapsed(timing.actualMs),
        planned: timing.plannedMs / 60000,
        entry: formatElapsed(timing.entryMs || 0),
        modules: (timing.modules || []).map(module => ({
          id: module.id, name: module.name, planned: module.plannedMs / 60000,
          actual: formatElapsed(module.actualMs),
          difference: (module.actualMs > module.plannedMs ? "+" : "−") + formatElapsed(Math.abs(module.actualMs - module.plannedMs)),
        })),
      } : null,
    });
    this.setBands(report.breakdown);
  },

  setBands(parts) {
    const bands = reportBands(parts);
    this.setData({ bands, shownBands: this.data.showBands ? bands : bands.slice(0, 2) });
  },

  refreshExtras(attempt) {
    this.loadStanding(attempt.versionId);
    this.loadCorrectionNotice();
    this.loadComments(attempt);
  },

  async loadComments(attempt) {
    try {
      const query = "paperId=" + encodeURIComponent(attempt.paperId) +
        "&attemptId=" + encodeURIComponent(attempt.id) + "&guestId=" + encodeURIComponent(storage.guestId());
      const result = await api.request("discussions?" + query);
      this.setData({ commentCount: result.total });
    } catch {
      this.setData({ commentCount: null });
    }
  },

  toggleTiming() {
    this.setData({ timingOpen: !this.data.timingOpen });
  },

  async loadCorrectionNotice() {
    if (this.publicId || !this.attemptId) return;
    try {
      const result = await api.request("corrections/list", { guestId: storage.guestId() });
      const notices = (result.notifications || [])
        .filter(notice => notice.attemptId === this.attemptId)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const notice = notices[0];
      this.setData({
        correctionNotice: notice ? {
          ...notice,
          beforeText: format.scoreCard(notice.before.totalCents),
          afterText: format.scoreCard(notice.after.totalCents),
          deltaText: notice.deltaCents === 0 ? "不变" : `${notice.deltaCents > 0 ? "+" : "−"}${format.scoreCard(Math.abs(notice.deltaCents))}`,
          deltaTone: notice.deltaCents > 0 ? "up" : notice.deltaCents < 0 ? "down" : "same",
        } : null,
      });
    } catch {
      // 报告主体优先；审核通知稍后回到页面时会再次读取。
    }
  },

  showCorrectionNotice() {
    const notice = this.data.correctionNotice;
    if (!notice) return;
    const changes = notice.changes.map(change => `第 ${change.question} 题 ${change.beforeAnswer} → ${change.afterAnswer}`).join("\n");
    wx.showModal({
      title: "标准答案已订正",
      content: `${changes}\n\n这份答卷 ${notice.beforeText} → ${notice.afterText} 分（${notice.deltaText} 分）\n${notice.reason}`,
      showCancel: false,
      confirmText: "知道了",
    });
  },

  toggleBands() {
    const showBands = !this.data.showBands;
    this.setData({ showBands, shownBands: showBands ? this.data.bands : this.data.bands.slice(0, 2) });
  },

  async loadStanding(versionId) {
    try {
      const result = await api.request("positions/leaderboard?versionId=" + encodeURIComponent(versionId) + "&guestId=" + encodeURIComponent(storage.guestId()) + "&scope=nationwide");
      this.setData({ standing: { rank: result.self?.rank, count: result.count } });
    } catch {
      this.setData({ standing: null });
    }
  },

  applyLocal(record) {
    const report = {
      totalCents: record.totalCents,
      maxCents: record.maxCents,
      correct: record.correct,
      wrong: record.wrong,
      blank: record.blank,
      rate: record.rate,
      breakdown: record.subjects || [],
    };
    this.apply({ ...record, report, paperTitle: record.title, answerRevision: 0 });
  },

  retry() {
    if (this.publicId) this.loadPublic();
    else this.load();
  },

  review() {
    if (this.data.publicView) {
      wx.showToast({ title: "他人的逐题答案不公开", icon: "none" });
      return;
    }
    wx.navigateTo({ url: "/pages/review/review?attemptId=" + this.attemptId + (this.data.summary?.wrong ? "&filter=wrong" : "") });
  },

  reviewBand(event) {
    if (!this.data.publicView) wx.navigateTo({ url: "/pages/review/review?attemptId=" + this.attemptId + "&type=" + encodeURIComponent(event.currentTarget.dataset.type) });
  },

  rank() {
    wx.navigateTo({ url: `/pages/rank/rank?attemptId=${this.attemptId}` });
  },

  discuss() {
    const attempt = this.attempt;
    if (!attempt) return;
    wx.navigateTo({ url: `/pages/discussion/discussion?paperId=${attempt.paperId}&attemptId=${attempt.id}&title=${encodeURIComponent(attempt.paperTitle)}` });
  },

  share() {
    wx.navigateTo({ url: `/pages/share/share?attemptId=${this.attemptId}` });
  },

  openVsDetail() {
    if (!this.data.comparison) return;
    this.sheetDrag?.reset();
    this._sheetScrollTop = 0;
    this.setData({ vsOpen: true });
  },

  closeVsDetail() {
    this.sheetDrag?.reset();
    this._sheetScrollTop = 0;
    this.setData({ vsOpen: false });
  },

  noopSheet() {},
  onSheetScroll(event) { this.sheetDrag?.onScroll(event); },
  startSheetDrag(event) { this.sheetDrag?.start(event); },
  moveSheetDrag(event) { this.sheetDrag?.move(event); },
  endSheetDrag(event) { this.sheetDrag?.end(event); },
  cancelSheetDrag() { this.sheetDrag?.cancel(); },

  onUnload() {
    this.sheetDrag?.reset();
  },

  openPrevious() {
    const id = this.data.comparison?.previousId;
    if (!id) return;
    this.setData({ vsOpen: false });
    wx.navigateTo({ url: `/pages/report/report?attemptId=${id}` });
  },

  openAnalytics() {
    this.setData({ vsOpen: false });
    wx.navigateTo({ url: "/pages/analytics/analytics" });
  },

  practiceAgain() {
    if (!this.data.summary || this.data.publicView) return;
    wx.navigateTo({ url: `/pages/practice/practice?versionId=${this.data.summary.versionId}` });
  },

  onShareAppMessage() {
    const summary = this.data.summary;
    const versionId = summary?.versionId || this.paperId || "";
    const title = summary?.title
      ? `${summary.title}估分同卷榜 · 卷卷小榜`
      : "卷卷小榜 · 行测估分与同卷排名";
    // 转发指向公开同卷榜，不暴露个人逐题答案。
    const path = shareUtil.withReferralPath(
      versionId ? `/pages/rank/rank?versionId=${encodeURIComponent(versionId)}` : "/pages/home/home",
    );
    return { title, path, imageUrl: ASSET.logo };
  },

  onShareTimeline() {
    const summary = this.data.summary;
    const versionId = summary?.versionId || this.paperId || "";
    return {
      title: summary?.title ? `${summary.title}估分同卷榜 · 卷卷小榜` : "卷卷小榜 · 行测估分与同卷排名",
      query: shareUtil.withReferralQuery(versionId ? `versionId=${encodeURIComponent(versionId)}` : ""),
      imageUrl: ASSET.logo,
    };
  },
});
