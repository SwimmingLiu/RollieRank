const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const format = require("../../utils/format.js");
const { storageKey } = require("../../config.js");

const DRAFT_KEY = storageKey("rr:feedback-draft");
const SEEN_REPLY_KEY = storageKey("rr:feedback-seen-reply-at");

const CATEGORIES = [
  { key: "suggestion", label: "功能建议", icon: "help", placeholder: "说说想新增或优化的功能…" },
  { key: "bug", label: "问题报错", icon: "warn", placeholder: "描述问题与所在页面…" },
  { key: "paper", label: "试卷缺失", icon: "book", placeholder: "填写缺少的机构、年份与期数…" },
  { key: "other", label: "其他", icon: "comment", placeholder: "写下你想说的话…" },
];

async function imageToDataUri(tempFilePath) {
  const canvas = wx.createOffscreenCanvas({ type: "2d", width: 1, height: 1 });
  const image = canvas.createImage();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = tempFilePath;
  });
  const scale = Math.min(1, 960 / Math.max(image.width || 1, image.height || 1));
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return { path: tempFilePath, dataUri: canvas.toDataURL("image/png") };
}

function clientMeta() {
  try {
    const info = wx.getAccountInfoSync?.()?.miniProgram || {};
    return {
      platform: "miniprogram",
      envVersion: info.envVersion || "",
      appVersion: info.version || "",
      page: "pages/feedback/feedback",
    };
  } catch {
    return { platform: "miniprogram", envVersion: "", appVersion: "", page: "pages/feedback/feedback" };
  }
}

Page({
  data: {
    tab: "submit",
    categories: CATEGORIES,
    category: "suggestion",
    placeholder: CATEGORIES[0].placeholder,
    content: "",
    contact: "",
    images: [],
    picking: false,
    submitting: false,
    canSubmit: false,
    formError: "",
    mine: [],
    loadingMine: false,
    mineError: "",
    refreshing: false,
    hasUnreadReply: false,
    uiBase: "/assets/ui",
  },

  onLoad(query) {
    const saved = wx.getStorageSync(DRAFT_KEY);
    const category = CATEGORIES.some(c => c.key === saved?.category) ? saved.category : "suggestion";
    const content = typeof saved?.content === "string" ? saved.content : "";
    const contact = typeof saved?.contact === "string" ? saved.contact : "";
    const tab = query?.tab === "mine" ? "mine" : "submit";
    this.setData({
      tab,
      category,
      placeholder: (CATEGORIES.find(c => c.key === category) || CATEGORIES[0]).placeholder,
      content,
      contact,
      canSubmit: Boolean(content.trim()),
    });
    this.loadMine();
  },

  onShow() {
    this.loadMine();
  },

  onRefresherRefresh() {
    this.setData({ refreshing: true });
    this.loadMine().finally(() => this.setData({ refreshing: false }));
  },

  saveDraft(patch = {}) {
    const next = {
      category: patch.category ?? this.data.category,
      content: patch.content ?? this.data.content,
      contact: patch.contact ?? this.data.contact,
    };
    try {
      wx.setStorageSync(DRAFT_KEY, next);
    } catch {
      // 忽略本机缓存空间不足
    }
  },

  toggleTab() {
    const next = this.data.tab === "mine" ? "submit" : "mine";
    this.setData({ tab: next });
    if (next === "mine") {
      this.markRepliesSeen();
      this.loadMine();
    }
  },

  selectCategory(event) {
    const key = event.currentTarget.dataset.key;
    const matched = CATEGORIES.find(item => item.key === key);
    if (!matched) return;
    this.setData({ category: matched.key, placeholder: matched.placeholder, formError: "" });
    this.saveDraft({ category: matched.key });
  },

  onContent(event) {
    const content = event.detail.value || "";
    this.setData({ content, canSubmit: Boolean(content.trim()), formError: "" });
    this.saveDraft({ content });
  },

  onContact(event) {
    const contact = event.detail.value || "";
    this.setData({ contact, formError: "" });
    this.saveDraft({ contact });
  },

  async pickImages() {
    const remain = 3 - this.data.images.length;
    if (remain <= 0 || this.data.picking || this.data.submitting) return;
    this.setData({ picking: true, formError: "" });
    try {
      const selected = await new Promise((resolve, reject) => wx.chooseMedia({
        count: remain,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        sizeType: ["compressed"],
        success: resolve,
        fail: reject,
      }));
      const files = selected?.tempFiles || [];
      const added = [];
      for (const file of files) {
        if (!file?.tempFilePath) continue;
        added.push(await imageToDataUri(file.tempFilePath));
      }
      if (added.length) {
        this.setData({ images: [...this.data.images, ...added].slice(0, 3) });
      }
    } catch (error) {
      if (!String(error?.errMsg || "").includes("cancel")) {
        this.setData({ formError: "截图读取失败，请重新选择" });
      }
    } finally {
      this.setData({ picking: false });
    }
  },

  removeImage(event) {
    const index = Number(event.currentTarget.dataset.index);
    const images = this.data.images.filter((_, idx) => idx !== index);
    this.setData({ images });
  },

  previewDraftImage(event) {
    const index = Number(event.currentTarget.dataset.index) || 0;
    const urls = this.data.images.map(item => item.path);
    if (urls[index]) wx.previewImage({ current: urls[index], urls });
  },

  previewMineImage(event) {
    const id = event.currentTarget.dataset.id;
    const index = Number(event.currentTarget.dataset.index) || 0;
    const item = this.data.mine.find(entry => entry.id === id);
    const urls = (item?.images || []).map(img => img.dataUri);
    if (urls[index]) wx.previewImage({ current: urls[index], urls });
  },

  async submitFeedback() {
    if (this.data.submitting) return;
    const content = String(this.data.content || "").trim();
    if (!content) {
      this.setData({ formError: "请填写反馈内容" });
      return;
    }
    this.setData({ submitting: true, formError: "" });
    try {
      await api.request("feedback", {
        feedbackId: storage.uuid(),
        guestId: storage.guestId(),
        nickname: storage.name(),
        category: this.data.category,
        content,
        contact: String(this.data.contact || "").trim(),
        images: this.data.images.map((img, idx) => ({ dataUri: img.dataUri, alt: `反馈截图 ${idx + 1}` })),
        clientMeta: clientMeta(),
      }, 25000);
      try {
        wx.removeStorageSync(DRAFT_KEY);
      } catch {
        // 忽略
      }
      this.setData({
        submitting: false,
        content: "",
        images: [],
        canSubmit: false,
        tab: "mine",
      });
      wx.showToast({ title: "反馈已收到，谢谢你", icon: "success" });
      await this.loadMine();
    } catch (error) {
      this.setData({ submitting: false, formError: error.message || "提交失败，请重试" });
    }
  },

  markRepliesSeen(latestReplyAt = this.latestReplyAt) {
    if (latestReplyAt > 0) {
      try {
        wx.setStorageSync(SEEN_REPLY_KEY, latestReplyAt);
      } catch {
        // 忽略
      }
    }
    if (this.data.hasUnreadReply) this.setData({ hasUnreadReply: false });
  },

  async loadMine() {
    this.setData({ loadingMine: true, mineError: "" });
    try {
      const res = await api.request("feedback/mine?guestId=" + encodeURIComponent(storage.guestId()));
      const mine = (res.items || []).map(item => ({
        ...item,
        createdAtText: item.createdAt ? format.dateTime(item.createdAt) : "",
        repliedAtText: item.reply?.repliedAt ? format.dateTime(item.reply.repliedAt) : "",
      }));
      this.latestReplyAt = Number(res.latestReplyAt || 0);
      const seenAt = Number(wx.getStorageSync(SEEN_REPLY_KEY) || 0);
      const hasUnreadReply = this.latestReplyAt > seenAt && this.data.tab !== "mine";
      if (this.data.tab === "mine" && this.latestReplyAt > seenAt) {
        this.markRepliesSeen(this.latestReplyAt);
      }
      this.setData({ loadingMine: false, mine, hasUnreadReply });
    } catch (error) {
      this.setData({ loadingMine: false, mineError: error.message || "反馈记录读取失败" });
    }
  },
});
