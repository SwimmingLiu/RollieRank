const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const format = require("../../utils/format.js");
const { subjectName } = require("../../utils/catalog.js");
const { createPageSheetDrag } = require("../../utils/sheet-gesture.js");

const FILTERS = [
  { key: "wrong", label: "错题" },
  { key: "all", label: "全部" },
  { key: "marked", label: "待检查" },
];
const STATUS = { pending: "待审核", partial: "部分已处理", approved: "已通过", rejected: "已拒绝", mixed: "已处理" };

Page({
  data: {
    loading: true,
    error: "",
    groups: [],
    filters: FILTERS,
    filter: "all",
    counts: { all: 0, wrong: 0, marked: 0 },
    types: [],
    activeType: "",
    typeLabel: "全部板块",
    typesOpen: false,
    feedbackOpen: false,
    feedbackPicking: false,
    feedbackQuestions: [],
    feedbackItems: [],
    feedbackError: "",
    feedbackChoices: ["A", "B", "C", "D"],
    submittingFeedback: false,
    historyOpen: false,
    historyLoading: false,
    historyError: "",
    feedbackHistory: [],
    feedbackDetail: null,
    feedbackPreview: null,
    copyCount: 0,
    sheetDragY: 0,
    sheetDragging: false,
    sheetClosing: false,
    sheetShadeOpacity: 1,
    uiBase: "/assets/ui",
  },

  onLoad(query) {
    this.sheetDrag = createPageSheetDrag(this, {
      onDismiss: () => {
        if (this.data.historyOpen) this.closeFeedbackHistory();
        else if (this.data.feedbackOpen) this.closeFeedback();
      },
    });
    this.attemptId = query.attemptId || "";
    let activeType = "";
    try { activeType = decodeURIComponent(query.type || ""); } catch { activeType = query.type || ""; }
    this.setData({ filter: query.filter === "wrong" ? "wrong" : "all", activeType });
    this.load();
  },

  async load() {
    try {
      const [attempt] = await api.sync([this.attemptId]);
      if (!attempt) throw new Error("这份成绩不在当前身份下。");
      this.attempt = attempt;
      const marks = wx.getStorageSync(storage.KEYS.marks(this.attemptId)) || [];
      this.all = attempt.report.rows.map(row => ({
        n: row.question,
        numberText: String(row.question).padStart(2, "0"),
        type: subjectName(row.type),
        answer: row.answer || "—",
        ref: row.correctAnswer,
        status: row.status,
        statusLabel: format.STATUS_LABEL[row.status],
        marked: Boolean(marks[row.question - 1]),
      }));
      const types = [...new Set(this.all.map(row => row.type))];
      const activeType = types.includes(this.data.activeType) ? this.data.activeType : "";
      this.setData({
        loading: false,
        error: "",
        canFeedback: !attempt.isSample,
        activeType,
        typeLabel: activeType || "全部板块",
        types: [{ key: "", label: "全部板块" }, ...types.map(type => ({ key: type, label: type }))],
      });
      this.apply();
      this.loadRates(attempt);
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  async loadRates(attempt) {
    const params = [
      "versionId=" + encodeURIComponent(attempt.versionId),
      "attemptId=" + encodeURIComponent(attempt.id),
      "guestId=" + encodeURIComponent(storage.guestId()),
      "scope=nationwide",
      "band=all",
    ];
    try {
      const result = await api.request("positions/insights?" + params.join("&"));
      const stats = new Map((result.questions || []).map(question => [question.number, question]));
      this.all = this.all.map(row => {
        const question = stats.get(row.n);
        const optionRate = answer => question?.options.find(option => option.answer === answer)?.rate;
        const correctRate = optionRate(row.ref);
        const sameWrongRate = row.status === "wrong" ? optionRate(row.answer) : null;
        return {
          ...row,
          correctRate: correctRate == null ? "" : format.percent(correctRate),
          sameWrongRate: sameWrongRate == null ? "" : format.percent(sameWrongRate),
        };
      });
      this.apply();
    } catch {
      // Cohort data may be unavailable while the user's saved feedback remains readable.
    }
  },

  apply() {
    const { filter, activeType } = this.data;
    const scope = this.all.filter(row => !activeType || row.type === activeType);
    const wrong = scope.filter(row => row.status === "wrong");
    const marked = scope.filter(row => row.marked);
    const rows = filter === "wrong" ? wrong : filter === "marked" ? marked : scope;
    const byType = new Map();
    for (const row of rows) {
      if (!byType.has(row.type)) byType.set(row.type, []);
      byType.get(row.type).push(row);
    }
    this.wrongNumbers = rows.filter(row => row.status === "wrong").map(row => row.n);
    this.setData({
      groups: [...byType].map(([type, rows]) => ({ type, rows })),
      counts: { all: scope.length, wrong: wrong.length, marked: marked.length },
      copyCount: this.wrongNumbers.length,
    });
  },

  setFilter(event) {
    this.setData({ filter: event.currentTarget.dataset.key });
    this.apply();
  },

  openTypes() {
    this.setData({ typesOpen: true });
  },

  closeTypes() {
    this.setData({ typesOpen: false });
  },

  setType(event) {
    const activeType = event.detail.key;
    this.setData({ activeType, typeLabel: activeType || "全部板块", typesOpen: false });
    this.apply();
  },

  copyWrong() {
    if (this.wrongNumbers.length) wx.setClipboardData({ data: this.wrongNumbers.join(",") });
  },

  openFeedback() {
    if (!this.data.canFeedback || this.data.submittingFeedback) return;
    const marked = this.all.filter(row => row.marked && (!this.data.activeType || row.type === this.data.activeType));
    this.feedbackId = storage.uuid();
    this.setData({
      feedbackOpen: true,
      feedbackPicking: marked.length !== 1,
      feedbackQuestions: this.feedbackOptions([]),
      feedbackItems: marked.length === 1 ? [this.feedbackItem(marked[0])] : [],
      feedbackError: "",
    });
  },

  feedbackOptions(items) {
    const selected = new Set(items.map(item => item.question));
    return this.all.map(({ n, marked }) => ({ n, marked, selected: selected.has(n) }));
  },

  feedbackItem(row) {
    return {
      question: row.n,
      answer: row.answer === "—" ? "留空" : row.answer,
      reference: row.ref,
      suggestedAnswer: "",
      evidence: "",
    };
  },

  pickFeedbackQuestion(event) {
    const question = Number(event.currentTarget.dataset.number);
    const row = this.all.find(item => item.n === question);
    if (!row || this.data.submittingFeedback || this.data.feedbackItems.some(item => item.question === question)) return;
    this.setData({ feedbackItems: [...this.data.feedbackItems, this.feedbackItem(row)], feedbackPicking: false, feedbackError: "" });
  },

  updateFeedbackItem(index, patch) {
    const feedbackItems = this.data.feedbackItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
    this.setData({ feedbackItems, feedbackError: "" });
  },

  closeFeedback() {
    if (this.data.submittingFeedback) return;
    this.sheetDrag?.reset();
    this._sheetScrollTop = 0;
    this.setData({ feedbackOpen: false });
  },

  backFeedback() {
    if (this.data.feedbackItems.length) this.setData({ feedbackPicking: false });
    else this.closeFeedback();
  },

  chooseSuggestion(event) {
    this.updateFeedbackItem(Number(event.currentTarget.dataset.index), { suggestedAnswer: event.currentTarget.dataset.answer });
  },

  onFeedbackEvidence(event) {
    this.updateFeedbackItem(Number(event.currentTarget.dataset.index), { evidence: event.detail.value });
  },

  addFeedbackQuestion() {
    if (this.data.submittingFeedback || this.data.feedbackItems.length >= this.all.length) return;
    this.setData({ feedbackPicking: true, feedbackQuestions: this.feedbackOptions(this.data.feedbackItems), feedbackError: "" });
  },

  removeFeedbackQuestion(event) {
    if (this.data.submittingFeedback) return;
    const index = Number(event.currentTarget.dataset.index);
    const feedbackItems = this.data.feedbackItems.filter((_, itemIndex) => itemIndex !== index);
    this.setData({ feedbackItems, feedbackError: "" });
  },

  async submitFeedback() {
    if (this.data.submittingFeedback) return;
    const items = this.data.feedbackItems.map(item => ({
      question: Number(item.question),
      suggestedAnswer: item.suggestedAnswer,
      evidence: item.evidence.trim(),
    }));
    if (!items.length) return this.setData({ feedbackError: "请至少反馈一道题" });
    for (const item of items) {
      if (!this.data.feedbackChoices.includes(item.suggestedAnswer)) return this.setData({ feedbackError: `请选择第 ${item.question} 题的建议答案` });
      if (item.suggestedAnswer === this.all[item.question - 1].ref) return this.setData({ feedbackError: `第 ${item.question} 题的建议答案与当前参考相同` });
      if (!item.evidence) return this.setData({ feedbackError: `请填写第 ${item.question} 题的核对依据` });
    }
    this.setData({ submittingFeedback: true, feedbackError: "" });
    try {
      const { feedback } = await api.request("corrections/submit", {
        guestId: storage.guestId(),
        attemptId: this.attemptId,
        feedbackId: this.feedbackId,
        baseRevision: this.attempt.answerRevision || 0,
        changes: items,
      });
      this.setData({ feedbackOpen: false, feedbackItems: [] });
      wx.showToast({ title: "反馈已提交", icon: "success" });
      this.openHistory(feedback);
    } catch (error) {
      this.setData({ feedbackError: error.message });
    } finally {
      this.setData({ submittingFeedback: false });
    }
  },

  openFeedbackHistory() {
    if (!this.data.submittingFeedback) this.openHistory();
  },

  async openHistory(feedback) {
    this.setData({
      historyOpen: true,
      historyLoading: true,
      historyError: "",
      feedbackDetail: feedback ? this.formatFeedback(feedback) : null,
      feedbackPreview: null,
    });
    try {
      const result = await api.request("corrections/list", { guestId: storage.guestId() });
      const feedbackHistory = result.feedbacks.filter(item => item.attemptId === this.attemptId).map(item => this.formatFeedback(item));
      this.setData({ feedbackHistory });
    } catch (error) {
      this.setData({ historyError: error.message });
    } finally {
      this.setData({ historyLoading: false });
    }
  },

  formatFeedback(feedback) {
    return {
      ...feedback,
      statusLabel: STATUS[feedback.status],
      canPreview: feedback.items.some(item => item.status === "pending"),
      items: feedback.items.map(item => ({ ...item, statusLabel: STATUS[item.status] })),
    };
  },

  openFeedbackDetail(event) {
    this.setData({
      feedbackDetail: this.data.feedbackHistory.find(item => item.id === event.currentTarget.dataset.id),
      feedbackPreview: null, historyError: "",
    });
  },

  backToFeedbackList() {
    this.setData({ feedbackDetail: null, feedbackPreview: null, historyError: "" });
  },

  closeFeedbackHistory() {
    this.sheetDrag?.reset();
    this._sheetScrollTop = 0;
    this.setData({ historyOpen: false });
  },

  async previewFeedback() {
    const { feedbackDetail } = this.data;
    if (!feedbackDetail?.canPreview || this.data.historyLoading) return;
    this.setData({ historyLoading: true, historyError: "" });
    try {
      const preview = await api.request("corrections/preview", { guestId: storage.guestId(), feedbackId: feedbackDetail.id });
      if (this.data.feedbackDetail?.id === feedbackDetail.id) this.setData({
        feedbackPreview: {
          official: format.scoreCard(preview.official.totalCents),
          projected: format.scoreCard(preview.projected.totalCents),
          delta: (preview.deltaCents > 0 ? "+" : "") + format.score(preview.deltaCents),
        },
      });
    } catch (error) {
      this.setData({ historyError: error.message });
    } finally {
      this.setData({ historyLoading: false });
    }
  },

  openAdmin() {
    this.sheetDrag?.reset();
    this._sheetScrollTop = 0;
    this.setData({ historyOpen: false, feedbackOpen: false });
    wx.navigateTo({ url: "/pages/admin/admin" });
  },

  onUnload() {
    this.sheetDrag?.reset();
  },

  noopSheet() {},

  onSheetScroll(event) {
    this._sheetScrollTop = event.detail?.scrollTop || 0;
  },

  startSheetDrag(event) {
    this.sheetDrag?.start(event, { atTop: (this._sheetScrollTop || 0) <= 1 });
  },

  moveSheetDrag(event) {
    this.sheetDrag?.move(event);
  },

  endSheetDrag(event) {
    this.sheetDrag?.end(event);
  },

  cancelSheetDrag() {
    this.sheetDrag?.cancel();
  },
});
