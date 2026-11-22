const api = require("../../services/api.js");
const profile = require("../../services/profile.js");
const storage = require("../../utils/storage.js");
const { IS_TEST_ENVIRONMENT, storageKey } = require("../../config.js");

function avatarFor(seed) {
  const value = String(seed || "卷友");
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  return "/assets/avatars/rank-" + (hash % 8 + 1) + ".svg";
}

function relativeTime(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  const now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((day - value) / 86400000);
  const time = String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  if (days === 0) return "今天 " + time;
  if (days === 1) return "昨天 " + time;
  if (days > 1 && days < 7) return days + "天前";
  return date.getFullYear() === now.getFullYear()
    ? date.getMonth() + 1 + "月" + date.getDate() + "日"
    : date.getFullYear() + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日";
}

async function quietWxCode() {
  // 验收包的评论直接交给隔离后端。
  if (IS_TEST_ENVIRONMENT) return "";
  try {
    const res = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }));
    return typeof res?.code === "string" ? res.code : "";
  } catch {
    return "";
  }
}

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
    loadingMore: false,
    total: 0,
    draft: "",
    expandedReplies: {},
    replyByRoot: {},
    replyCursors: {},
    replyTarget: null,
    replyDraft: "",
    images: [],
    sending: false,
    canSend: false,
    composerFocus: false,
    keyboardHeight: 0,
    hasWechatProfile: false,
    uiBase: "/assets/ui",
  },

  onLoad(query) {
    this.paperId = query.paperId || "";
    this.attemptId = query.attemptId || "";
    this.draftKey = storageKey("rr:discussion:" + this.paperId);
    this.profileSignature = this.currentProfileSignature();
    const saved = wx.getStorageSync(this.draftKey);
    const draft = typeof saved === "string" ? saved : saved?.draft || "";
    const replyDraft = saved?.replyDraft || "";
    const replyTarget = saved?.replyTarget || null;
    this.setData({
      draft,
      replyDraft,
      replyTarget,
      hasWechatProfile: storage.hasWechatProfile(),
      canSend: Boolean((replyTarget ? replyDraft : draft).trim()),
    });
    this.load();
  },

  onShow() {
    const nextSignature = this.currentProfileSignature();
    const hasWechatProfile = storage.hasWechatProfile();
    if (hasWechatProfile !== this.data.hasWechatProfile) {
      this.setData({ hasWechatProfile });
    }
    if (this.profileSignature && nextSignature !== this.profileSignature) {
      this.profileSignature = nextSignature;
      this.refreshAfterProfileChange();
    }
  },

  currentProfileSignature() {
    return [storage.name(), storage.avatarId(), storage.avatarUrl()].join("|");
  },

  async refreshAfterProfileChange() {
    if (!this.paperId || this.data.loading) return;
    await this.load();
    const expandedIds = Object.keys(this.data.expandedReplies).filter(id => this.data.expandedReplies[id]);
    await Promise.all(expandedIds.map(id => this.loadReplies(id)));
  },

  openProfile() {
    wx.navigateTo({ url: "/pages/profile/profile" });
  },

  retry() {
    this.setData({ loading: true, error: "" });
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
      avatar: profile.authorAvatarUrl(comment.author) || avatarFor(comment.author?.avatarSeed || comment.author?.name),
      timeText: relativeTime(comment.createdAt),
      target: comment.replyTo?.name || "",
      moderationText: comment.moderationStatus === "pending" || comment.moderationStatus === "flagged" ? "审核中" : "",
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
    const value = event.detail.value;
    this.setData({ [field]: value, canSend: Boolean(value.trim() || this.data.images.length) });
    this.saveDraft();
  },

  onComposerBlur() {
    if (this.data.composerFocus) this.setData({ composerFocus: false });
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
      const nextImages = [...this.data.images, ...images].slice(0, 3);
      this.setData({ images: nextImages, canSend: Boolean(nextImages.length || (this.data.replyTarget ? this.data.replyDraft : this.data.draft).trim()) });
    } catch (error) {
      if (!String(error.errMsg || "").includes("cancel")) wx.showToast({ title: "图片读取失败，请重试", icon: "none" });
    }
  },

  removeImage(event) {
    const images = this.data.images.filter((_, index) => index !== Number(event.currentTarget.dataset.index));
    const active = this.data.replyTarget ? this.data.replyDraft : this.data.draft;
    this.setData({ images, canSend: Boolean(images.length || active.trim()) });
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
      const wxCode = await quietWxCode();
      const result = await api.request("discussions", {
        paperId: this.paperId,
        attemptId: this.attemptId,
        guestId: storage.guestId(),
        clientId: this.clientId,
        nickname: storage.name(),
        text,
        links,
        images: images.map(({ dataUri }) => ({ dataUri })),
        ...(wxCode ? { wxCode } : {}),
        ...(replyTarget ? { parentId: replyTarget.id } : {}),
      });
      this.identity = null;
      const nextDraft = replyTarget ? this.data.draft : "";
      this.setData({ images: [], canSend: Boolean(nextDraft.trim()), composerFocus: false, ...(replyTarget ? { replyDraft: "", replyTarget: null } : { draft: "" }) });
      this.saveDraft();
      wx.hideKeyboard();
      if (result.comment?.moderationStatus === "pending" || result.comment?.moderationStatus === "flagged") {
        wx.showToast({ title: "已提交，审核通过后公开", icon: "none" });
      }
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
    this.replyRequests ||= {};
    const request = this.replyRequests[id] = (this.replyRequests[id] || 0) + 1;
    try {
      const previous = this.data.replyByRoot[id] || [];
      const cursor = more && this.data.replyCursors[id]
        ? "&before=" + encodeURIComponent(this.data.replyCursors[id])
        : "";
      const result = await api.request("discussions/replies?" + this.query() + "&rootId=" + encodeURIComponent(id) + cursor);
      if (request !== this.replyRequests[id]) return;
      const replies = result.comments.map(comment => this.decorate(comment));
      this.setData({
        expandedReplies: { ...this.data.expandedReplies, [id]: true },
        replyByRoot: { ...this.data.replyByRoot, [id]: more ? [...previous, ...replies] : replies },
        replyCursors: { ...this.data.replyCursors, [id]: result.nextCursor || "" },
      });
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  toggleReplies(event) {
    const { id } = event.currentTarget.dataset;
    if (this.data.expandedReplies[id]) {
      this.replyRequests ||= {};
      this.replyRequests[id] = (this.replyRequests[id] || 0) + 1;
      const expandedReplies = { ...this.data.expandedReplies };
      delete expandedReplies[id];
      this.setData({ expandedReplies });
    } else {
      this.loadReplies(id);
    }
  },

  moreReplies(event) {
    const { root } = event.currentTarget.dataset;
    if (root && this.data.replyCursors[root]) this.loadReplies(root, true);
  },

  startReply(event) {
    const { id, name, root } = event.currentTarget.dataset;
    this.setData({
      replyTarget: { id, name, rootId: root || id },
      composerFocus: true,
      canSend: Boolean(this.data.replyDraft.trim() || this.data.images.length),
    });
    this.saveDraft();
  },

  cancelReply() {
    this.setData({
      replyTarget: null,
      replyDraft: "",
      composerFocus: false,
      canSend: Boolean(this.data.draft.trim() || this.data.images.length),
    });
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
        const replyByRoot = Object.fromEntries(Object.entries(this.data.replyByRoot)
          .map(([root, replies]) => [root, update(replies)]));
        this.setData({ comments: update(this.data.comments), replyByRoot });
      }
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  previewImage(event) {
    wx.previewImage({
      urls: [...this.data.comments, ...Object.values(this.data.replyByRoot).flat()].flatMap(item => item.images),
      current: event.currentTarget.dataset.src,
    });
  },

  copyExternalLink(event) {
    wx.setClipboardData({ data: event.currentTarget.dataset.link });
  },
});
