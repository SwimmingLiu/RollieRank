const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const format = require("../../utils/format.js");

async function photoAsPng(tempFilePath) {
  const canvas = wx.createOffscreenCanvas({ type: "2d", width: 1, height: 1 });
  const image = canvas.createImage();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = tempFilePath;
  });
  const scale = Math.min(1, 480 / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return { path: tempFilePath, dataUri: canvas.toDataURL("image/png") };
}

Page({
  data: {
    loading: true,
    error: "",
    comments: [],
    nextCursor: "",
    replyCursor: "",
    loadingMore: false,
    total: 0,
    draft: "",
    expanded: "",
    replies: [],
    replyTarget: null,
    replyDraft: "",
    images: [],
    sending: false,
    keyboardHeight: 0,
    initials: "",
    uiBase: "/assets/ui",
  },

  onLoad(query) {
    this.paperId = query.paperId || "";
    this.attemptId = query.attemptId || "";
    this.draftKey = "rr:discussion:" + this.paperId;
    const saved = wx.getStorageSync(this.draftKey);
    const draft = typeof saved === "string" ? saved : saved?.draft || "";
    this.setData({
      draft,
      replyDraft: saved?.replyDraft || "",
      replyTarget: saved?.replyTarget || null,
      initials: Array.from(storage.name()).slice(0, 2).join(""),
    });
    this.load();
  },

  onReachBottom() {
    if (this.data.nextCursor && !this.data.loadingMore) this.load(true);
  },

  query() {
    return "paperId=" + encodeURIComponent(this.paperId) + "&guestId=" + encodeURIComponent(storage.guestId()) +
      "&attemptId=" + encodeURIComponent(this.attemptId);
  },

  async load(more = false) {
    if (this.data.loadingMore) return;
    this.setData({ loadingMore: true });
    try {
      const cursor = more ? "&before=" + encodeURIComponent(this.data.nextCursor) : "";
      const result = await api.request("discussions?" + this.query() + cursor);
      this.attemptId ||= result.attemptId || "";
      const comments = result.comments.map(comment => this.decorate(comment));
      this.setData({
        loading: false,
        comments: more ? [...this.data.comments, ...comments.filter(comment => !this.data.comments.some(existing => existing.id === comment.id))] : comments,
        nextCursor: result.nextCursor || "",
        total: result.total || 0,
      });
    } catch (error) {
      if (more) wx.showToast({ title: error.message, icon: "none" });
      else this.setData({ loading: false, error: error.message });
    } finally {
      this.setData({ loadingMore: false });
    }
  },

  decorate(comment) {
    return {
      ...comment,
      initials: Array.from(comment.author?.name || "卷友").slice(0, 2).join(""),
      timeText: format.dateTime(comment.createdAt).replace(/-/g, "/"),
      target: comment.replyTo?.name || "",
      images: (comment.images || []).map(image => image.dataUri),
    };
  },

  saveDraft() {
    const { draft, replyDraft, replyTarget } = this.data;
    if (draft || replyDraft) wx.setStorageSync(this.draftKey, { draft, replyDraft, replyTarget });
    else wx.removeStorageSync(this.draftKey);
  },

  onComposerInput(event) {
    const field = this.data.replyTarget ? "replyDraft" : "draft";
    this.setData({ [field]: event.detail.value });
    this.saveDraft();
  },

  keyboard(event) {
    this.setData({ keyboardHeight: event.detail.height || 0 });
  },

  async pickImage() {
    const count = 3 - this.data.images.length;
    if (count <= 0) return;
    try {
      const batch = await wx.chooseMedia({ count, mediaType: ["image"], sourceType: ["album", "camera"] });
      const images = await Promise.all(batch.tempFiles.map(file => photoAsPng(file.tempFilePath)));
      this.setData({ images: [...this.data.images, ...images].slice(0, 3) });
    } catch (error) {
      if (!String(error.errMsg || "").includes("cancel")) wx.showToast({ title: "图片读取失败，请重试", icon: "none" });
    }
  },

  removeImage(event) {
    this.setData({ images: this.data.images.filter((_, index) => index !== Number(event.currentTarget.dataset.index)) });
  },

  async sendComposer() {
    const { draft, replyDraft, replyTarget, images, sending } = this.data;
    const text = (replyTarget ? replyDraft : draft).trim();
    if (sending || (!text && !images.length)) return;
    const links = [...new Set(text.match(/https?:\/\/[^\s<>"，。！？]+/g) || [])].slice(0, 3);
    const identity = JSON.stringify([text, replyTarget?.id, images.map(image => image.path)]);
    if (this.identity !== identity) {
      this.clientId = storage.uuid();
      this.identity = identity;
    }
    this.setData({ sending: true });
    try {
      const result = await api.request("discussions", {
        paperId: this.paperId,
        attemptId: this.attemptId,
        guestId: storage.guestId(),
        clientId: this.clientId,
        nickname: storage.name(),
        text,
        links,
        images: images.map(({ dataUri }) => ({ dataUri })),
        ...(replyTarget ? { parentId: replyTarget.id } : {}),
      });
      this.identity = null;
      this.setData({ images: [], ...(replyTarget ? { replyDraft: "", replyTarget: null } : { draft: "" }) });
      this.saveDraft();
      wx.hideKeyboard();
      if (replyTarget) {
        await this.loadReplies(replyTarget.rootId || replyTarget.id);
        await this.load();
      } else if (result.comment) {
        const comment = this.decorate(result.comment);
        this.setData({ comments: [comment, ...this.data.comments.filter(existing => existing.id !== comment.id)], total: this.data.total + 1 });
      } else {
        await this.load();
      }
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    } finally {
      this.setData({ sending: false });
    }
  },

  async loadReplies(id, more = false) {
    const request = this.replyRequest = (this.replyRequest || 0) + 1;
    try {
      const cursor = more ? "&before=" + encodeURIComponent(this.data.replyCursor) : "";
      const result = await api.request("discussions/replies?" + this.query() + "&rootId=" + encodeURIComponent(id) + cursor);
      if (request !== this.replyRequest) return;
      const replies = result.comments.map(comment => this.decorate(comment));
      this.setData({ expanded: id, replies: more ? [...this.data.replies, ...replies] : replies, replyCursor: result.nextCursor || "" });
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  toggleReplies(event) {
    const { id } = event.currentTarget.dataset;
    if (this.data.expanded === id) {
      this.replyRequest += 1;
      this.setData({ expanded: "", replies: [], replyCursor: "" });
    } else {
      this.loadReplies(id);
    }
  },

  moreReplies() {
    if (this.data.expanded && this.data.replyCursor) this.loadReplies(this.data.expanded, true);
  },

  startReply(event) {
    const { id, name, root } = event.currentTarget.dataset;
    this.setData({ replyTarget: { id, name, rootId: root || id } });
    this.saveDraft();
  },

  cancelReply() {
    this.setData({ replyTarget: null, replyDraft: "", images: [] });
    this.saveDraft();
  },

  async toggleLike(event) {
    const { id, liked } = event.currentTarget.dataset;
    try {
      const result = await api.request("discussions/like", {
        paperId: this.paperId, attemptId: this.attemptId, guestId: storage.guestId(), commentId: id, liked: !liked,
      });
      if (result.comment) {
        const comment = this.decorate(result.comment);
        const update = list => list.map(item => item.id === id ? comment : item);
        this.setData({ comments: update(this.data.comments), replies: update(this.data.replies) });
      }
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  previewImage(event) {
    wx.previewImage({ urls: [...this.data.comments, ...this.data.replies].flatMap(item => item.images), current: event.currentTarget.dataset.src });
  },

  copyExternalLink(event) {
    wx.setClipboardData({ data: event.currentTarget.dataset.link });
  },
});
