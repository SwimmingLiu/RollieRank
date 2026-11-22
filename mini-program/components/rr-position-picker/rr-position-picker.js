const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const sheetGesture = require("../../utils/sheet-gesture.js");

const FIELDS = { source: "sourceId", category: "categoryId", department: "departmentId", unit: "unitId" };
const EXAMS = [{ key: "guokao", label: "国考" }, { key: "shengkao", label: "省考" }];

Component({
  options: { styleIsolation: "apply-shared" },
  properties: { mode: { type: String, value: "select" } },
  data: {
    exams: EXAMS, exam: "guokao", level: "source", breadcrumbs: [],
    options: [], page: 1, pages: 1, keyword: "", searchable: false,
    loading: true, error: "", emptyText: "", detail: null, selectedId: "", saving: false,
    expanded: false, canExpand: false, panelHeight: 0, listHeight: 0, liveListHeight: 0,
    dragY: 0, dragging: false, closing: false, shadeOpacity: 1,
    uiBase: "/assets/ui",
  },

  lifetimes: {
    attached() {
      this.sequence = 0;
      this.panelHeight = 0;
      this.expandedPanelHeight = 0;
      this.suppressTap = false;
      this.path = {};
      const saved = storage.position();
      if (saved && this.data.mode === "select") this.path = { positionId: saved.id };
      this.setData({ selectedId: saved?.id || "", exam: saved?.exam || "guokao" });
      this.load().finally(() => this.scheduleMeasure());
    },
    detached() {
      clearTimeout(this.searchTimer);
      clearTimeout(this.closeTimer);
      clearTimeout(this.suppressTapTimer);
      this.sequence += 1;
    },
  },

  methods: {
    async load(more = false) {
      clearTimeout(this.searchTimer);
      const sequence = ++this.sequence;
      const keyword = this.data.keyword.trim();
      this.setData({ loading: true, error: "" });
      try {
        if (!Object.keys(this.path).length) {
          const { sources } = await api.request("positions/catalog?pageSize=1");
          if (sequence !== this.sequence) return;
          const matches = sources.filter(source => source.exam === this.data.exam);
          const options = matches
            .filter(source => !keyword || `${source.year} ${source.region} ${source.label}`.includes(keyword))
            .map(source => ({ id: source.id, label: `${source.year}年 · ${source.region}` }));
          this.setData({
            options, level: "source", breadcrumbs: [], page: 1, pages: 1,
            searchable: matches.length > 10 || Boolean(keyword),
            emptyText: matches.length ? "没有匹配的目录" : this.data.exam === "shengkao" ? "暂无省考岗位目录" : "暂无国考岗位目录",
            loading: false,
          }, () => this.scheduleMeasure());
          return;
        }
        const next = { ...this.path, pageSize: 40 };
        if (keyword) next.q = keyword;
        if (!next.positionId) next.page = more ? this.data.page + 1 : 1;
        const query = Object.entries(next).map(([key, value]) => key + "=" + encodeURIComponent(value)).join("&");
        const result = await api.request("positions/hierarchy?" + query);
        if (sequence !== this.sequence) return;
        this.path = this.pathFrom(result.breadcrumbs);
        if (!keyword && result.autoAdvance && FIELDS[result.level]) {
          this.path[FIELDS[result.level]] = result.options[0].id;
          await this.load();
          return;
        }
        const source = result.source;
        const breadcrumbs = result.breadcrumbs
          .filter(crumb => crumb.level !== "position")
          .map(crumb => crumb.level === "source" ? { ...crumb, label: `${source.year}年 · ${source.region}` } : crumb);
        const additions = result.options.map(option => ({
          ...option,
          label: option.label || (result.level === "category" ? "直接选择招录部门" : "未分单位"),
        }));
        this.source = source;
        this.setData({
          level: result.level, exam: source?.exam || this.data.exam, breadcrumbs,
          options: more ? [...this.data.options, ...additions] : additions,
          page: result.page, pages: result.pages, loading: false,
          searchable: result.total > 10 || Boolean(keyword) || (this.data.level === result.level && this.data.searchable),
          emptyText: "没有匹配的岗位",
        }, () => this.scheduleMeasure());
      } catch (error) {
        if (sequence !== this.sequence) return;
        if (error.statusCode === 404 && this.path.positionId) {
          this.path = {};
          await this.load();
          return;
        }
        this.setData({ loading: false, error: error.message });
      }
    },

    pathFrom(crumbs) {
      return Object.fromEntries(crumbs.filter(crumb => FIELDS[crumb.level]).map(crumb => [FIELDS[crumb.level], crumb.id]));
    },

    reset(path, patch = {}) {
      this.path = path;
      this.scrollTop = 0;
      this.collapsedListHeight = 0;
      this.expandedListHeight = 0;
      this.setData({ options: [], keyword: "", searchable: false, expanded: false, canExpand: false, liveListHeight: 0, dragY: 0, dragging: false, ...patch });
      this.load();
    },

    chooseExam(event) {
      const exam = event.currentTarget.dataset.exam;
      if (!this.data.saving && exam !== this.data.exam) this.reset({}, { exam, detail: null });
    },

    choose(event) {
      if (this.suppressTap || this.data.loading || this.data.saving) return;
      const option = this.data.options.find(item => item.id === event.currentTarget.dataset.id);
      if (!option) return;
      if (option.position) {
        this.scrollTop = 0;
        this.collapsedListHeight = 0;
        this.expandedListHeight = 0;
        this.setData({ detail: option.position, expanded: false, canExpand: false, liveListHeight: 0, listHeight: 0 }, () => this.scheduleMeasure());
      } else {
        this.reset({ ...this.path, [FIELDS[this.data.level]]: option.id });
      }
    },

    onKeyword(event) {
      this.setData({ keyword: event.detail.value });
      this.sequence += 1;
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.load(), 250);
    },

    search() { this.load(); },
    clearSearch() { this.setData({ keyword: "" }); this.load(); },
    loadMore() { if (!this.data.loading && this.data.page < this.data.pages) this.load(true); },
    closeDetail() {
      if (!this.data.saving) {
        this.scrollTop = 0;
        this.collapsedListHeight = 0;
        this.expandedListHeight = 0;
        this.setData({ detail: null, expanded: false, canExpand: false, liveListHeight: 0, listHeight: 0 }, () => this.scheduleMeasure());
      }
    },
    ignoreTouch() {},
    ignoreMove() {},

    dismiss() {
      if (this.suppressTap) {
        this.suppressTap = false;
        return;
      }
      if (!this.data.saving) this.triggerEvent("dismiss");
    },

    animateDismiss() {
      clearTimeout(this.closeTimer);
      this.setData({ dragging: false, closing: true, liveListHeight: 0, shadeOpacity: 0 });
      this.closeTimer = setTimeout(() => {
        this.closeTimer = null;
        this.setData({ dragY: 0, liveListHeight: 0, dragging: false, closing: false, shadeOpacity: 1 });
        this.dismiss();
      }, sheetGesture.CLOSE_DURATION);
    },

    resetDrag() {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
      if (this.data.dragY || this.data.liveListHeight || this.data.dragging || this.data.closing || this.data.shadeOpacity !== 1) {
        this.setData({ dragY: 0, liveListHeight: 0, dragging: false, closing: false, shadeOpacity: 1 });
      }
    },

    expandDelta() {
      return Math.max(0, (this.expandedListHeight || 0) - (this.collapsedListHeight || 0));
    },

    applyDragState(state) {
      const baseHeight = this.data.expanded
        ? (this.expandedListHeight || this.data.listHeight)
        : (this.collapsedListHeight || this.data.listHeight);
      const liveListHeight = state.heightDelta && baseHeight
        ? Math.max(80, baseHeight + state.heightDelta)
        : 0;
      if (
        state.offsetY !== this.data.dragY
        || liveListHeight !== this.data.liveListHeight
        || !this.data.dragging
        || state.shadeOpacity !== this.data.shadeOpacity
      ) {
        this.setData({
          dragY: state.offsetY,
          liveListHeight,
          dragging: true,
          closing: false,
          shadeOpacity: state.shadeOpacity,
        });
      }
    },

    startGesture(event) {
      clearTimeout(this.closeTimer);
      if (this.data.closing) this.setData({ closing: false, dragging: true });
      const point = event.touches?.length === 1 && event.touches[0];
      if (!point) {
        this.gesture = null;
        return;
      }
      this.suppressTap = false;
      this.gesture = sheetGesture.createSheetSession({
        x: point.clientX,
        y: point.clientY,
        now: Date.now(),
        panelHeight: this.collapsedPanelHeight || 380,
        expandDelta: this.expandDelta(),
        expanded: this.data.expanded,
        canExpand: this.data.canExpand,
        canDismiss: true,
        atTop: !this.scrollTop || this.scrollTop <= 1,
        fromHandle: false,
      });
    },

    moveGesture(event) {
      if (!this.gesture) return;
      const point = event.touches?.[0];
      if (!point) return;
      const state = sheetGesture.updateSheetSession(this.gesture, { x: point.clientX, y: point.clientY, now: Date.now() });
      if (!state.active) return;
      this.suppressTap = true;
      this.applyDragState(state);
    },

    endGesture(event) {
      const from = this.gesture;
      this.gesture = null;
      const to = event.changedTouches?.[0];
      if (!from || !to) {
        this.resetDrag();
        return;
      }
      const result = sheetGesture.finishSheetSession(from, { x: to.clientX, y: to.clientY, now: Date.now() });
      this.suppressTap = result.moved;
      if (result.dx < -Math.max(56, (wx.getWindowInfo?.().windowWidth || 390) * .18) && Math.abs(result.dx) > Math.abs(result.dy) * 1.5) {
        this.resetDrag();
        this.goBack();
      } else if (result.action === "dismiss") {
        this.animateDismiss();
      } else if (result.action === "expand") {
        this.resetDrag();
        this.resizeList(true);
      } else if (result.action === "collapse") {
        this.resetDrag();
        this.resizeList(false);
      } else {
        this.resetDrag();
      }
      if (this.suppressTap) {
        clearTimeout(this.suppressTapTimer);
        this.suppressTapTimer = setTimeout(() => { this.suppressTap = false; }, 60);
      }
    },

    startGrabber(event) {
      clearTimeout(this.closeTimer);
      if (this.data.closing) this.setData({ closing: false, dragging: true });
      const point = event.touches?.length === 1 && event.touches[0];
      this.grabber = point ? sheetGesture.createSheetSession({
        x: point.clientX,
        y: point.clientY,
        now: Date.now(),
        panelHeight: this.collapsedPanelHeight || 380,
        expandDelta: this.expandDelta(),
        expanded: this.data.expanded,
        canExpand: this.data.canExpand,
        canDismiss: true,
        atTop: true,
        fromHandle: true,
      }) : null;
      this.grabberMoved = false;
    },

    moveGrabber(event) {
      if (!this.grabber) return;
      const point = event.touches?.[0];
      if (!point) return;
      const state = sheetGesture.updateSheetSession(this.grabber, { x: point.clientX, y: point.clientY, now: Date.now() });
      if (!state.active) return;
      this.grabberMoved = true;
      this.applyDragState(state);
    },

    endGrabber(event) {
      const from = this.grabber;
      const to = event.changedTouches?.[0];
      this.grabber = null;
      if (!from || !to) {
        this.resetDrag();
        return;
      }
      const result = sheetGesture.finishSheetSession(from, { x: to.clientX, y: to.clientY, now: Date.now() });
      this.grabberMoved = result.moved;
      if (result.dx < -60 && Math.abs(result.dx) > Math.abs(result.dy) * 1.5) {
        this.resetDrag();
        this.goBack();
      } else if (result.action === "dismiss") {
        this.animateDismiss();
      } else if (result.action === "collapse") {
        this.resetDrag();
        this.resizeList(false);
      } else if (result.action === "expand") {
        this.resetDrag();
        this.resizeList(true);
      } else {
        this.resetDrag();
      }
      if (this.grabberMoved) {
        setTimeout(() => { this.grabberMoved = false; }, 60);
      }
    },

    cancelGrabber() {
      this.grabber = null;
      this.grabberMoved = true;
      this.resetDrag();
    },

    grabberTap() {
      if (this.grabberMoved) {
        this.grabberMoved = false;
        return;
      }
      if (this.data.canExpand) this.resizeList(!this.data.expanded);
      else if (this.data.detail) this.closeDetail();
    },

    goBack() {
      if (this.data.detail) this.closeDetail();
      else if (Object.keys(this.path).length) this.reset(this.parentPath());
    },

    goCrumb(event) {
      const crumb = this.data.breadcrumbs[Number(event.currentTarget.dataset.index)];
      if (!crumb || this.data.saving) return;
      const fields = Object.values(FIELDS);
      const target = fields.indexOf(FIELDS[crumb.level]);
      const path = {};
      for (const field of fields.slice(0, Math.max(0, target))) {
        if (this.path[field]) path[field] = this.path[field];
      }
      this.reset(path, { detail: null });
    },

    cancelGesture() {
      this.gesture = null;
      this.suppressTap = true;
      this.resetDrag();
    },

    backdropTap() {
      this.dismiss();
    },

    measure() {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      if (!info.windowHeight) return;
      const query = this.createSelectorQuery();
      query.select(".positions__panel").boundingClientRect();
      query.select(".positions__list").boundingClientRect();
      query.select(".positions__list-content").boundingClientRect();
      query.exec(([panel, list, content]) => {
        if (!panel || !list) return;
        const winHeight = info.windowHeight;
        if (!this.data.expanded) this.collapsedPanelHeight = Math.ceil(panel.height);
        const topChrome = Math.max(0, Math.ceil(list.top - panel.top));
        const bottomChrome = Math.max(0, Math.ceil(panel.bottom - list.bottom));
        const totalChrome = topChrome + bottomChrome;
        const rowEstimate = this.data.options.length * 52 + (this.data.page < this.data.pages ? 44 : 0);
        const measuredContent = Math.ceil(content?.height || 0);
        this.contentHeight = this.data.detail
          ? Math.max(120, measuredContent)
          : Math.max(53, rowEstimate, measuredContent);
        this.chromeHeight = totalChrome;
        this.expandedPanelHeight = Math.floor(winHeight * .92);
        const collapsedLimit = Math.max(120, Math.floor(winHeight * .62) - totalChrome);
        const expandedLimit = Math.max(collapsedLimit, this.expandedPanelHeight - totalChrome);
        this.collapsedListHeight = Math.max(53, Math.min(this.contentHeight, collapsedLimit));
        this.expandedListHeight = Math.max(this.collapsedListHeight, Math.min(this.contentHeight, expandedLimit));
        this.applyHeight(this.data.expanded);
      });
    },

    scheduleMeasure() {
      if (this.measureTimer) clearTimeout(this.measureTimer);
      if (this.measureRetry) clearTimeout(this.measureRetry);
      this.measureTimer = setTimeout(() => this.measure(), 32);
      // Native scroll-view transitions settle after the first layout pass. The
      // retry picks up the final chrome height without depending on row pixels.
      this.measureRetry = setTimeout(() => this.measure(), 220);
    },

    applyHeight(expanded) {
      if (!this.collapsedListHeight) return;
      const canExpand = (this.expandedListHeight || 0) - this.collapsedListHeight >= 16;
      const nextExpanded = Boolean(expanded && canExpand);
      const listHeight = nextExpanded ? this.expandedListHeight : this.collapsedListHeight;
      this.setData({ expanded: nextExpanded, canExpand, listHeight, liveListHeight: 0 });
    },

    resizeList(expanded) {
      this.applyHeight(expanded);
    },

    parentPath() {
      const parent = { ...this.path };
      delete parent.positionId;
      const fields = Object.values(FIELDS);
      const present = new Set(Object.keys(parent));
      for (const field of [...fields].reverse()) {
        if (present.delete(field)) {
          delete parent[field];
          break;
        }
      }
      return parent;
    },

    blockScroll() {},

    listReachEnd() {
      if (this.data.expanded || this.data.detail) return;
      this.scrollReachedEnd = true;
    },

    listScroll(event) {
      this.scrollTop = event.detail.scrollTop || 0;
      if (this.scrollTop > 2) this.scrollReachedEnd = false;
    },

    handleShadeTouch(event) {
      const point = event.touches[0];
      this.shadeTouch = point ? { x: point.clientX, y: point.clientY } : null;
      this.shadeMoved = false;
    },

    handleShadeMove(event) {
      if (!this.shadeTouch || !event.touches[0]) return;
      const point = event.touches[0];
      this.shadeMoved = this.shadeMoved || Math.hypot(point.clientX - this.shadeTouch.x, point.clientY - this.shadeTouch.y) >= 8;
    },

    handleShadeEnd() {
      this.shadeTouch = null;
    },

    handleShadeTap() {
      if (!this.shadeMoved) this.dismiss();
      this.shadeMoved = false;
    },

    async select() {
      const position = this.data.detail;
      if (!position || this.data.saving) return;
      if (this.data.mode === "browse") {
        this.triggerEvent("selection", { position });
        return;
      }
      await this.saveSelection(position.id);
    },

    clear() {
      wx.showModal({
        title: "清除当前岗位？",
        confirmText: "清除",
        success: result => { if (result.confirm) this.saveSelection(null); },
      });
    },

    async saveSelection(positionId) {
      if (this.data.saving) return;
      this.setData({ saving: true });
      try {
        const { position } = await api.request("positions/selection", { guestId: storage.guestId(), positionId });
        const selection = position ? { id: position.id, label: [position.department, position.title].filter(Boolean).join(" · "), exam: position.exam } : null;
        storage.setPosition(selection);
        this.setData({ saving: false, selectedId: selection?.id || "" });
        this.triggerEvent("selection", { position: selection });
        wx.showToast({ title: selection ? "岗位已保存" : "已清除选岗", icon: "none" });
      } catch (error) {
        this.setData({ saving: false });
        wx.showToast({ title: error.message, icon: "none" });
      }
    },

  },
});
