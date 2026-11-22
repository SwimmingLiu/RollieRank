const { drawRadar } = require("../../utils/report.js");

Component({
  properties: {
    bands: { type: Array, value: [], observer: "draw" },
  },
  data: { src: "" },
  lifetimes: {
    ready() {
      this.mounted = true;
      this.draw();
    },
    detached() {
      this.mounted = false;
    },
  },
  pageLifetimes: {
    resize() {
      this.draw();
    },
  },
  methods: {
    draw() {
      if (!this.mounted || !this.data.bands?.length) return;
      const ticket = (this.drawTicket || 0) + 1;
      this.drawTicket = ticket;
      const query = this.createSelectorQuery();
      query.select(".radar__wrap").boundingClientRect();
      query.select("#plot").fields({ node: true });
      query.exec(([box, canvasField]) => {
        if (!this.mounted || ticket !== this.drawTicket || !canvasField?.node || !box?.width || !box?.height) return;
        const canvas = canvasField.node;
        const width = Math.round(box.width);
        const height = Math.round(box.height);
        const dpr = wx.getWindowInfo?.().pixelRatio || 2;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);
        drawRadar(ctx, this.data.bands, 0, 0, width, height);
        wx.canvasToTempFilePath({
          canvas,
          fileType: "png",
          destWidth: canvas.width,
          destHeight: canvas.height,
          success: result => {
            if (this.mounted && ticket === this.drawTicket) this.setData({ src: result.tempFilePath });
          },
        });
      });
    },
  },
});
