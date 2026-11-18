const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const format = require("../../utils/format.js");
const { reportBands } = require("../../utils/report.js");

Page({
  data: {
    loading: true,
    error: "",
    summary: null,
    publicView: false,
    bands: [],
    shownBands: [],
    showBands: false,
    standing: null,
    uiBase: "/assets/ui",
  },

  onLoad(query) {
    this.attemptId = query.attemptId || "";
    // 从同卷榜进入时只读展示他人公开的分数与题型，不加载其答卷。
    this.publicId = query.publicId || "";
    this.paperId = query.paperId || "";
    if (this.publicId) this.loadPublic();
    else this.load();
  },

  async loadPublic() {
    this.setData({ loading: true, error: "" });
    try {
      const query = `publicId=${encodeURIComponent(this.publicId)}&versionId=${encodeURIComponent(this.paperId)}&guestId=${encodeURIComponent(storage.guestId())}&scope=nationwide`;
      const result = await api.request(`positions/public-result?${query}`);
      const person = result.result;
      this.setData({
        loading: false,
        publicView: true,
        summary: {
          title: person ? "公开成绩" : "",
          identity: [result.position && result.position.label, result.scope === "nationwide" ? "全国范围" : "岗位范围"].filter(Boolean).join(" · "),
          score: format.score(person.totalCents),
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
  },

  onPullDownRefresh() {
    (this.publicId ? this.loadPublic() : this.load()).finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ loading: true, error: "" });
    try {
      const attempts = await api.sync([this.attemptId]);
      const attempt = attempts[0];
      if (!attempt) throw new Error("这份成绩不在当前身份下，请回到练习记录查看。");
      storage.upsertAttempt(attempt);
      this.apply(attempt);
      this.loadStanding(attempt.versionId);
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
      const attempts = await api.sync([this.attemptId]);
      if (attempts[0]) {
        storage.upsertAttempt(attempts[0]);
        this.apply(attempts[0]);
      }
    } catch {
      // 静默失败：成绩已在本机，联网后再次进入即可更新。
    }
  },

  apply(attempt) {
    this.attempt = attempt;
    const report = attempt.report;
    this.setData({
      loading: false,
      error: "",
      summary: {
        id: attempt.id,
        versionId: attempt.versionId,
        title: attempt.paperTitle,
        identity: [attempt.institution, attempt.period, attempt.variant].filter(Boolean).join(" · "),
        score: format.score(report.totalCents),
        max: format.score(report.maxCents),
        correct: report.correct,
        wrong: report.wrong,
        blank: report.blank,
        rate: format.percent(report.rate),
        createdAt: format.dateTime(attempt.createdAt),
        timing: attempt.timing && attempt.timing.solvingMs ? format.minutes(attempt.timing.solvingMs) : "",
        answerRevision: attempt.answerRevision || 0,
      },
    });
    this.setBands(report.breakdown);
  },

  setBands(parts) {
    const bands = reportBands(parts);
    this.setData({ bands, shownBands: this.data.showBands ? bands : bands.slice(0, 2) });
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

  practiceAgain() {
    if (!this.data.summary || this.data.publicView) return;
    wx.navigateTo({ url: `/pages/practice/practice?versionId=${this.data.summary.versionId}` });
  },
});
