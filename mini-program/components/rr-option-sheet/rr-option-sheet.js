Component({
  properties: {
    items: { type: Array, value: [], observer: "itemsChanged" },
    selected: { type: String, value: "" },
    label: { type: String, value: "" },
  },
  data: { expanded: false, listHeight: 0 },
  lifetimes: {
    ready() {
      this.layoutReady = true;
      this.measureList();
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
      const limit = expanded ? this.expandedHeight : this.compactHeight;
      this.setData({ expanded, listHeight: Math.min(this.contentHeight, limit) });
    },
    onScroll(event) {
      this.scrollTop = event.detail.scrollTop;
    },
    startTouch(event) {
      if (event.touches.length !== 1) return;
      const { pageX, pageY } = event.touches[0];
      this.touch = { pageX, pageY, atTop: !this.scrollTop || this.scrollTop <= 1 };
    },
    endTouch(event) {
      const start = this.touch;
      this.touch = undefined;
      const end = event.changedTouches[0];
      if (!start || !end) return;
      const travel = end.pageY - start.pageY;
      if (Math.abs(travel) < 38 || Math.abs(travel) < Math.abs(end.pageX - start.pageX)) return;
      if (travel < 0 && !this.data.expanded && this.contentHeight > this.compactHeight) {
        this.resizeList(true);
      } else if (travel > 0 && start.atTop) {
        if (this.data.expanded) this.resizeList(false);
        else this.dismiss();
      }
    },
    cancelTouch() {
      this.touch = undefined;
    },
    ignoreTouch() {},
    dismiss() {
      this.triggerEvent("dismiss");
    },
    select(event) {
      this.triggerEvent("select", { key: event.currentTarget.dataset.key });
    },
  },
});
