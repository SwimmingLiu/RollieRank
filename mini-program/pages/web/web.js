const { ASSET, WEB_APP_ORIGIN } = require("../../config.js");
const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const { linkQuery, validTicket } = require("../../utils/web-bridge.js");

function markedNumbers(marks) {
  if (!Array.isArray(marks)) return [];
  return marks.flatMap((marked, index) => marked ? [index + 1] : []);
}

function localSession() {
  const keys = wx.getStorageInfoSync().keys;
  const drafts = [];
  const marks = [];
  const draftPrefix = storage.KEYS.draft("");
  const markPrefix = storage.KEYS.marks("");
  for (const key of keys) {
    if (key.startsWith(draftPrefix)) {
      const versionId = key.slice(draftPrefix.length);
      const draft = storage.loadDraft(versionId);
      if (!Array.isArray(draft?.answers) || !draft.answers.length) continue;
      drafts.push({
        id: draft.id || storage.pendingId(versionId),
        versionId,
        answers: draft.answers,
        marks: markedNumbers(draft.marks),
        current: Number(draft.current) || 1,
        single: Boolean(draft.single),
        updatedAt: Number(draft.updatedAt) || 0,
      });
    } else if (key.startsWith(markPrefix)) {
      const id = key.slice(markPrefix.length);
      if (/^[\w-]{10,80}$/.test(id)) marks.push([id, markedNumbers(wx.getStorageSync(key))]);
    }
  }
  return {
    guestId: storage.guestId(), name: storage.name(), avatarId: storage.avatarId(), avatarUrl: storage.avatarUrl(),
    drafts, marks,
  };
}

Page({
  data: { src: "", error: "", logo: ASSET.logo },

  onLoad(query) {
    this.paper = linkQuery(query);
    this.start();
  },

  async start() {
    if (!WEB_APP_ORIGIN) {
      this.backToNative();
      return;
    }
    this.setData({ src: "", error: "" });
    try {
      const session = localSession();
      const { ticket, receiver } = await api.request("miniprogram-web/bootstrap", session);
      if (this.destroyed) return;
      this.receiver = receiver;
      this.profile = [session.name, session.avatarId, session.avatarUrl].join(":");
      const window = wx.getWindowInfo();
      const screenBottom = window.screenTop + window.windowHeight;
      const nativeTop = Math.max(window.screenTop, (window.statusBarHeight || 0) + 44);
      const bottom = Math.max(0, screenBottom - (window.safeArea?.bottom ?? screenBottom));
      // WebView reserves the native title bar even when the app shell uses custom navigation.
      const query = "design=paper-cards-1114-v3&embed=wechat&wxHeight=" + (screenBottom - nativeTop) + "&wxBottom=" + bottom;
      this.setData({ src: WEB_APP_ORIGIN + "/ios-v3/app.html?" + query + (this.resumeRecords ? "&page=me" : this.paper) + "#rr=" + ticket });
      this.listen();
    } catch (error) {
      this.setData({ error: error.message });
    }
  },

  onReady() {
    wx.hideHomeButton?.();
  },

  onShow() {
    this.visible = true;
    if (this.data.src && this.profile !== [storage.name(), storage.avatarId(), storage.avatarUrl()].join(":")) {
      // Returning from native profile editing restores records under the same practice identity.
      this.resumeRecords = true;
      this.start();
      return;
    }
    this.listen();
  },

  onHide() {
    this.visible = false;
    clearTimeout(this.listenRetry);
  },

  onUnload() {
    this.onHide();
    this.destroyed = true;
  },

  async listen() {
    if (!this.visible || !this.receiver || this.listeningReceiver === this.receiver) return;
    const receiver = this.receiver;
    this.listeningReceiver = receiver;
    let delay = 0;
    try {
      while (this.visible && receiver === this.receiver) {
        const { action } = await api.request("miniprogram-web/listen", { receiver }, 28000);
        if (!action || !this.visible || receiver !== this.receiver) continue;
        if (action.kind === "poster" && validTicket(action.ticket)) {
          await wx.navigateTo({ url: "/pages/web-action/web-action?kind=poster&ticket=" + action.ticket });
        } else if (action.kind === "invite") {
          await wx.navigateTo({ url: "/pages/web-action/web-action?kind=invite" + linkQuery(action) });
        } else if (action.kind === "profile") {
          await wx.navigateTo({ url: "/pages/profile/profile" });
        } else if (action.kind === "title") {
          wx.setNavigationBarTitle({ title: action.title });
        }
      }
    } catch (error) {
      if (error.statusCode === 410 && receiver === this.receiver) this.receiver = "";
      delay = 2000;
    } finally {
      if (this.listeningReceiver === receiver) this.listeningReceiver = "";
      if (this.visible && this.receiver === receiver) this.listenRetry = setTimeout(() => this.listen(), delay);
    }
  },

  onWebError() {
    this.setData({ src: "", error: "页面打开失败，请重试。" });
  },

  backToNative() {
    getApp().globalData.openNativeHome = true;
    wx.switchTab({ url: "/pages/home/home" });
  },

  onShareAppMessage(event) {
    const params = {};
    const query = event.webViewUrl?.split("?")[1]?.split("#")[0] || "";
    for (const field of query.split("&")) {
      const [key, value] = field.split("=");
      if (key === "institution" || key === "paper" || key === "period") {
        try { params[key] = decodeURIComponent(value || ""); } catch {}
      }
    }
    return { title: "卷卷小榜 · 同卷练习", path: "/pages/web/web?share=1" + linkQuery(params) };
  },
});
