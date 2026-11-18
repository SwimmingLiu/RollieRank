const { drawRadar } = require("../../utils/report.js");

Component({
  properties: {
    bands: { type: Array, value: [], observer: "draw" },
  },
  lifetimes: {
    ready() {
      this.draw();
    },
  },
  pageLifetimes: {
    resize() {
      this.draw();
    },
  },
  methods: {
    draw() {
      this.createSelectorQuery().select("#plot").fields({ node: true, size: true }).exec(([size]) => {
        if (!size?.node || !size.width || !size.height) return;
        const { node, width, height } = size;
        const dpr = wx.getWindowInfo().pixelRatio || 1;
        node.width = Math.round(width * dpr);
        node.height = Math.round(height * dpr);
        const ctx = node.getContext("2d");
        ctx.scale(dpr, dpr);
        drawRadar(ctx, this.data.bands, 0, 0, width, height);
      });
    },
  },
});
