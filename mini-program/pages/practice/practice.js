const api = require("../../services/api");
const storage = require("../../utils/storage");
const catalogUtil = require("../../utils/catalog");
const { ASSET_BASE } = require("../../config");

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
    answers: [],
    marks: [],
    answered: 0,
    uncertain: 0,
    submitting: false,
    assetBase: ASSET_BASE,
    choices: CHOICES,
  },

  onLoad(query) {
    this.attemptId = query.attemptId || "";
    this.load(query.versionId);
  },

  async load(versionId) {
    this.setData({ loading: true, error: "" });
    try {
      const versions = await api.catalog();
      const version = versions.find(v => v.id === versionId);
      if (!version) throw new Error("找不到这套卷，请回到选卷页重新选择。");
      const draft = storage.loadDraft(version.id) || {};
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
      if (!this.attemptId) this.attemptId = storage.pendingId(version.id);
      this.version = version;
      this.setData({
        loading: false,
        version: { id: version.id, questionCount: version.questionCount, invigilator: version.timeLimitMinutes || 0 },
        title: catalogUtil.versionTitle(version),
        identity: catalogUtil.identity(version),
        sections: sectionsOf(version),
        answers,
        marks,
        questions: this.rows(version, answers, marks, 0),
      });
      this.updateCounts();
      if (draft.updatedAt) wx.showToast({ title: "已恢复上次录入", icon: "none" });
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  rows(version, answers, marks, activeSection) {
    const section = this.data.sections[activeSection];
    return version.questions
      .filter(question => !section || (question.number >= section.start && question.number <= section.end))
      .map(question => ({
        number: question.number,
        type: question.type,
        answer: answers[question.number - 1] || "",
        marked: Boolean(marks[question.number - 1]),
      }));
  },

  updateCounts(answers) {
    const list = answers || this.data.answers;
    this.setData({
      answered: list.filter(Boolean).length,
      uncertain: (this.data.marks || []).filter(Boolean).length,
    });
  },

  choose(event) {
    const { number, choice } = event.currentTarget.dataset;
    const index = Number(number) - 1;
    const answers = this.data.answers.slice();
    // 再次点同一选项即取消，避免误录后必须跳过。
    answers[index] = answers[index] === choice ? "" : choice;
    this.setData({ answers });
    this.reflect(answers, this.data.marks);
    this.persist();
  },

  toggleMark(event) {
    const index = Number(event.currentTarget.dataset.number) - 1;
    const marks = this.data.marks.slice();
    marks[index] = !marks[index];
    this.setData({ marks });
    this.reflect(this.data.answers, marks);
    this.persist();
  },

  // 只在当前章节内重建行，避免整页重排导致键盘与滚动位置跳动。
  reflect(answers, marks) {
    const activeSection = this.data.activeSection;
    this.setData({ questions: this.rows(this.version, answers, marks, activeSection) });
    this.updateCounts(answers);
  },

  switchSection(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.setData({ activeSection: index });
    this.reflect(this.data.answers, this.data.marks);
  },

  persist() {
    if (!this.version) return;
    storage.saveDraft(this.version.id, {
      id: this.attemptId,
      versionId: this.version.id,
      answers: this.data.answers.map(value => value || null),
      marks: this.data.marks,
    });
    // 只有真正录过的卷才出现在续录入口，空白草稿不占目录。
    const answered = this.data.answers.filter(Boolean).length;
    storage.setDraftEntry(this.version.id, answered ? {
      id: this.attemptId,
      answered,
      title: this.data.title,
      identity: this.data.identity,
      questionCount: this.version.questionCount,
      versionId: this.version.id,
    } : null);
  },

  openSheet() {
    // 答题卡按章节给出完成度，方便跳回漏答的板块。
    const sections = this.data.sections.map(section => {
      let done = 0;
      for (let n = section.start; n <= section.end; n++) if (this.data.answers[n - 1]) done += 1;
      return { ...section, done };
    });
    const labels = sections.map(s => `${s.type} ${s.done}/${s.count}`);
    wx.showActionSheet({
      itemList: labels.slice(0, 6),
      success: res => this.switchSection({ currentTarget: { dataset: { index: res.tapIndex } } }),
      fail: () => {},
    });
  },

  submit() {
    if (this.data.submitting) return;
    const blank = this.data.answers.filter(value => !value).length;
    wx.showModal({
      title: blank ? `还有 ${blank} 题未答` : "确认交卷",
      content: blank ? "留空的题目按 0 分计入本次成绩，仍要交卷吗？" : "交卷后按服务端答案核分，可随时重练。",
      confirmText: "交卷",
      success: res => {
        if (res.confirm) this.doSubmit();
      },
    });
  },

  async doSubmit() {
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
      storage.dropDraft(this.version.id);
      storage.setDraftEntry(this.version.id, null);
      wx.removeStorageSync("rr:timing:pending");
      this.attemptId = "";
      wx.hideLoading();
      wx.redirectTo({ url: `/pages/report/report?attemptId=${attempt.id}` });
    } catch (error) {
      wx.hideLoading();
      this.setData({ submitting: false });
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
