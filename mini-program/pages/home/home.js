const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const catalogUtil = require("../../utils/catalog.js");
const { ASSET } = require("../../config.js");

Page({
  data: {
    safeTop: 20,
    loading: true,
    error: "",
    institutions: [],
    recent: [],
    asset: ASSET,
    uiBase: "/assets/ui",
    name: "卷友",
  },

  onLoad() {
    this.setData({ safeTop: getApp().safeTop() });
    this.load();
  },

  onShow() {
    this.setData({ name: storage.name() });
    // 从练习返回时刷新最近记录，不重新拉取目录缓存。
    this.refreshRecent();
  },

  onPullDownRefresh() {
    this.load(true).finally(() => wx.stopPullDownRefresh());
  },

  async load(force) {
    this.setData({ loading: !this.data.institutions.length, error: "" });
    try {
      const versions = await api.catalog(force);
      getApp().globalData.versions = versions;
      this.setData({ institutions: catalogUtil.groupByInstitution(versions), loading: false });
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
        detail: draft.identity || "",
        progress: `${draft.answered || 0} / ${draft.questionCount || 0}`,
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
        scoreText: (record.totalCents / 100).toFixed(2),
        detail: [record.institution, record.period].filter(Boolean).join(" · "),
      });
      if (recent.length === 3) break;
    }
    this.setData({ recent });
  },

  openInstitution(event) {
    const { name } = event.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/catalog/catalog?institution=${encodeURIComponent(name)}` });
  },

  openRecent(event) {
    const { id, draft, version } = event.currentTarget.dataset;
    if (draft) {
      wx.navigateTo({ url: `/pages/practice/practice?versionId=${version}&attemptId=${id}` });
      return;
    }
    wx.navigateTo({ url: `/pages/report/report?attemptId=${id}` });
  },

  openTimer() {
    wx.navigateTo({ url: "/pages/timer/timer" });
  },

  openRecords() {
    wx.switchTab({ url: "/pages/records/records" });
  },
});
