const api = require("../../services/api");
const storage = require("../../utils/storage");
const catalogUtil = require("../../utils/catalog");
const format = require("../../utils/format");
const { ASSET_BASE } = require("../../config");
const timing = require("../../utils/timing");

Page({
  data: {
    loading: true,
    error: "",
    papers: [],
    activeProject: 0,
    selectedId: "",
    selected: null,
    mode: "whole",
    wholeMinutes: 120,
    sections: [],
    planTotal: 0,
    running: false,
    paused: false,
    elapsed: "00:00",
    assetBase: ASSET_BASE,
  },

  onLoad() {
    this.ms = 0;
    this.startedAt = 0;
    this.load();
  },

  onUnload() {
    this.stopTicker();
  },

  async load() {
    try {
      const versions = await api.catalog();
      const groups = catalogUtil.groupByInstitution(versions);
      const papers = groups.map(group => ({
        name: group.name,
        logo: group.logo,
        versions: group.versions.map(version => ({
          id: version.id,
          label: `${version.number}套`,
          title: catalogUtil.versionTitle(version),
          questionCount: version.questionCount,
          defaultMinutes: version.timeLimitMinutes || Math.round(version.questionCount * 0.9),
          questions: version.questions,
        })),
      }));
      const saved = wx.getStorageSync("rr:timer") || {};
      const selectedId = saved.selectedId || "";
      this.setData({ loading: false, papers, selectedId });
      if (selectedId) this.pick(selectedId, false);
      this.setData({ wholeMinutes: saved.wholeMinutes || this.data.wholeMinutes });
      this.restore(saved);
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  openSection(event) {
    this.setData({ activeProject: Number(event.currentTarget.dataset.index) });
  },

  pick(id, resetWhole = true) {
    const paper = this.data.papers.flatMap(group => group.versions).find(item => item.id === id);
    if (!paper) return;
    const sections = this.sectionsOf(paper.questions);
    this.paper = paper;
    this.setData({
      selectedId: id,
      selected: { id, label: paper.label, title: paper.title, questionCount: paper.questionCount, defaultMinutes: paper.defaultMinutes },
      sections,
      planTotal: sections.reduce((sum, section) => sum + section.minutes, 0),
      ...(resetWhole ? { wholeMinutes: paper.defaultMinutes } : {}),
    });
    this.save();
  },

  // 模块计划按题量与参考分值分配整数分钟，总和与整卷时限保持一致。
  sectionsOf(questions) {
    const groups = [];
    for (const question of questions) {
      const type = catalogUtil.subjectName(question.type);
      const last = groups[groups.length - 1];
      if (last && last.type === type) last.count += 1;
      else groups.push({ type, count: 1 });
    }
    const total = groups.reduce((sum, group) => sum + group.count, 0);
    const minutes = this.data.wholeMinutes || (this.paper ? this.paper.defaultMinutes : 120);
    let used = 0;
    return groups.map((group, index) => {
      const value = index === groups.length - 1
        ? minutes - used
        : Math.max(1, Math.round((group.count / total) * minutes));
      used += value;
      return { key: `subject-${index + 1}`, id: `subject-${index + 1}`, type: group.type, name: group.type, count: group.count, minutes: value };
    });
  },

  choosePaper() {
    const groups = this.data.papers;
    if (!groups.length) return;
    const versions = groups[this.data.activeProject].versions.map(v => v.label + " · " + v.title);
    wx.showActionSheet({
      itemList: versions.slice(0, 6),
      success: res => this.pick(groups[this.data.activeProject].versions[res.tapIndex].id),
      fail: () => {},
    });
  },

  setMode(event) {
    const { mode } = event.currentTarget.dataset;
    this.setData({ mode });
    if (mode === "modules") {
      this.setData({ sections: this.sectionsOf(this.paper ? this.paper.questions : []), planTotal: this.data.wholeMinutes });
    }
    this.save();
  },

  stepWhole(event) {
    const delta = Number(event.currentTarget.dataset.delta);
    const wholeMinutes = Math.min(300, Math.max(5, this.data.wholeMinutes + delta));
    this.setData({ wholeMinutes });
    this.save();
  },

  onWholeInput(event) {
    const value = parseInt(event.detail.value, 10);
    this.setData({ wholeMinutes: Number.isFinite(value) ? Math.min(300, Math.max(1, value)) : 1 });
  },

  stepModule(event) {
    const { index, delta } = event.currentTarget.dataset;
    const sections = this.data.sections.slice();
    sections[Number(index)].minutes = Math.max(1, sections[Number(index)].minutes + Number(delta));
    this.setData({ sections, planTotal: sections.reduce((sum, s) => sum + s.minutes, 0) });
    this.save();
  },

  start() {
    if (!this.data.selectedId) {
      wx.showToast({ title: "先选一套卷", icon: "none" });
      return;
    }
    this.run = { startedAt: 0, endedAt: 0 };
    const minutes = this.data.mode === "modules"
      ? this.data.sections.reduce((sum, s) => sum + s.minutes, 0)
      : this.data.wholeMinutes;
    this.limitMs = minutes * 60 * 1000;
    this.ms = 0;
    this.startedAt = Date.now();
    this.run = { startedAt: this.startedAt, endedAt: 0, plannedMinutes: minutes };
    this.setData({ running: true, paused: false, elapsed: "00:00" });
    this.save();
    this.tick();
  },

  pause() {
    if (!this.data.running) return;
    if (this.data.paused) {
      this.startedAt = Date.now();
      this.setData({ paused: false });
      this.tick();
    } else {
      this.stopTicker();
      this.setData({ paused: true });
    }
  },

  tick() {
    this.stopTicker();
    this.timer = setInterval(() => {
      const total = this.ms + (Date.now() - this.startedAt);
      this.setData({ elapsed: format.minutes(total), overLimit: total > (this.limitMs || Infinity) });
    }, 500);
  },

  stopTicker() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  },

  finish() {
    this.stopTicker();
    const total = this.ms + (this.data.paused ? 0 : Date.now() - this.startedAt);
    this.ms = total;
    const startedAt = this.run ? this.run.startedAt : 0;
    const plannedMinutes = this.run ? this.run.plannedMinutes : this.data.wholeMinutes;
    this.startedAt = 0;
    // 结束时间取真实时钟，课程用时不会被暂停或页面切换改写。
    const attemptId = storage.pendingId(this.data.selectedId);
    const pending = timing.buildTiming({
      attemptId,
      versionId: this.data.selectedId,
      startedAt,
      endedAt: startedAt + total,
      plannedMinutes,
      sections: this.data.sections,
      mode: this.data.mode,
    });
    if (pending) wx.setStorageSync("rr:timing:pending", { attemptId, versionId: this.data.selectedId, ...pending });
    this.setData({ running: false, paused: false, elapsed: format.minutes(total) });
    wx.showModal({
      title: "结束计时",
      content: `本次做题 ${format.minutes(total)}，现在进入录答案？`,
      confirmText: "去录入",
      success: res => {
        if (!res.confirm) return;
        wx.navigateTo({ url: `/pages/practice/practice?versionId=${this.data.selectedId}&attemptId=${attemptId}` });
      },
    });
  },

  reset() {
    this.stopTicker();
    this.ms = 0;
    this.setData({ running: false, paused: false, elapsed: "00:00" });
  },

  // 计时来源与已选套卷保存在本机，从录答案返回时仍保持同一选择。
  save() {
    wx.setStorageSync("rr:timer", {
      selectedId: this.data.selectedId,
      wholeMinutes: this.data.wholeMinutes,
      mode: this.data.mode,
      running: this.data.running,
      startedAt: this.run ? this.run.startedAt : 0,
      plannedMinutes: this.run ? this.run.plannedMinutes : this.data.wholeMinutes,
    });
  },

  restore(saved) {
    if (!saved || !saved.running || !saved.startedAt) return;
    // 只恢复 6 小时内且仍在计时的记录，超时视为已结束，避免把隔夜时间算成做题。
    const elapsed = Date.now() - saved.startedAt;
    if (elapsed > 6 * 60 * 60 * 1000 || elapsed < 0) return;
    this.ms = 0;
    this.startedAt = Date.now() - elapsed;
    this.run = { startedAt: saved.startedAt, endedAt: 0, plannedMinutes: saved.plannedMinutes || this.data.wholeMinutes };
    this.limitMs = (saved.plannedMinutes || this.data.wholeMinutes) * 60 * 1000;
    this.setData({ running: true, paused: false, elapsed: format.minutes(elapsed) });
    this.tick();
  },
});
