const api = require("../../services/api");
const storage = require("../../utils/storage");
const format = require("../../utils/format");
const { ASSET, ASSET_BASE } = require("../../config");

const SECTION_NAMES = ["政治理论", "常识判断", "言语理解", "数量关系", "判断推理", "资料分析"];

Page({
  data: {
    loading: true,
    error: "",
    summary: null,
    publicView: false,
    bands: [],
    asset: ASSET,
    assetBase: ASSET_BASE,
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
        bands: (person.subjects || []).map(subject => ({
          name: subject.name,
          earned: format.score(subject.centsEarned),
          max: format.score(subject.maxCents),
          pct: format.rate(subject.rate),
        })),
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  onShow() {
    // 审核订正后的成绩以服务端为准；每次回到报告都重新同步一次。
    if (this.attempt) this.sync();
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ loading: true, error: "" });
    try {
      const attempts = await api.sync([this.attemptId]);
      const attempt = attempts[0];
      if (!attempt) throw new Error("这份成绩不在当前身份下，请回到练习记录查看。");
      storage.upsertAttempt(attempt);
      this.apply(attempt);
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
    const weak = report.breakdown
      .map(type => ({ name: type.name, rate: type.maxCents ? type.centsEarned / type.maxCents : 0 }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 3);
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
        weak: weak.map(item => ({ name: item.name, rate: format.percent(item.rate) })),
      },
      bands: report.breakdown.map(type => ({
        name: type.name,
        earned: (type.centsEarned / 100).toFixed(1),
        max: (type.maxCents / 100).toFixed(1),
        pct: format.rate(type.maxCents ? type.centsEarned / type.maxCents : 0),
        label: SECTION_NAMES.includes(type.name) ? type.name : type.name,
      })),
    });
  },

  applyLocal(record) {
    const report = {
      totalCents: record.totalCents,
      maxCents: record.maxCents,
      correct: record.correct,
      wrong: record.wrong,
      blank: record.blank,
      rate: record.rate,
      breakdown: [],
    };
    this.apply({ ...record, report, paperTitle: record.title, answerRevision: 0 });
  },

  retry() {
    this.load();
  },

  review() {
    if (this.data.publicView) {
      wx.showToast({ title: "他人的逐题答案不公开", icon: "none" });
      return;
    }
    wx.navigateTo({ url: `/pages/review/review?attemptId=${this.attemptId}` });
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
    if (!this.data.summary) return;
    wx.redirectTo({ url: `/pages/practice/practice?versionId=${this.data.summary.versionId}` });
  },
});
