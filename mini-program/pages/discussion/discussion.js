const api = require("../../services/api");
const storage = require("../../utils/storage");
const format = require("../../utils/format");
const { ASSET_BASE } = require("../../config");

const AVATARS = ["rank-1", "rank-2", "rank-3", "rank-4", "rank-5", "rank-6", "rank-7", "rank-8"];

Page({
  data: {
    loading: true,
    error: "",
    title: "",
    comments: [],
    total: 0,
    draft: "",
    draftKey: "",
    expanded: "",
    replies: [],
    replyTarget: null,
    replyDraft: "",
    assetBase: ASSET_BASE,
  },

  onLoad(query) {
    this.paperId = query.paperId || "";
    this.attemptId = query.attemptId || "";
    const title = decodeURIComponent(query.title || "试卷讨论");
    // 每张卷单独保存草稿，切换页面或返回不会串到别的讨论。
    this.draftKey = `rr:discussion:${this.paperId}`;
    this.setData({ title, draft: wx.getStorageSync(this.draftKey) || "" });
    this.load();
  },

  onUnload() {
    this.saveDraft(this.data.draft);
  },

  async load(force) {
    this.setData({ loading: !this.data.comments.length, error: "" });
    try {
      const query = `paperId=${encodeURIComponent(this.paperId)}&guestId=${encodeURIComponent(storage.guestId())}&attemptId=${encodeURIComponent(this.attemptId)}`;
      const result = await api.request(`discussions?${query}`);
      this.attemptId = this.attemptId || (result.attemptId || "");
      this.setData({
        loading: false,
        comments: (result.comments || []).map(comment => this.decorate(comment)),
        total: result.total || 0,
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  decorate(comment) {
    const seed = comment.author && comment.author.avatarSeed ? comment.author.avatarSeed : "";
    const index = seed ? parseInt(seed.slice(0, 4), 16) % AVATARS.length : 0;
    return {
      ...comment,
      avatar: `${ASSET_BASE}/assets/avatars/${AVATARS[index]}.svg`,
      timeText: format.dateTime(comment.createdAt),
      target: comment.replyTo ? comment.replyTo.name : "",
      images: (comment.images || []).map(image => image.dataUri),
    };
  },

  saveDraft(value) {
    try {
      if (value) wx.setStorageSync(this.draftKey, value);
      else wx.removeStorageSync(this.draftKey);
    } catch {
      // 草稿写入失败不阻止继续浏览，用户仍可重新输入。
    }
  },

  onDraft(event) {
    const draft = event.detail.value;
    this.setData({ draft });
    this.saveDraft(draft);
  },

  async send() {
    const text = this.data.draft.trim();
    if (!text) {
      wx.showToast({ title: "先写点内容", icon: "none" });
      return;
    }
    wx.showLoading({ title: "正在发表", mask: true });
    try {
      const result = await api.request("discussions", {
        paperId: this.paperId,
        attemptId: this.attemptId,
        guestId: storage.guestId(),
        clientId: storage.uuid(),
        nickname: storage.name(),
        text,
      });
      wx.hideLoading();
      this.setData({ draft: "" });
      this.saveDraft("");
      if (result.comment) {
        this.setData({ comments: [{ ...this.decorate(result.comment), fresh: true }, ...this.data.comments], total: this.data.total + 1 });
      } else {
        this.load(true);
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  // 回复沿用主评论的分页与点赞，展开时只拉取该条评论下的回复。
  async toggleReplies(event) {
    const { id } = event.currentTarget.dataset;
    if (this.data.expanded === id) {
      this.setData({ expanded: "", replies: [] });
      return;
    }
    wx.showLoading({ title: "正在展开", mask: false });
    try {
      const query = `paperId=${encodeURIComponent(this.paperId)}&guestId=${encodeURIComponent(storage.guestId())}&attemptId=${encodeURIComponent(this.attemptId)}&rootId=${encodeURIComponent(id)}`;
      const result = await api.request(`discussions/replies?${query}`);
      wx.hideLoading();
      this.setData({ expanded: id, replies: (result.comments || []).map(comment => this.decorate(comment)), replyTarget: { id, name: (result.rootComment || {}).name || "" } });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  startReply(event) {
    const { id, name } = event.currentTarget.dataset;
    this.setData({ replyTarget: { id, name } });
  },

  cancelReply() {
    this.setData({ replyTarget: null, replyDraft: "" });
  },

  onReplyDraft(event) {
    this.setData({ replyDraft: event.detail.value });
  },

  async sendReply() {
    const target = this.data.replyTarget;
    const text = this.data.replyDraft.trim();
    if (!target || !text) return;
    wx.showLoading({ title: "正在回复", mask: true });
    try {
      await api.request("discussions", {
        paperId: this.paperId,
        attemptId: this.attemptId,
        guestId: storage.guestId(),
        clientId: storage.uuid(),
        nickname: storage.name(),
        text,
        parentId: target.id,
      });
      wx.hideLoading();
      this.setData({ replyDraft: "" });
      await this.toggleReplies({ currentTarget: { dataset: { id: "" } } });
      this.setData({ expanded: target.id });
      await this.load(true);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  async toggleLike(event) {
    const { id, liked } = event.currentTarget.dataset;
    try {
      const result = await api.request("discussions/like", {
        paperId: this.paperId,
        attemptId: this.attemptId,
        guestId: storage.guestId(),
        commentId: id,
        liked: !liked,
      });
      if (result.comment) {
        this.setData({
          comments: this.data.comments.map(comment => comment.id === id ? this.decorate(result.comment) : comment),
        });
      }
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  },

  previewImage(event) {
    wx.previewImage({ urls: this.data.comments.flatMap(comment => comment.images), current: event.currentTarget.dataset.src });
  },

  copyLink() {
    // 好友只拿到套卷身份，打开后进入自己的对应记录或空白答卷。
    const path = `/pages/practice/practice?versionId=${encodeURIComponent(this.paperId)}`;
    wx.setClipboardData({ data: path, success: () => wx.showToast({ title: "已复制套卷链接", icon: "none" }) });
  },
});
