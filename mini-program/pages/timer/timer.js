const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const catalogUtil = require("../../utils/catalog.js");
const format = require("../../utils/format.js");
const timing = require("../../utils/timing.js");

Page({
  data: {
    loading: true,
    error: "",
    papers: [],
    activeProject: -1,
    paperPicker: false,
    source: "paper",
    selectedId: "",
    selected: null,
    mode: "whole",
    wholeMinutes: 120,
    sections: [],
    planTotal: 0,
    running: false,
    paused: false,
    elapsed: "00:00",
    uiBase: "/assets/ui",
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
        label: catalogUtil.publisherName(group.name),
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
      this.plans = saved.plans || { paper: { ...saved } };
      this.setData({ loading: false, papers });
      this.applyPlan(saved.source || "paper", saved);
      this.restore(saved);
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  openSection(event) {
    this.setData({ activeProject: Number(event.currentTarget.dataset.index) });
  },

  setSource(event) {
    const next = event.currentTarget.dataset.source;
    if (next === this.data.source) return;
    this.rememberPlan();
    this.applyPlan(next, this.plans[next] || {});
    this.save();
  },

  applyPlan(source, saved) {
    const paper = source === "paper" ? this.data.papers.flatMap(group => group.versions).find(item => item.id === saved.selectedId) : null;
    this.paper = paper;
    const wholeMinutes = saved.wholeMinutes || paper?.defaultMinutes || 120;
    this.setData({ source, wholeMinutes });
    const sections = saved.sections?.length ? saved.sections : this.sectionsOf(paper?.questions || []);
    this.setData({
      selectedId: paper?.id || "",
      selected: paper ? { id: paper.id, title: paper.title, questionCount: paper.questionCount, defaultMinutes: paper.defaultMinutes } : null,
      mode: paper && saved.mode === "modules" ? "modules" : "whole",
      sections,
      planTotal: sections.reduce((sum, section) => sum + section.minutes, 0),
    });
  },

  choosePaper() {
    this.setData({ paperPicker: true, activeProject: -1 });
  },

  closePaperPicker() {
    if (this.data.activeProject >= 0) this.setData({ activeProject: -1 });
    else this.setData({ paperPicker: false });
  },

  pickPaper(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ paperPicker: false });
    if (this.finished) {
      const finished = this.finished;
      this.finished = null;
      this.openEntry(id, finished);
      return;
    }
    this.applyPlan("paper", { selectedId: id, mode: this.data.mode });
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

  setMode(event) {
    const { mode } = event.currentTarget.dataset;
    this.setData({ mode });
    if (mode === "modules" && !this.data.sections.length) {
      this.setData({ sections: this.sectionsOf(this.paper?.questions || []), planTotal: this.data.wholeMinutes });
    }
    this.save();
  },

  stepWhole(event) {
    const delta = Number(event.currentTarget.dataset.delta);
    const wholeMinutes = Math.min(300, Math.max(1, this.data.wholeMinutes + delta));
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
    if (this.data.mode === "modules" && this.data.planTotal !== this.data.wholeMinutes) {
      wx.showToast({ title: "模块合计须等于整卷用时", icon: "none" });
      return;
    }
    if (this.data.source === "paper" && !this.data.selectedId) {
      wx.showToast({ title: "先选一套卷", icon: "none" });
      return;
    }
    this.finished = null;
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
      this.ms += Date.now() - this.startedAt;
      this.stopTicker();
      this.setData({ paused: true, elapsed: format.minutes(Math.max(1, this.ms)) });
    }
    this.save();
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
    if (!this.data.running) return;
    this.stopTicker();
    const total = this.ms + (this.data.paused ? 0 : Date.now() - this.startedAt);
    const finished = {
      startedAt: this.run.startedAt,
      endedAt: this.run.startedAt + total,
      plannedMinutes: this.run.plannedMinutes,
      sections: this.data.sections,
      mode: this.data.mode,
    };
    this.run = null;
    this.startedAt = 0;
    this.ms = 0;
    this.setData({ running: false, paused: false, elapsed: format.minutes(total) });
    this.save();
    if (!this.data.selectedId) {
      this.finished = finished;
      this.choosePaper();
      return;
    }
    this.openEntry(this.data.selectedId, finished);
  },

  openEntry(versionId, finished) {
    const attemptId = storage.loadDraft(versionId)?.id || storage.pendingId(versionId);
    const pending = timing.buildTiming({ ...finished, attemptId, versionId });
    if (pending) wx.setStorageSync("rr:timing:pending", { attemptId, versionId, ...pending });
    wx.navigateTo({ url: "/pages/practice/practice?versionId=" + encodeURIComponent(versionId) + "&attemptId=" + encodeURIComponent(attemptId) });
  },

  rememberPlan() {
    const { source, selectedId, wholeMinutes, mode, sections } = this.data;
    this.plans ||= {};
    this.plans[source] = { selectedId, wholeMinutes, mode, sections };
    return this.plans[source];
  },

  save() {
    const plan = this.rememberPlan();
    wx.setStorageSync("rr:timer", {
      ...plan,
      plans: this.plans,
      source: this.data.source,
      running: this.data.running,
      paused: this.data.paused,
      elapsedMs: this.ms,
      startedAt: this.run?.startedAt || 0,
      segmentStartedAt: this.startedAt || 0,
      plannedMinutes: this.run?.plannedMinutes || this.data.wholeMinutes,
    });
  },

  restore(saved) {
    if (!saved.running || !saved.startedAt) return;
    this.ms = saved.elapsedMs || 0;
    this.startedAt = saved.segmentStartedAt || saved.startedAt;
    const elapsed = this.ms + (saved.paused ? 0 : Date.now() - this.startedAt);
    if (elapsed > 6 * 60 * 60 * 1000 || elapsed < 0) return;
    this.run = { startedAt: saved.startedAt, plannedMinutes: saved.plannedMinutes || this.data.wholeMinutes };
    this.limitMs = this.run.plannedMinutes * 60 * 1000;
    this.setData({ running: true, paused: Boolean(saved.paused), elapsed: format.minutes(elapsed) });
    if (!saved.paused) this.tick();
  },
});
