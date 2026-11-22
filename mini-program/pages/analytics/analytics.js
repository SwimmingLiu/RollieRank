const storage = require("../../utils/storage.js");
const format = require("../../utils/format.js");
const catalog = require("../../utils/catalog.js");
const { createPageSheetDrag } = require("../../utils/sheet-gesture.js");
const { ASSET } = require("../../config.js");

const CATEGORIES = [
  { key: "all", label: "行测整体" },
  { key: "city", label: "地市级" },
  { key: "provincial", label: "副省级" },
  { key: "custom", label: "其他卷型" },
];
const METRICS = [{ key: "rate", label: "得分率" }, { key: "score", label: "得分" }, { key: "accuracy", label: "正确率" }];
const PAGE_SIZE = 8;

function categoryOf(record) {
  const known = /国考|公考|公务员|联考/.test([record.project, record.title].join(" "));
  if (known && record.questionCount === 130) return "city";
  if (known && record.questionCount === 135) return "provincial";
  return "custom";
}

Page({
  data: {
    category: 0,
    categories: CATEGORIES,
    metric: "rate",
    metricLabel: METRICS[0].label,
    metrics: METRICS,
    points: [],
    pageRows: [],
    sources: [{ key: "all", label: "全部来源" }],
    source: "all",
    from: "",
    to: "",
    draftSource: "all",
    draftFrom: "",
    draftTo: "",
    filterOpen: false,
    activeFilters: 0,
    filterError: "",
    page: 0,
    pages: 1,
    rangeText: "",
    trendSrc: "",
    sheetDragY: 0,
    sheetDragging: false,
    sheetClosing: false,
    sheetShadeOpacity: 1,
    uiBase: "/assets/ui",
  },

  onLoad() {
    this.sheetDrag = createPageSheetDrag(this, { onDismiss: () => this.closeFilters() });
  },

  onUnload() {
    this.sheetDrag?.reset();
  },

  noopSheet() {},
  startSheetDrag(event) { this.sheetDrag?.start(event); },
  moveSheetDrag(event) { this.sheetDrag?.move(event); },
  endSheetDrag(event) { this.sheetDrag?.end(event); },
  cancelSheetDrag() { this.sheetDrag?.cancel(); },

  onShow() {
    this.build();
  },

  build() {
    const { category, metric, source, from, to } = this.data;
    const key = CATEGORIES[category].key;
    const history = storage.history();
    const sources = [...new Map(history.map(record => {
      const institution = record.institution || record.identity?.split(" · ")[0] || "";
      return [institution, { key: institution, label: catalog.publisherName(institution) }];
    }).filter(([key]) => key)).values()];
    const start = from ? new Date(from + "T00:00:00").getTime() : -Infinity;
    const end = to ? new Date(to + "T23:59:59.999").getTime() : Infinity;
    const points = history.filter(record => key === "all" || categoryOf(record) === key)
      .filter(record => source === "all" || (record.institution || record.identity?.split(" · ")[0]) === source)
      .filter(record => record.createdAt >= start && record.createdAt <= end)
      .slice().sort((a, b) => b.createdAt - a.createdAt).map(record => {
        const score = format.score(record.totalCents);
        const rate = format.percent(record.maxCents ? record.totalCents / record.maxCents : null);
        const accuracy = format.percent(record.questionCount ? record.correct / record.questionCount : null);
        const versions = getApp().globalData.versions || [];
        const version = versions.find(item => item.id === record.versionId);
        const card = catalog.paperCardParts({ ...(version || record), title: version?.title || record.title });
        const publisher = catalog.publisherName(record.institution || version?.institution || "");
        const label = [publisher, card.compactTitle].filter(Boolean).join(" · ") || record.title;
        return {
          id: record.id,
          label,
          logo: ASSET[catalog.LOGO[record.institution]] || "",
          dateText: format.dateTime(record.createdAt).slice(0, 10),
          score,
          max: format.score(record.maxCents),
          rate,
          accuracy,
          value: { rate, score, accuracy }[metric],
          trendValue: { rate: Number.parseFloat(rate), score: Number(score), accuracy: Number.parseFloat(accuracy) }[metric],
          trendMax: metric === "score" ? record.maxCents / 100 : 100,
        };
      });
    const pages = Math.max(1, Math.ceil(points.length / PAGE_SIZE));
    const page = Math.min(this.data.page, pages - 1);
    const pageRows = points.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const first = points.length ? page * PAGE_SIZE + 1 : 0;
    const last = Math.min(points.length, (page + 1) * PAGE_SIZE);
    this.setData({
      points, pageRows, pages, page, sources: [{ key: "all", label: "全部来源" }, ...sources],
      activeFilters: Number(source !== "all") + Number(Boolean(from || to)),
      rangeText: points.length > PAGE_SIZE ? first + "–" + last + " / " + points.length : points.length + " 次",
    }, () => this.drawTrend());
  },

  onResize() {
    this.drawTrend();
  },

  drawTrend() {
    const points = this.data.points.filter(point => Number.isFinite(point.trendValue)).slice().reverse();
    if (points.length < 2) {
      if (this.data.trendSrc) this.setData({ trendSrc: "" });
      return;
    }
    const ticket = (this.trendTicket || 0) + 1;
    this.trendTicket = ticket;
    const query = this.createSelectorQuery();
    query.select(".analytics__trend-wrap").boundingClientRect();
    query.select("#trend").fields({ node: true });
    query.exec(([box, field]) => {
      if (ticket !== this.trendTicket || !field?.node || !box?.width || !box?.height) return;
      const node = field.node;
      const width = Math.round(box.width);
      const height = Math.round(box.height);
      const dpr = wx.getWindowInfo?.().pixelRatio || 2;
      node.width = Math.round(width * dpr);
      node.height = Math.round(height * dpr);
      const ctx = node.getContext("2d");
      ctx.clearRect(0, 0, node.width, node.height);
      ctx.scale(dpr, dpr);
      const left = 34;
      const right = 14;
      const top = 14;
      const bottom = 22;
      const plotW = Math.max(10, width - left - right);
      const plotH = Math.max(10, height - top - bottom);
      const max = Math.max(1, ...points.map(point => point.trendMax));
      const unit = this.data.metric === "score" ? "" : "%";
      const map = points.map((point, index) => [
        left + plotW * index / (points.length - 1),
        top + plotH - plotH * point.trendValue / max,
      ]);
      ctx.strokeStyle = "#efe6d8";
      ctx.lineWidth = 1;
      ctx.font = "10px Nunito, sans-serif";
      ctx.fillStyle = "#9c8d77";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (const fraction of [0, .5, 1]) {
        const y = top + plotH * (1 - fraction);
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(width - right, y);
        ctx.stroke();
        ctx.fillText(Math.round(max * fraction) + unit, left - 6, y);
      }
      ctx.strokeStyle = "#b6874a";
      ctx.fillStyle = "#b6874a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(...map[0]);
      for (const point of map.slice(1)) ctx.lineTo(...point);
      ctx.stroke();
      for (const [x, y] of map) {
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fffdf8";
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.strokeStyle = "#b6874a";
        ctx.lineWidth = 2;
      }
      ctx.fillStyle = "#9c8d77";
      ctx.textBaseline = "bottom";
      ctx.textAlign = "left";
      ctx.fillText(points[0].dateText.slice(5), left, height - 2);
      ctx.textAlign = "right";
      ctx.fillText(points[points.length - 1].dateText.slice(5), width - right, height - 2);
      wx.canvasToTempFilePath({
        canvas: node,
        fileType: "png",
        destWidth: node.width,
        destHeight: node.height,
        success: result => {
          if (ticket === this.trendTicket) this.setData({ trendSrc: result.tempFilePath });
        },
      });
    });
  },

  setMetric(event) {
    const metric = event.currentTarget.dataset.key;
    this.setData({ metric, metricLabel: METRICS.find(item => item.key === metric).label });
    this.build();
  },

  selectCategory(event) {
    this.setData({ category: Number(event.detail.value), page: 0 });
    this.build();
  },

  openFilters() {
    this.setData({
      filterOpen: true,
      draftSource: this.data.source,
      draftFrom: this.data.from,
      draftTo: this.data.to,
      filterError: "",
    });
  },

  closeFilters() {
    this.sheetDrag?.reset();
    this.setData({ filterOpen: false });
  },

  setDraftSource(event) {
    this.setData({ draftSource: event.currentTarget.dataset.source });
  },

  setDraftFrom(event) {
    this.setData({ draftFrom: event.detail.value });
  },

  setDraftTo(event) {
    this.setData({ draftTo: event.detail.value });
  },

  clearFilters() {
    this.setData({ draftSource: "all", draftFrom: "", draftTo: "" });
  },

  applyFilters() {
    const { draftSource, draftFrom, draftTo } = this.data;
    if (draftFrom && draftTo && draftFrom > draftTo) {
      this.setData({ filterError: "开始日期不能晚于结束日期" });
      return;
    }
    this.setData({
      source: draftSource, from: draftFrom, to: draftTo,
      filterOpen: false, filterError: "", page: 0,
    });
    this.build();
  },

  changePage(event) {
    const page = Math.min(this.data.pages - 1, Math.max(0, this.data.page + Number(event.currentTarget.dataset.delta)));
    if (page === this.data.page) return;
    this.setData({ page }, () => this.build());
  },

  openRecord(event) {
    wx.navigateTo({ url: "/pages/report/report?attemptId=" + encodeURIComponent(event.currentTarget.dataset.id) });
  },
});
