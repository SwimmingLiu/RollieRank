const sheetGesture = require("../../utils/sheet-gesture.js");

Component({
  properties: {
    items: { type: Array, value: [], observer: "itemsChanged" },
    selected: { type: String, value: "" },
    label: { type: String, value: "" },
  },
  data: { expanded: false, canExpand: false, listHeight: 0, liveListHeight: 0, dragY: 0, dragging: false, closing: false, shadeOpacity: 1 },
  lifetimes: {
    ready() {
      this.layoutReady = true;
      this.measureList();
    },
    detached() {
      clearTimeout(this.closeTimer);
    },
  },
  pageLifetimes: {
    resize() {
      this.measureList();
    },
  },
  methods: {
    itemsChanged() {
      if (this.layoutReady) this.setData({ listHeight: 0 }, () => this.measureList());
    },
    measureList() {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      if (!info.windowHeight) return;
      this.createSelectorQuery().select(".options-content").boundingClientRect(content => {
        if (!content) return;
        this.contentHeight = Math.ceil(content.height);
        this.compactHeight = Math.floor(info.windowHeight * .48);
        this.expandedHeight = Math.floor(info.windowHeight * .76);
        this.resizeList(this.data.expanded);
      }).exec();
    },
    resizeList(expanded) {
      const compactTarget = Math.min(this.contentHeight || 0, this.compactHeight || 0);
      const expandedTarget = Math.min(this.contentHeight || 0, this.expandedHeight || 0);
      const canExpand = expandedTarget - compactTarget >= 16;
      const nextExpanded = Boolean(expanded && canExpand);
      this.compactListHeight = compactTarget;
      this.expandedListHeight = expandedTarget;
      this.setData({ expanded: nextExpanded, canExpand, listHeight: nextExpanded ? expandedTarget : compactTarget, liveListHeight: 0 });
    },
    onScroll(event) {
      this.scrollTop = event.detail.scrollTop;
    },
    resetDrag() {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
      if (this.data.dragY || this.data.liveListHeight || this.data.dragging || this.data.closing || this.data.shadeOpacity !== 1) {
        this.setData({ dragY: 0, liveListHeight: 0, dragging: false, closing: false, shadeOpacity: 1 });
      }
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
    startTouch(event) {
      clearTimeout(this.closeTimer);
      if (this.data.closing) this.setData({ closing: false, dragging: true });
      if (event.touches.length !== 1) {
        this.touch = null;
        return;
      }
      const { clientX, clientY, pageX, pageY } = event.touches[0];
      const fromHandle = event.currentTarget?.dataset?.zone === "handle";
      this.suppressTap = false;
      this.touch = sheetGesture.createSheetSession({
        x: Number.isFinite(clientX) ? clientX : pageX,
        y: Number.isFinite(clientY) ? clientY : pageY,
        now: Date.now(),
        panelHeight: (this.compactListHeight || this.data.listHeight || 320) + 40,
        expandDelta: Math.max(0, (this.expandedListHeight || 0) - (this.compactListHeight || 0)),
        expanded: this.data.expanded,
        canExpand: this.data.canExpand,
        canDismiss: true,
        atTop: !this.scrollTop || this.scrollTop <= 1,
        fromHandle,
      });
    },
    moveTouch(event) {
      if (!this.touch || !event.touches?.[0]) return;
      const { clientX, clientY, pageX, pageY } = event.touches[0];
      const state = sheetGesture.updateSheetSession(this.touch, {
        x: Number.isFinite(clientX) ? clientX : pageX,
        y: Number.isFinite(clientY) ? clientY : pageY,
        now: Date.now(),
      });
      if (!state.active) return;
      this.suppressTap = true;
      const baseHeight = this.data.expanded ? (this.expandedListHeight || this.data.listHeight) : (this.compactListHeight || this.data.listHeight);
      const liveListHeight = state.heightDelta && baseHeight ? Math.max(80, baseHeight + state.heightDelta) : 0;
      if (state.offsetY !== this.data.dragY || liveListHeight !== this.data.liveListHeight || !this.data.dragging || state.shadeOpacity !== this.data.shadeOpacity) {
        this.setData({ dragY: state.offsetY, liveListHeight, dragging: true, closing: false, shadeOpacity: state.shadeOpacity });
      }
    },
    endTouch(event) {
      const start = this.touch;
      this.touch = null;
      const end = event.changedTouches?.[0];
      if (!start || !end) {
        this.resetDrag();
        return;
      }
      const result = sheetGesture.finishSheetSession(start, {
        x: Number.isFinite(end.clientX) ? end.clientX : end.pageX,
        y: Number.isFinite(end.clientY) ? end.clientY : end.pageY,
        now: Date.now(),
      });
      if (result.moved) {
        this.suppressTap = true;
        setTimeout(() => { this.suppressTap = false; }, 80);
      }
      if (result.action === "expand") {
        this.resetDrag();
        this.resizeList(true);
      } else if (result.action === "collapse") {
        this.resetDrag();
        this.resizeList(false);
      } else if (result.action === "dismiss") {
        this.animateDismiss();
      } else {
        this.resetDrag();
      }
    },
    cancelTouch() {
      this.touch = null;
      this.resetDrag();
    },
    ignoreTouch() {},
    dismiss() {
      this.triggerEvent("dismiss");
    },
    select(event) {
      if (this.suppressTap) return;
      this.triggerEvent("select", { key: event.currentTarget.dataset.key });
    },
  },
});
