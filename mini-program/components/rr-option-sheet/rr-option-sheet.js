Component({
  properties: {
    items: { type: Array, value: [] },
    selected: { type: String, value: "" },
    label: { type: String, value: "" },
  },
  data: { expanded: false },
  methods: {
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
      if (travel < 0 && !this.data.expanded) {
        // The rows can wrap. Check the actual list height before snapping open.
        this.createSelectorQuery().select(".options-scroll").fields({ size: true, scrollOffset: true }).exec(([list]) => {
          if (list && list.scrollHeight > list.height + 1) this.setData({ expanded: true });
        });
      } else if (travel > 0 && start.atTop) {
        if (this.data.expanded) this.setData({ expanded: false });
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
