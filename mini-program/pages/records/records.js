const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const format = require("../../utils/format.js");
const { publisherName, periodLabel, LOGO } = require("../../utils/catalog.js");
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
    const versions = getApp().globalData.versions;
    const withIdentity = record => {
      const version = versions.find(item => item.id === record.versionId) || record;
      const institution = version.institution || record.identity?.split(" · ")[0] || "";
      const year = String(version.project || record.identity || "").match(/20\d{2}/)?.[0] || "";
      const number = version.number || record.title?.match(/第\s*(\d+)\s*套/)?.[1];
      return {
        ...record,
        publisher: publisherName(institution),
        logo: ASSET[LOGO[institution === "花生" ? "四海" : institution]] || "",
        edition: [year, periodLabel(version.period)].filter(Boolean).join(" · "),
        paper: number ? String(number).padStart(2, "0") + "套" : record.title,
        scoreText: format.score(record.totalCents),
        progress: record.questionCount ? record.answered / record.questionCount * 100 : 0,
      };
    };
    const records = history.map(withIdentity);
    const drafts = Object.values(storage.draftIndex()).map(draft => withIdentity({ ...draft, draft: true }));
    this.setData({
      loading: false,
      name: storage.name(),
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
    const { records, drafts } = this.data;
    const items = tab === "draft" ? drafts : tab === "done" ? records : [...drafts, ...records];
    const visible = items.filter(record => !key || [record.title, record.publisher, record.edition].join(" ").toLowerCase().includes(key));
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

  openRecord(event) {
    const record = this.data.visible[event.currentTarget.dataset.index];
    const url = record.draft
      ? "/pages/practice/practice?versionId=" + encodeURIComponent(record.versionId) + "&attemptId=" + encodeURIComponent(record.id)
      : "/pages/report/report?attemptId=" + encodeURIComponent(record.id);
    wx.navigateTo({ url });
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
