const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const format = require("../../utils/format.js");

const STATUS = {
  pending: "待审核",
  partial: "部分已处理",
  approved: "已通过",
  rejected: "已拒绝",
  mixed: "已处理",
};

function dateText(value) {
  return value ? format.dateTime(value) : "";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

Page({
  data: {
    loading: true,
    adminLoading: false,
    error: "",
    reviewEnabled: false,
    pendingCount: 0,
    pendingQuestionCount: 0,
    credentialOpen: false,
    hasCredential: false,
    authorized: false,
    feedbacks: [],
    versions: [],
    sources: [],
    catalogError: "",
    detail: null,
    review: null,
    confirming: false,
    reviewError: "",
    importOpen: false,
    importing: false,
    importError: "",
    importFile: null,
    importExamOptions: ["国考", "省考"],
    importFields: { exam: "guokao", year: new Date().getFullYear(), region: "全国", label: "", publisher: "", sourcePage: "", downloadUrl: "", retrievedAt: today() },
    uiBase: "/assets/ui",
  },

  onLoad() {
    this.loadSummary();
    this.loadCatalog();
  },

  async loadSummary() {
    this.setData({ loading: true, error: "" });
    try {
      const summary = await api.request("corrections/summary");
      this.setData({
        loading: false,
        reviewEnabled: Boolean(summary.reviewEnabled),
        pendingCount: summary.pendingCount || 0,
        pendingQuestionCount: summary.pendingQuestionCount || 0,
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  decorateFeedback(feedback) {
    const pendingItems = feedback.items.filter(item => item.status === "pending");
    return {
      ...feedback,
      statusText: STATUS[feedback.status] || "待审核",
      pendingItems,
      pendingCount: pendingItems.length,
      createdAtText: dateText(feedback.createdAt),
      summary: feedback.items.map(item => `第 ${item.question} 题 ${item.originalAnswer} → ${item.suggestedAnswer}`).join("；"),
    };
  },

  async unlock() {
    const token = this.credential;
    if (!token || this.data.adminLoading) return;
    this.setData({ adminLoading: true, error: "" });
    try {
      const admin = await api.request("corrections/admin", { reviewToken: token });
      this.reviewToken = token;
      this.credential = "";
      this.setData({
        adminLoading: false,
        credentialOpen: false,
        hasCredential: false,
        authorized: true,
        reviewEnabled: Boolean(admin.reviewEnabled),
        pendingCount: admin.pendingCount || 0,
        pendingQuestionCount: admin.pendingQuestionCount || 0,
        feedbacks: (admin.feedbacks || []).map(feedback => this.decorateFeedback(feedback)),
        versions: admin.versions || [],
      });
    } catch (error) {
      this.setData({ adminLoading: false, error: error.message, authorized: false });
    }
  },

  onToken(event) {
    this.credential = event.detail.value;
    this.setData({ hasCredential: Boolean(this.credential), error: "" });
  },

  openCredential() {
    this.setData({ credentialOpen: true, error: "" });
  },

  closeCredential() {
    if (this.data.adminLoading) return;
    this.credential = "";
    this.setData({ credentialOpen: false, hasCredential: false, error: "" });
  },

  async refreshAdmin() {
    if (!this.data.authorized) {
      await this.loadSummary();
      return;
    }
    this.setData({ adminLoading: true, error: "" });
    try {
      const admin = await api.request("corrections/admin", { reviewToken: this.reviewToken });
      this.setData({
        adminLoading: false,
        pendingCount: admin.pendingCount || 0,
        pendingQuestionCount: admin.pendingQuestionCount || 0,
        feedbacks: (admin.feedbacks || []).map(feedback => this.decorateFeedback(feedback)),
        versions: admin.versions || [],
      });
    } catch (error) {
      this.setData({ adminLoading: false, error: error.message });
    }
  },

  lock() {
    if (this.data.adminLoading) return;
    this.reviewToken = "";
    this.setData({ authorized: false, feedbacks: [], versions: [], detail: null, review: null });
    this.loadSummary();
  },

  openDetail(event) {
    const feedback = this.data.feedbacks.find(item => item.id === event.currentTarget.dataset.id);
    if (feedback) this.setData({ detail: feedback });
  },

  closeDetail() {
    this.setData({ detail: null });
  },

  openReview(event) {
    const feedback = this.data.feedbacks.find(item => item.id === event.currentTarget.dataset.id);
    if (!feedback || !feedback.pendingItems.length) return;
    this.setData({
      detail: null,
      confirming: false,
      reviewError: "",
      review: {
        feedbackId: feedback.id,
        reviewId: storage.uuid(),
        paperTitle: feedback.paperTitle,
        affectedAttempts: this.data.versions.find(version => version.id === feedback.versionId)?.receiptCount ?? 0,
        currentRevision: feedback.currentRevision,
        pendingItems: feedback.pendingItems.map(item => ({ ...item, selected: !item.stale })),
        selectedQuestions: feedback.pendingItems.filter(item => !item.stale).map(item => item.question),
        decision: "approve",
        reason: "",
      },
    });
  },

  closeReview() {
    if (!this.data.adminLoading) this.setData({ review: null, confirming: false, reviewError: "" });
  },

  onQuestionSelection(event) {
    const selected = event.detail.value.map(Number);
    this.setData({
      "review.selectedQuestions": selected,
      "review.pendingItems": this.data.review.pendingItems.map(item => ({ ...item, selected: selected.includes(item.question) })),
      reviewError: "",
    });
  },

  setDecision(event) {
    this.setData({ "review.decision": event.currentTarget.dataset.decision, reviewError: "" });
  },

  onReason(event) {
    this.setData({ "review.reason": event.detail.value, reviewError: "" });
  },

  prepareReview() {
    const review = this.data.review;
    if (!review?.selectedQuestions.length) {
      this.setData({ reviewError: "请至少选择一道题" });
      return;
    }
    if (!review.reason.trim()) {
      this.setData({ reviewError: "请填写审核理由" });
      return;
    }
    if (review.decision === "approve" && review.pendingItems.some(item => item.selected && item.stale)) {
      this.setData({ reviewError: "所选题目的依据已修订，只能拒绝旧反馈" });
      return;
    }
    this.setData({ confirming: true, reviewError: "" });
  },

  backReview() {
    if (!this.data.adminLoading) this.setData({ confirming: false, reviewError: "" });
  },

  async submitReview() {
    const review = this.data.review;
    if (!review || !this.data.confirming || !this.reviewToken || this.data.adminLoading) return;
    this.setData({ adminLoading: true, reviewError: "" });
    try {
      await api.request("corrections/review", {
        reviewToken: this.reviewToken,
        reviewId: review.reviewId,
        feedbackId: review.feedbackId,
        questionNumbers: review.selectedQuestions,
        decision: review.decision,
        reason: review.reason.trim(),
        expectedRevision: review.currentRevision,
      });
    } catch (error) {
      this.setData({ adminLoading: false, reviewError: error.message });
      return;
    }
    this.setData({ adminLoading: false, review: null, confirming: false, detail: null });
    wx.showToast({ title: review.decision === "approve" ? "已订正并重算" : "已拒绝反馈", icon: "success" });
    await Promise.allSettled([this.refreshAdmin(), this.syncResults()]);
  },

  async syncResults() {
    try {
      const attempts = await api.sync();
      for (const attempt of attempts) storage.upsertAttempt(attempt);
      api.resetCatalogCache();
    } catch {
      wx.showToast({ title: "审核已保存，可下拉同步成绩", icon: "none" });
    }
  },

  async loadCatalog() {
    try {
      const catalog = await api.request("positions/catalog?pageSize=1");
      this.setData({
        catalogError: "",
        sources: (catalog.sources || []).map(source => ({
          ...source,
          countText: Number(source.count || 0).toLocaleString("zh-CN"),
          examLabel: source.exam === "shengkao" ? "省考" : "国考",
          originLabel: source.origin === "bundled-official" ? "官方发布文件" : "用户导入文件",
        })),
      });
    } catch (error) {
      this.setData({ catalogError: error.message });
    }
  },

  toggleImport() {
    this.setData({ importOpen: !this.data.importOpen, importError: "" });
  },

  async chooseImportFile() {
    try {
      const selected = await wx.chooseMessageFile({ count: 1, type: "file", extension: ["xls", "xlsx", "json"] });
      const file = selected.tempFiles?.[0];
      if (!file) return;
      const name = file.name || file.path.split("/").pop();
      const fields = {
        ...this.data.importFields,
        label: this.data.importFields.label || name.replace(/\.[^.]+$/, ""),
      };
      this.setData({ importOpen: true, importFile: { name, path: file.path, size: file.size }, importFields: fields, importError: "" });
    } catch (error) {
      if (!String(error.errMsg || "").includes("cancel")) this.setData({ importError: "文件读取失败，请重试" });
    }
  },

  onImportField(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`importFields.${field}`]: event.detail.value, importError: "" });
  },

  onImportExam(event) {
    this.setData({ "importFields.exam": Number(event.detail.value) === 1 ? "shengkao" : "guokao", importError: "" });
  },

  onImportDate(event) {
    this.setData({ "importFields.retrievedAt": event.detail.value, importError: "" });
  },

  async importPositions() {
    const file = this.data.importFile;
    const fields = this.data.importFields;
    if (!file || this.data.importing) {
      if (!file) this.setData({ importError: "请先选择岗位文件" });
      return;
    }
    if (!file.size || file.size > 20 * 1024 * 1024) {
      this.setData({ importError: "文件须小于 20 MB" });
      return;
    }
    const isJson = /\.json$/i.test(file.name);
    if (!isJson && (!fields.year || !fields.region.trim() || !fields.label.trim() || !fields.publisher.trim() || !fields.retrievedAt)) {
      this.setData({ importError: "请填写年度、地区、目录名称、来源机构和获取日期" });
      return;
    }
    this.setData({ importing: true, importError: "" });
    let uploadId = "";
    try {
      const metadata = {
        exam: fields.exam,
        year: Number(fields.year),
        region: fields.region.trim(),
        label: fields.label.trim(),
        publisher: fields.publisher.trim(),
        sourcePage: fields.sourcePage.trim(),
        downloadUrl: fields.downloadUrl.trim(),
        retrievedAt: fields.retrievedAt,
        id: `user-${fields.year}-${storage.uuid()}`,
        sourceType: fields.sourcePage.trim() && fields.downloadUrl.trim() ? "published" : "user-file",
      };
      const started = await api.request("positions/import/start", {
        guestId: storage.guestId(), fileName: file.name, size: file.size, metadata: isJson ? null : metadata,
      });
      uploadId = started.uploadId;
      const data = await new Promise((resolve, reject) => wx.getFileSystemManager().readFile({
        filePath: file.path, encoding: "base64", success: result => resolve(result.data), fail: reject,
      }));
      const charsPerChunk = Math.ceil(started.chunkSize / 3) * 4;
      let index = 0;
      for (let offset = 0; offset < data.length; offset += charsPerChunk) {
        await api.request("positions/import/chunk", {
          guestId: storage.guestId(), uploadId, index, chunk: data.slice(offset, offset + charsPerChunk),
        }, 30000);
        index += 1;
      }
      const result = await api.request("positions/import/finish", { guestId: storage.guestId(), uploadId }, 75000);
      uploadId = "";
      this.setData({ importing: false, importFile: null, importError: "" });
      wx.showToast({ title: `已导入 ${result.imported} 个岗位`, icon: "success" });
      await this.loadCatalog();
    } catch (error) {
      if (uploadId) {
        api.request("positions/import/cancel", { guestId: storage.guestId(), uploadId }).catch(() => {});
      }
      this.setData({ importing: false, importError: error.message });
    }
  },

  copySource(event) {
    const url = event.currentTarget.dataset.url;
    if (url) wx.setClipboardData({ data: url });
  },
});
