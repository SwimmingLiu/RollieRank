const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const catalogUtil = require("../../utils/catalog.js");

const { ASSET } = require("../../config.js");

const CHOICES = ["A", "B", "C", "D"];

function sectionsOf(version) {
  // 章节来自逐题题型，不把题量或题号写死；服务端公开目录保持原始顺序。
  const sections = [];
  for (const question of version.questions) {
    const last = sections[sections.length - 1];
    if (last && last.type === question.type) {
      last.end = question.number;
      last.count += 1;
    } else {
      sections.push({ type: question.type, start: question.number, end: question.number, count: 1 });
    }
  }
  return sections.map(section => ({ ...section, key: `${section.type}-${section.start}` }));
}

Page({
  data: {
    loading: true,
    error: "",
    version: null,
    title: "",
    identity: "",
    sections: [],
    activeSection: 0,
    questions: [],
    allQuestions: [],
    currentQuestion: null,
    current: 1,
    single: false,
    markOnly: false,
    scrollTarget: "",
    sheet: "",
    progress: 0,
    publisherLogo: "",
    answers: [],
    marks: [],
    answered: 0,
    uncertain: 0,
    submitting: false,
    uiBase: "/assets/ui",
    choices: CHOICES,
  },

  onLoad(query) {
    this.attemptId = query.attemptId || "";
    this.versionId = decodeURIComponent(query.versionId || "");
    this.retry();
  },

  async retry() {
    this.setData({ loading: true, error: "" });
    try {
      const versions = await api.catalog();
      const version = versions.find(v => v.id === this.versionId);
      if (!version) throw new Error("找不到这套卷，请回到选卷页重新选择。");
      const draft = storage.loadDraft(version.id) || {};
      this.savedDraft = Boolean(draft.id);
      const answers = new Array(version.questionCount).fill("");
      if (Array.isArray(draft.answers)) {
        draft.answers.forEach((value, index) => {
          if (index < answers.length && CHOICES.includes(value)) answers[index] = value;
        });
      }
      const marks = new Array(version.questionCount).fill(false);
      if (Array.isArray(draft.marks)) draft.marks.forEach((value, index) => {
        if (index < marks.length) marks[index] = Boolean(value);
      });
      if (!this.attemptId) this.attemptId = draft.id || storage.pendingId(version.id);
      this.version = version;
      this.setData({
        loading: false,
        version: { id: version.id, questionCount: version.questionCount, invigilator: version.timeLimitMinutes || 0 },
        title: catalogUtil.versionTitle(version),
        identity: [
          catalogUtil.publisherName(version.institution),
          String(version.project || "").split(" · ")[0],
          catalogUtil.periodLabel(version.period),
          version.number ? "行测" + String(version.number).padStart(2, "0") + "套" : version.title,
        ].filter(Boolean).join(" · "),
        publisherLogo: ASSET[catalogUtil.LOGO[version.institution]] || "",
        current: Math.min(version.questionCount, Math.max(1, Number(draft.current) || 1)),
        single: Boolean(draft.single),
        sections: sectionsOf(version),
        answers,
        marks,
      });
      this.reflect();
      if (this.data.current > 1) this.jump(this.data.current);
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },


  reflect() {
    const { answers, marks, current, markOnly, sections } = this.data;
    const allQuestions = this.version.questions.map(question => ({
      number: question.number,
      type: question.type,
      answer: answers[question.number - 1] || "",
      marked: Boolean(marks[question.number - 1]),
    }));
    const questions = markOnly ? allQuestions.filter(question => question.marked) : allQuestions;
    const currentQuestion = questions.find(question => question.number === current) || questions[0] || null;
    const activeSection = Math.max(0, sections.findIndex(section => current >= section.start && current <= section.end));
    const answered = answers.filter(Boolean).length;
    this.setData({
      allQuestions, questions, currentQuestion, activeSection, answered,
      uncertain: marks.filter(Boolean).length,
      progress: answered / this.version.questionCount * 100,
    });
  },

  choose(event) {
    const { number, choice } = event.currentTarget.dataset;
    const index = Number(number) - 1;
    const answers = this.data.answers.slice();
    answers[index] = answers[index] === choice ? "" : choice;
    this.setData({ answers, current: Number(number) });
    this.reflect();
    if (answers[index] && this.data.single) this.moveQuestion(1);
    this.persist();
  },

  toggleMark(event) {
    const number = Number(event.currentTarget.dataset.number);
    const marks = this.data.marks.slice();
    marks[number - 1] = !marks[number - 1];
    this.setData({ marks, current: number });
    this.reflect();
    this.persist();
  },

  switchSection(event) {
    const section = this.data.sections[Number(event.currentTarget.dataset.index)];
    if (!section) return;
    this.setData({ markOnly: false, sheet: "" });
    this.jump(section.start);
  },

  goQuestion(event) {
    this.setData({ markOnly: false, sheet: "" });
    this.jump(Number(event.currentTarget.dataset.number));
  },

  jump(number) {
    this.setData({ current: number, scrollTarget: "" });
    this.reflect();
    this.setData({ scrollTarget: "answer-" + number });
    this.persist();
  },

  toggleMarkFilter() {
    const markOnly = !this.data.markOnly;
    const current = markOnly ? this.data.allQuestions.find(question => question.marked)?.number || this.data.current : this.data.current;
    this.setData({ markOnly });
    this.jump(current);
  },

  toggleMode() {
    this.setData({ single: !this.data.single });
    this.jump(this.data.current);
  },

  moveQuestion(direction) {
    const { questions, currentQuestion } = this.data;
    const position = questions.findIndex(question => question.number === currentQuestion?.number);
    const next = questions[position + direction];
    if (next) this.jump(next.number);
  },

  startSwipe(event) {
    this.swipeStart = event.touches[0];
  },

  endSwipe(event) {
    const start = this.swipeStart;
    const end = event.changedTouches[0];
    if (!start || !end) return;
    const horizontal = end.clientX - start.clientX;
    const vertical = end.clientY - start.clientY;
    if (Math.abs(horizontal) >= 35 && Math.abs(horizontal) > Math.abs(vertical)) {
      this.moveQuestion(horizontal < 0 ? 1 : -1);
    }
  },

  persist() {
    if (!this.version || !this.attemptId) return;
    const { answers, marks, current, single, answered, title, identity } = this.data;
    if (!answered && !marks.some(Boolean) && current === 1 && !single && !this.savedDraft) return;
    const versionId = this.version.id;
    storage.saveDraft(versionId, { id: this.attemptId, versionId, answers: answers.map(value => value || null), marks, current, single });
    storage.setDraftEntry(versionId, {
      id: this.attemptId, answered, title, identity, questionCount: this.version.questionCount, versionId,
    });
    this.savedDraft = true;
  },

  openSections() {
    this.setData({ sheet: "sections" });
  },

  openSheet() {
    this.setData({ sheet: "answers" });
  },

  closeSheet() {
    this.setData({ sheet: "" });
  },

  submit() {
    if (!this.data.submitting) this.setData({ sheet: "submit" });
  },

  async doSubmit() {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    wx.showLoading({ title: "正在核分", mask: true });
    try {
      const answers = this.data.answers.map(value => (value ? value : null));
      // 计时记录必须属于本次答卷；来源不符时按未计时提交，不写入他人用时。
      // 服务端按当前卷校验模块，模块口径不匹配时退回整卷记录。
      const pending = wx.getStorageSync("rr:timing:pending");
      let timing = null;
      if (pending && pending.versionId === this.version.id && pending.attemptId === this.attemptId) {
        timing = pending.modules || pending.whole || null;
      }
      const attempt = await api.submit({ version: this.version, answers, attemptId: this.attemptId, timing });
      storage.upsertAttempt(attempt);
      wx.setStorageSync(storage.KEYS.marks(attempt.id), this.data.marks);
      storage.dropDraft(this.version.id);
      storage.clearPendingId(this.version.id, this.attemptId);
      storage.setDraftEntry(this.version.id, null);
      wx.removeStorageSync("rr:timing:pending");
      this.attemptId = "";
      wx.hideLoading();
      wx.redirectTo({ url: `/pages/report/report?attemptId=${attempt.id}` });
    } catch (error) {
      wx.hideLoading();
      if (this.attemptId) this.setData({ submitting: false });
      wx.showModal({ title: "交卷未完成", content: error.message, showCancel: false });
    }
  },

  onUnload() {
    this.persist();
  },

  onHide() {
    this.persist();
  },
});
