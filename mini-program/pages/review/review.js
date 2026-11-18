const api = require("../../services/api");
const format = require("../../utils/format");

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "wrong", label: "错误" },
  { key: "blank", label: "未答" },
];

Page({
  data: {
    loading: true,
    error: "",
    rows: [],
    filters: FILTERS,
    filter: "all",
    types: [],
    activeType: "",
    wrongCount: 0,
    uiBase: "/assets/ui",
  },

  onLoad(query) {
    this.attemptId = query.attemptId || "";
    this.load();
  },

  async load() {
    try {
      const attempts = await api.sync([this.attemptId]);
      const attempt = attempts[0];
      if (!attempt) throw new Error("这份成绩不在当前身份下。");
      this.all = attempt.report.rows.map(row => ({
        n: row.question,
        type: row.type,
        answer: row.answer || "—",
        ref: row.correctAnswer,
        status: row.status,
        statusLabel: format.STATUS_LABEL[row.status],
        cents: (row.cents / 100).toFixed(2),
      }));
      const types = [];
      for (const row of this.all) if (!types.includes(row.type)) types.push(row.type);
      this.setData({
        loading: false,
        error: "",
        types: [{ key: "", label: "全部题型" }, ...types.map(type => ({ key: type, label: type }))],
        wrongCount: this.all.filter(row => row.status !== "correct").length,
      });
      this.apply();
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  apply() {
    const { filter, activeType } = this.data;
    const rows = (this.all || []).filter(row => {
      if (filter === "wrong" && row.status !== "wrong") return false;
      if (filter === "blank" && row.status !== "blank") return false;
      if (activeType && row.type !== activeType) return false;
      return true;
    });
    this.setData({ rows });
  },

  setFilter(event) {
    const { key } = event.currentTarget.dataset;
    this.setData({ filter: key });
    this.apply();
  },

  setType(event) {
    const { key } = event.currentTarget.dataset;
    this.setData({ activeType: key });
    this.apply();
  },

  copyWrong() {
    const numbers = this.data.rows.filter(row => row.status !== "correct").map(row => row.n);
    if (!numbers.length) {
      wx.showToast({ title: "当前筛选没有错题", icon: "none" });
      return;
    }
    wx.setClipboardData({ data: numbers.join(",") });
  },
});
