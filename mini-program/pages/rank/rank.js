const api = require("../../services/api");
const storage = require("../../utils/storage");
const format = require("../../utils/format");
const { ASSET_BASE } = require("../../config");

const SCOPES = [
  { key: "national", label: "全国" },
  { key: "position", label: "岗位" },
];

Page({
  data: {
    loading: true,
    error: "",
    rows: [],
    self: null,
    count: 0,
    scope: "national",
    scopes: SCOPES,
    position: null,
    dimension: "total",
    dimensions: [{ key: "total", label: "总分" }],
    assetBase: ASSET_BASE,
  },

  onLoad(query) {
    this.attemptId = query.attemptId || "";
    this.load();
  },

  async load() {
    this.setData({ loading: true, error: "" });
    try {
      const attempts = await api.sync([this.attemptId]);
      const attempt = attempts[0];
      if (!attempt) throw new Error("这份成绩不在当前身份下。");
      this.versionId = attempt.versionId;
      this.paperId = attempt.paperId;
      const subjects = (attempt.report && attempt.report.breakdown) || [];
      this.setData({
        dimensions: [{ key: "total", label: "总分" },
          ...subjects.filter(type => type.maxCents > 0).map(type => ({ key: type.id, label: type.name }))],
      });
      const position = storage.position();
      this.setData({
        position: position ? { id: position.id, label: position.label || position.title } : null,
        scope: position ? "position" : "national",
      });
      await this.fetchRanking();
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  // 榜单范围与题型维度都由服务端按同一答案版本计算，前端只做展示。
  async fetchRanking() {
    // 服务端按 versionId 选择范围：selected 跟随本人已选岗位，nationwide 为全国。
    const query = [
      `versionId=${encodeURIComponent(this.versionId)}`,
      `guestId=${encodeURIComponent(storage.guestId())}`,
      `scope=${this.data.scope === "position" ? "selected" : "nationwide"}`,
      `dimension=${encodeURIComponent(this.data.dimension)}`,
    ].join("&");
    try {
      const result = await api.request(`positions/leaderboard?${query}`);
      const rows = (result.rows || []).map(row => ({
        ...row,
        scoreText: format.score(row.value),
        rateText: format.percent(row.rate),
        surpassed: format.percent((row.surpassedPercent || 0) / 100),
        medal: row.rank <= 3 ? `rank-${row.rank}` : "",
      }));
      const dimensionKey = result.dimension || this.data.dimension;
      this.setData({
        loading: false,
        error: "",
        dimension: dimensionKey,
        rows,
        self: result.self ? { ...result.self, scoreText: format.score(result.self.value) } : null,
        count: result.count || 0,
        position: result.position ? { id: result.position.id || "", label: result.position.label || result.position.title } : null,
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  setScope(event) {
    const { key } = event.currentTarget.dataset;
    if (key === "position" && !this.data.position) {
      wx.showToast({ title: "先选择报考岗位", icon: "none" });
      wx.navigateTo({ url: "/pages/positions/positions?from=rank" });
      return;
    }
    this.setData({ scope: key });
    this.fetchRanking();
  },

  setDimension(event) {
    const { key } = event.currentTarget.dataset;
    if (key === this.data.dimension) return;
    this.setData({ dimension: key });
    this.fetchRanking();
  },

  help() {
    wx.showModal({
      title: "同卷榜口径",
      content: "只统计同一份卷、同一答案版本的完整答卷，每人取最好一次；总分按本卷分值计算，可选择全国或个人岗位范围。",
      showCancel: false,
    });
  },

  openResult(event) {
    // 公开详情只显示昵称与分数，别人的答案不会公开。
    const { id } = event.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({ url: `/pages/report/report?publicId=${id}&paperId=${this.paperId}` });
  },

  pickPosition() {
    wx.navigateTo({ url: "/pages/positions/positions?from=rank" });
  },

  onShow() {
    // 从选岗页返回时按新岗位刷新，保留当前成绩。
    if (!this.versionId) return;
    if (!this.ready) { this.ready = true; return; }
    const position = storage.position();
    const id = position ? position.id : "";
    const current = this.data.position ? this.data.position.id : "";
    if (id !== current && this.loaded !== false) {
      this.setData({
        position: position ? { id: position.id, label: position.label || position.title } : null,
        scope: position ? "position" : "national",
      });
      this.fetchRanking();
    }
    this.loaded = true;
  },
});
