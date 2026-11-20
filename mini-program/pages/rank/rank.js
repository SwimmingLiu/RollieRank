const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const format = require("../../utils/format.js");

const { ASSET } = require("../../config.js");
const catalog = require("../../utils/catalog.js");
const { publisherName, subjectName, subjectId, LOGO } = catalog;

const SHORT_LABELS = { 政治理论: "政治", 常识判断: "常识", 言语理解: "言语", 数量关系: "数量", 资料分析: "资料" };

const SCOPES = [
  { key: "selected", name: "我的岗位", icon: "map-pin" },
  { key: "nationwide", name: "全国", icon: "globe" },
  { key: "position", name: "其他岗位", icon: "search" },
];

Page({
  data: {
    loading: true,
    error: "",
    winners: [],
    otherRows: [],
    publisher: "",
    identity: "",
    logo: "",
    self: null,
    count: 0,
    scope: "nationwide",
    scopes: SCOPES,
    positionMode: "",
    scopeLabel: "",
    canLoadMore: false,
    dimension: "total",
    dimensions: [{ key: "total", label: "总分" }],
    uiBase: "/assets/ui",
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
      const subjects = new Map();
      for (const type of attempt.report?.breakdown || []) {
        if (type.maxCents <= 0) continue;
        const name = subjectName(type.name);
        const key = subjectId(type.id, type.name);
        subjects.set(key, { key, label: SHORT_LABELS[name] || name });
      }
      // 身份行只写项目、期数和卷号；机构单独显示在左侧，不再重复。
      let version = null;
      try {
        version = (await api.catalog()).find(item => item.id === attempt.versionId) || null;
      } catch {
        // 目录读不到时退回答卷自带的字段。
      }
      this.setData({
        publisher: publisherName(attempt.institution),
        logo: ASSET[LOGO[attempt.institution]] || "",
        identity: catalog.attemptIdentity(version, attempt).split(" · ").slice(1).join(" · "),
        dimensions: [{ key: "total", label: "总分" }, ...subjects.values()],
      });
      this.setData({ scope: storage.position()?.id ? "selected" : "nationwide" });
      await this.fetchRanking();
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  // 榜单范围与题型维度都由服务端按同一答案版本计算，前端只做展示。
  async fetchRanking(more = false) {
    const request = (this.rankingRequest || 0) + 1;
    this.rankingRequest = request;
    const { scope, dimension } = this.data;
    const query = [
      `versionId=${encodeURIComponent(this.versionId)}`,
      `guestId=${encodeURIComponent(storage.guestId())}`,
      `scope=${scope}`,
      `dimension=${encodeURIComponent(dimension)}`,
      `page=${more ? this.rankPage + 1 : 1}`,
      ...(scope === "position" ? ["positionId=" + encodeURIComponent(this.browsingPosition.id)] : []),
    ].join("&");
    try {
      const result = await api.request(`positions/leaderboard?${query}`);
      if (request !== this.rankingRequest) return;
      this.rankPage = result.page;
      const rows = (result.rows || []).map(row => ({
        ...row,
        scoreText: format.scoreCard(row.value),
        rateText: format.percent(row.rate),
        surpassed: format.percent((row.surpassedPercent || 0) / 100),
        rankText: String(row.rank).padStart(2, "0"),
        initials: Array.from(row.name || "卷友").slice(0, 2).join(""),
      }));
      const position = result.position;
      const winners = more ? this.data.winners : rows.slice(0, 3);
      const others = (more ? rows : rows.slice(3)).filter(row => !row.isMe);
      this.setData({
        loading: false,
        error: "",
        scope: scope === "selected" && !position ? "nationwide" : scope,
        dimension: result.dimension || dimension,
        winners,
        otherRows: more ? [...this.data.otherRows, ...others] : others,
        self: result.self && !winners.some(row => row.isMe) ? { ...result.self, scoreText: format.scoreCard(result.self.value) } : null,
        count: result.count || 0,
        scopeLabel: position ? position.label || [position.department, position.title].filter(Boolean).join(" · ") : "全国考生",
        canLoadMore: result.page < result.pages,
      });
    } catch (error) {
      if (request === this.rankingRequest) this.setData({ loading: false, error: error.message });
    }
  },

  setScope(event) {
    const { key } = event.currentTarget.dataset;
    if (key === "position" || (key === "selected" && !storage.position()?.id)) {
      this.setData({ positionMode: key === "position" ? "browse" : "select" });
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

  loadMore() {
    if (this.data.canLoadMore) this.fetchRanking(true);
  },

  closePosition() {
    this.setData({ positionMode: "" });
  },

  selectPosition(event) {
    const { position } = event.detail;
    const browsing = this.data.positionMode === "browse";
    if (browsing) this.browsingPosition = position;
    this.setData({ positionMode: "", scope: !position ? "nationwide" : browsing ? "position" : "selected" });
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
    const { scope } = this.data;
    const positionId = scope === "position" ? "&positionId=" + encodeURIComponent(this.browsingPosition.id) : "";
    wx.navigateTo({ url: `/pages/report/report?publicId=${id}&paperId=${encodeURIComponent(this.versionId)}&scope=${scope}${positionId}` });
  },

  onShow() {
    if (this.versionId) this.fetchRanking();
  },
});
