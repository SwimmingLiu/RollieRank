const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const format = require("../../utils/format.js");
const { subjectName } = require("../../utils/catalog.js");

const FILTERS = [
  { key: "wrong", label: "错题" },
  { key: "all", label: "全部" },
  { key: "marked", label: "待检查" },
];

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
    feedbackQuestion: "",
    feedbackSuggested: "",
    feedbackEvidence: "",
    feedbackError: "",
    feedbackChoices: ["A", "B", "C", "D"],
    submittingFeedback: false,
    copyCount: 0,
    uiBase: "/assets/ui",
  },

  onLoad(query) {
    this.attemptId = query.attemptId || "";
    this.setData({ filter: query.filter === "wrong" ? "wrong" : "all", activeType: query.type || "" });
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
    const marked = this.all.find(row => row.marked && row.answer !== row.ref) || this.all.find(row => row.answer !== row.ref);
    this.feedbackId = storage.uuid();
    this.setData({
      feedbackOpen: true,
      feedbackQuestion: marked ? String(marked.n) : "",
      feedbackSuggested: "",
      feedbackEvidence: "",
      feedbackError: "",
    });
  },

  closeFeedback() {
    if (this.data.submittingFeedback) return;
    this.setData({ feedbackOpen: false });
  },

  onFeedbackQuestion(event) {
    this.setData({ feedbackQuestion: event.detail.value, feedbackError: "" });
  },

  chooseSuggestion(event) {
    this.setData({ feedbackSuggested: event.currentTarget.dataset.answer, feedbackError: "" });
  },

  onFeedbackEvidence(event) {
    this.setData({ feedbackEvidence: event.detail.value, feedbackError: "" });
  },

  async submitFeedback() {
    if (this.data.submittingFeedback) return;
    const question = Number(this.data.feedbackQuestion);
    const row = this.all.find(item => item.n === question);
    const evidence = this.data.feedbackEvidence.trim();
    const suggestedAnswer = this.data.feedbackSuggested;
    if (!Number.isInteger(question) || question < 1 || question > this.all.length) {
      this.setData({ feedbackError: "请输入本卷的有效题号" });
      return;
    }
    if (!row || row.answer === "—") {
      this.setData({ feedbackError: "只有已作答的题目可以反馈" });
      return;
    }
    if (!["A", "B", "C", "D"].includes(suggestedAnswer)) {
      this.setData({ feedbackError: "请选择建议答案" });
      return;
    }
    if (!evidence) {
      this.setData({ feedbackError: "请填写核对依据" });
      return;
    }
    this.setData({ submittingFeedback: true, feedbackError: "" });
    try {
      await api.request("corrections/submit", {
        guestId: storage.guestId(),
        attemptId: this.attemptId,
        feedbackId: this.feedbackId,
        baseRevision: this.attempt.answerRevision || 0,
        changes: [{ question, suggestedAnswer, evidence }],
      });
      this.setData({ feedbackOpen: false, feedbackSuggested: "", feedbackEvidence: "" });
      wx.showToast({ title: "反馈已提交", icon: "success" });
    } catch (error) {
      this.setData({ feedbackError: error.message });
    } finally {
      this.setData({ submittingFeedback: false });
    }
  },
});
