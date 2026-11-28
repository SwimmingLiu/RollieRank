Component({
  options: {
    virtualHost: true,
  },

  properties: {
    bottom: {
      type: Number,
      value: 96,
    },
  },

  data: {
    visible: false,
    text: "",
    tone: "ok",
    uiBase: "/assets/ui",
  },

  lifetimes: {
    detached() {
      clearTimeout(this._timer);
      this._timer = null;
    },
  },

  methods: {
    show(text, options) {
      const opts = options && typeof options === "object" ? options : {};
      const message = String(text || "").trim();
      if (!message) return;
      const duration = Number(opts.duration) > 0 ? Number(opts.duration) : 2000;
      const tone = opts.tone === "warn" ? "warn" : "ok";
      clearTimeout(this._timer);
      this.setData({ visible: true, text: message, tone });
      this._timer = setTimeout(() => {
        this._timer = null;
        this.setData({ visible: false });
      }, duration);
    },

    hide() {
      clearTimeout(this._timer);
      this._timer = null;
      if (this.data.visible) this.setData({ visible: false });
    },
  },
});
