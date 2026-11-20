const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const timing = require("../../utils/timing.js");
const timer = require("../../vendor/practice-timer.js");
const { groupByInstitution, publisherName, practiceIdentity } = require("../../utils/catalog.js");
const { ASSET } = require("../../config.js");

const MINUTE = 60000;
const normalize = text => text.trim().toLowerCase().replace(/[\s·]+/g, "");
const emptyPicker = () => ({ institution: "", collection: "", query: "" });

function paperRow(paper) {
  const limit = timer.resolveTimerLimit(paper);
  const title = timer.timerPaperTitle(paper, true).replace(/^第\s*(\d+)\s*套$/, "第$1套");
  return {
    id: paper.id,
    text: `${title} · ${paper.questionCount}题 · ${limit.kind === "suggested" ? "建议" : ""}${limit.minutes}分钟`,
  };
}

Component({
  properties: { standalone: Boolean },
  data: {
    loading: true,
    error: "",
    source: "paper",
    picking: true,
    associating: false,
    heading: "做题计时",
    pickerLevel: "institution",
    publishers: [],
    collections: [],
    groups: [],
    papers: [],
    institutionLabel: "",
    collectionLabel: "",
    query: "",
    plan: null,
    invalidInput: false,
    openingEntry: false,
    keyboardHeight: 0,
    scrollTarget: "",
    uiBase: "/assets/ui",
  },
  lifetimes: {
    attached() {
      this.mounted = true;
      this.picker = emptyPicker();
      this.load();
    },
    detached() {
      this.mounted = false;
      clearInterval(this.ticker);
    },
  },
  pageLifetimes: {
    show() {
      this.refreshClock();
    },
    hide() {
      clearInterval(this.ticker);
      this.ticker = undefined;
    },
  },
  methods: {
    async load() {
      this.setData({ loading: true, error: "" });
      try {
        const versions = await api.catalog();
        if (!this.mounted) return;
        this.versions = new Map(versions.map(version => [version.id, version]));
        this.available = versions.filter(version => version.status === "published");
        this.record = timing.loadTimerRecord(versions);
        this.setData({
          loading: false,
          publishers: groupByInstitution(this.available).map(group => ({
            id: group.name, label: group.label, icon: ASSET[group.logo] || "",
          })),
        });
        const current = this.record.plans[this.record.source];
        if (current && current.status !== "ready") this.showPlan();
        else this.showPicker();
      } catch (error) {
        if (this.mounted) this.setData({ loading: false, error: error.message || "套卷读取失败" });
      }
    },

    current() {
      return this.record?.plans[this.record.source];
    },

    save(timerState) {
      this.record.plans[this.record.source] = timerState;
      wx.setStorageSync(timing.TIMER_KEY, this.record);
      this.triggerEvent("change");
    },

    showPicker(associating = false) {
      this.picker = emptyPicker();
      this.setData({
        picking: true, associating, source: associating ? this.record.source : "paper",
        heading: associating ? "关联计时套卷" : "做题计时",
        keyboardHeight: 0, scrollTarget: "", expanded: false,
      });
      this.paintPicker();
      this.refreshClock();
    },

    paintPicker() {
      const { institution, collection, query } = this.picker;
      const scoped = institution ? this.available.filter(paper => paper.institution === institution) : this.available;
      const collections = timer.timerCollections(scoped);
      const chosen = collections.find(item => item.id === collection);
      const papers = chosen?.papers || scoped;
      const search = normalize(query);
      const matches = search ? papers.filter(paper => normalize(timer.timerPaperSearchText(paper)).includes(search)) : papers;
      this.setData({
        query,
        institutionLabel: institution ? publisherName(institution) : "",
        collectionLabel: chosen?.label === "套卷" ? "" : chosen?.label || "",
        pickerLevel: search && !chosen ? "search" : chosen ? "paper" : institution ? "collection" : "institution",
        collections: institution && !chosen && !search ? collections.map(item => ({
          id: item.id, label: item.label,
        })) : [],
        groups: search && !chosen ? timer.timerCollections(matches).map(group => ({
          id: group.id, label: [publisherName(group.institution), group.detail, group.label].filter(Boolean).join(" · "),
          papers: group.papers.map(paperRow),
        })) : [],
        papers: chosen ? matches.map(paperRow) : [],
      });
    },

    selectPublisher(event) {
      if (this.suppressTap) return;
      const institution = event.currentTarget.dataset.id;
      this.picker = { institution, collection: "", query: "" };
      this.pickerScrollTop = 0;
      this.paintPicker();
    },

    selectCollection(event) {
      if (this.suppressTap) return;
      this.picker = { ...this.picker, collection: event.currentTarget.dataset.id, query: "" };
      this.pickerScrollTop = 0;
      this.paintPicker();
    },

    onPickerScroll(event) {
      this.pickerScrollTop = event.detail.scrollTop || 0;
    },

    search(event) {
      this.picker.query = event.detail.value;
      this.paintPicker();
    },

    resetPicker() {
      this.picker = emptyPicker();
      this.pickerScrollTop = 0;
      this.paintPicker();
    },

    showCollections() {
      this.picker = { ...this.picker, collection: "", query: "" };
      this.pickerScrollTop = 0;
      this.paintPicker();
    },

    backPicker() {
      if (this.picker.collection) this.showCollections();
      else if (this.picker.institution || this.picker.query) this.resetPicker();
      else if (this.data.associating) this.showPlan();
      else this.dismiss();
    },

    selectPaper(event) {
      const id = event.currentTarget.dataset.id;
      const version = this.versions.get(id);
      if (version?.status !== "published" || this.data.openingEntry || this.suppressTap) return;
      this.runAction(() => {
        if (this.data.associating) {
          const linked = timer.bindPracticeTimer(this.current(), {
            attemptId: timing.attemptFor(id), versionId: id, sections: timer.timerSectionsForQuestions(version.questions),
          });
          this.openEntry(linked);
        } else {
          this.record.source = "paper";
          const previous = this.current();
          this.save(previous?.status === "ready" && previous.versionId === id
            ? previous : timing.timerForPaper(version, timing.attemptFor(id)));
          this.showPlan();
        }
      });
    },

    selectSource(event) {
      const source = event.currentTarget.dataset.source;
      if (source === this.data.source) return;
      this.record.source = source;
      if (source === "custom" && !this.current()) this.save(timer.createCustomPracticeTimer({ sessionId: storage.uuid() }));
      if (this.current()) this.showPlan();
      else this.showPicker();
    },

    choosePaper() {
      this.showPicker(false);
    },

    associate() {
      this.showPicker(true);
    },

    showPlan() {
      const state = this.current();
      if (!state) return this.showPicker();
      this.suppressTap = false;
      this.setData({
        picking: false, associating: false, heading: "做题计时", source: this.record.source,
        invalidInput: false, keyboardHeight: 0, scrollTarget: "",
      });
      this.paintPlan();
      this.refreshClock();
    },

    paintPlan() {
      const state = this.current();
      if (this.data.picking || !state) return;
      const plan = timer.timerView(state);
      const version = this.versions.get(state.versionId);
      this.setData({
        plan: {
          status: plan.status, modulesMode: plan.mode === "modules", canStart: plan.canStart,
          paperLabel: version ? practiceIdentity(version) : "", minutes: plan.plannedMs / MINUTE,
          limitLabel: plan.limit.label, allocated: plan.allocatedMs / MINUTE,
          mismatch: plan.planDeltaMs ? `${plan.planDeltaMs > 0 ? "多" : "少"} ${Math.abs(plan.planDeltaMs) / MINUTE} 分钟` : "",
          elapsed: timer.formatElapsed(plan.actualMs), progress: Math.min(100, plan.actualMs / plan.plannedMs * 100),
          modules: plan.modules.map((module, index) => ({
            id: module.id, name: module.name, minutes: module.plannedMs / MINUTE,
            elapsed: timer.formatElapsed(module.actualMs), active: module.id === plan.activeId, index,
          })),
        },
      });
    },

    refreshClock() {
      clearInterval(this.ticker);
      this.ticker = undefined;
      if (!this.data.picking && this.current()?.status === "running") {
        this.paintPlan();
        this.ticker = setInterval(() => this.paintPlan(), 1000);
      }
    },

    runAction(operation) {
      try {
        operation();
      } catch (error) {
        wx.showToast({ title: error.message, icon: "none" });
      }
    },

    editTimer(transform) {
      this.runAction(() => {
        this.save(transform(this.current()));
        this.paintPlan();
        this.refreshClock();
      });
    },

    toggleModules() {
      this.setData({ invalidInput: false });
      this.editTimer(state => timer.setTimerMode(state, state.mode === "modules" ? "whole" : "modules"));
    },

    balance() {
      this.setData({ invalidInput: false });
      this.editTimer(timer.balanceTimerModules);
    },

    stepMinutes(event) {
      this.setData({ invalidInput: false });
      this.editTimer(state => timer.changeTimerPlan(state, {
        minutes: Math.min(720, Math.max(1, state.plannedMs / MINUTE + Number(event.currentTarget.dataset.delta))),
      }));
    },

    editMinutes(event) {
      const text = event.detail.value;
      const moduleId = event.currentTarget.dataset.module;
      const minutes = Number(text);
      const valid = /^\d+$/.test(text) && minutes >= (moduleId ? 0 : 1) && minutes <= 720;
      this.setData({ invalidInput: !valid });
      if (valid) this.editTimer(state => timer.changeTimerPlan(state, { minutes, moduleId }));
    },

    focusMinutes(event) {
      this.focusTarget = event.currentTarget.id;
    },

    blurMinutes() {
      this.focusTarget = "";
      if (this.data.invalidInput) this.setData({ invalidInput: false }, () => this.paintPlan());
    },

    adjustKeyboard(event) {
      const height = event.detail.height || 0;
      this.setData({ keyboardHeight: height, scrollTarget: height ? this.focusTarget || "" : "" });
    },

    beginReorder(event) {
      this.reorder = { index: Number(event.currentTarget.dataset.index), y: event.touches[0]?.clientY };
    },

    endReorder(event) {
      const gesture = this.reorder;
      this.reorder = null;
      const moved = event.changedTouches[0]?.clientY - gesture?.y;
      if (!gesture || !Number.isFinite(moved) || Math.abs(moved) < 22) return;
      this.editTimer(state => {
        const ids = state.modules.map(module => module.id);
        const target = Math.min(ids.length - 1, Math.max(0, gesture.index + Math.round(moved / 44)));
        const [id] = ids.splice(gesture.index, 1);
        ids.splice(target, 0, id);
        return timer.reorderTimerModules(state, ids);
      });
    },

    start() {
      if (this.data.invalidInput) return;
      this.setData({ scrollTarget: "timer-content-top", keyboardHeight: 0 });
      this.editTimer(timer.startPracticeTimer);
    },

    pause() {
      this.editTimer(timer.pausePracticeTimer);
    },

    switchModule(event) {
      this.editTimer(state => timer.switchTimerModule(state, event.currentTarget.dataset.id));
    },

    finish() {
      if (this.data.openingEntry) return;
      this.runAction(() => {
        const state = timer.finishPracticeTimer(this.current());
        this.save(state);
        this.paintPlan();
        this.refreshClock();
        if (state.versionId) this.openEntry(state);
      });
    },

    enterFinished() {
      const state = this.current();
      if (state.versionId) this.openEntry(state);
      else this.associate();
    },

    openEntry(state) {
      if (this.data.openingEntry) return;
      this.setData({ openingEntry: true });
      timing.setEntryTiming(state);
      const url = `/pages/practice/practice?versionId=${encodeURIComponent(state.versionId)}&attemptId=${encodeURIComponent(state.attemptId)}`;
      const source = this.record.source;
      wx[this.properties.standalone ? "redirectTo" : "navigateTo"]({
        url,
        success: () => {
          this.record.source = source;
          this.save(null);
          this.triggerEvent("entered");
        },
        fail: () => {
          this.setData({ openingEntry: false });
          wx.showToast({ title: "录答页暂时无法打开，请重试", icon: "none" });
        },
      });
    },

    startGesture(event) {
      const point = event.touches.length === 1 && event.touches[0];
      this.gesture = point ? {
        x: point.clientX,
        y: point.clientY,
        zone: event.currentTarget?.dataset?.zone || "",
      } : null;
      this.suppressTap = false;
    },

    endGesture(event) {
      const from = this.gesture;
      this.gesture = null;
      const to = event.changedTouches[0];
      if (!from || !to) return;
      const dx = to.clientX - from.x, dy = to.clientY - from.y;
      this.suppressTap = Math.hypot(dx, dy) >= 8;
      if (from.zone === "handle" && dy < -38 && dy < -Math.abs(dx)) this.setData({ expanded: true });
      else if (from.zone === "handle" && dy > 52 && dy > Math.abs(dx)) {
        if (this.data.expanded) this.setData({ expanded: false });
        else this.dismiss();
      }
      if (from.zone === "panel" && this.data.picking) {
        if (dy < -38 && dy < -Math.abs(dx)) this.setData({ expanded: true });
        else if (dy > 42 && dy > Math.abs(dx) && this.pickerScrollTop <= 1 && this.data.expanded) this.setData({ expanded: false });
      }
      if (this.data.picking && dx < -Math.max(56, (wx.getWindowInfo?.().windowWidth || 390) * .18) && Math.abs(dx) > Math.abs(dy) * 1.5) this.backPicker();
      if (this.suppressTap) {
        clearTimeout(this.suppressTapTimer);
        this.suppressTapTimer = setTimeout(() => { this.suppressTap = false; }, 0);
      }
    },

    cancelGesture() {
      this.gesture = null;
      this.suppressTap = true;
    },

    dismissFromBackdrop() {
      if (!this.suppressTap) this.dismiss();
      this.suppressTap = false;
    },

    blockScroll() {},

    expandTimerPlan() {
      this.setData({ expanded: true });
    },

    collapseTimerPlan() {
      if (this.data.expanded) this.setData({ expanded: false });
    },

    dismiss() {
      if (this.data.openingEntry) return;
      clearInterval(this.ticker);
      this.triggerEvent("dismiss");
    },
  },
});
