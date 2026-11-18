const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const format = require("../../utils/format.js");
const { ASSET } = require("../../config.js");

const TABS = [
  { key: "all", label: "全部" },
  { key: "done", label: "已完成" },
  { key: "draft", label: "录入中" },
];

Page({
  data: {
    name: "卷友",
    position: null,
    records: [],
    drafts: [],
    tab: "all",
    tabs: TABS,
    totals: { count: 0, best: "--", average: "--" },
    loading: true,
    syncing: false,
    asset: ASSET,
    uiBase: "/assets/ui",
    keyword: "",
    searching: false,
    visible: [],
  },

  onShow() {
    this.refresh();
    if (!this.synced) {
      this.synced = true;
      this.sync();
    }
  },

  onPullDownRefresh() {
    this.sync(true).finally(() => wx.stopPullDownRefresh());
  },

  // 先展示本机记录，再向服务端同步订正后的成绩；离线也不丢历史。
  refresh() {
    const history = storage.history();
    const position = storage.position();
    const draftIds = [];
    const records = history.map(record => ({
      ...record,
      scoreText: format.score(record.totalCents),
      dateText: format.dateTime(record.createdAt),
      detail: [record.institution, record.period].filter(Boolean).join(" · "),
      rateText: format.percent(record.rate),
    }));
    let draftCount = 0;
    try {
      draftCount = wx.getStorageInfoSync().keys.filter(key => key.startsWith("rr:draft:")).length;
    } catch {
      draftCount = 0;
    }
    const average = records.length
      ? records.reduce((sum, record) => sum + (record.maxCents ? record.totalCents / record.maxCents : 0), 0) / records.length
      : null;
    const best = records.reduce((top, record) => (top && top.rate >= (record.rate || 0) ? top : record), null);
    this.setData({
      loading: false,
      name: storage.name(),
      position: position ? { id: position.id, label: position.label || position.title } : null,
      records,
      drafts: draftCount ? [{ id: "drafts", count: draftCount }] : [],
      totals: {
        count: records.length,
        best: best ? format.score(best.totalCents) : "--",
        average: average === null ? "--" : format.percent(average),
      },
    });
    this.applyFilter();
  },

  async sync(notify) {
    if (this.data.syncing) return;
    this.setData({ syncing: true });
    try {
      const attempts = await api.sync();
      for (const attempt of attempts) storage.upsertAttempt(attempt);
      if (attempts.length) this.refresh();
      if (notify) wx.showToast({ title: attempts.length ? "已同步最新成绩" : "已是最新", icon: "none" });
    } catch (error) {
      if (notify) wx.showToast({ title: error.message, icon: "none" });
    } finally {
      this.setData({ syncing: false });
    }
  },

  applyFilter() {
    const { tab, keyword } = this.data;
    const key = String(keyword || "").trim().toLowerCase();
    const records = this.data.records.filter(record => {
      if (tab === "draft") return false;
      if (key && !`${record.title} ${record.institution} ${record.period}`.toLowerCase().includes(key)) return false;
      return true;
    });
    this.setData({ visible: records });
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

  openRecord(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/report/report?attemptId=${id}` });
  },

  openPosition() {
    wx.navigateTo({ url: "/pages/positions/positions" });
  },

  openAnalytics() {
    wx.navigateTo({ url: "/pages/analytics/analytics" });
  },

  openSettings() {
    wx.navigateTo({ url: "/pages/settings/settings" });
  },

  openHome() {
    wx.switchTab({ url: "/pages/home/home" });
  },
});
