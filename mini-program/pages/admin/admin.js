const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const format = require("../../utils/format.js");
const { createPageSheetDrag } = require("../../utils/sheet-gesture.js");

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

const USER_FEEDBACK_STATUS_OPTIONS = [
  { key: "pending", label: "待处理" },
  { key: "processing", label: "处理中" },
  { key: "replied", label: "已回复" },
  { key: "closed", label: "已关闭" },
];

Page({
  data: {
    loading: true,
    adminLoading: false,
    error: "",
    reviewEnabled: false,
    pendingCount: 0,
    userFeedbackPendingCount: 0,
    userFeedbacks: [],
    userFeedbackFilter: "pending",
    userFeedbackSummary: { total: 0, pending: 0, processing: 0, replied: 0, closed: 0 },
    feedbackNotify: { enabled: true, wechatReady: false, templateConfigured: false, templateId: "", subscriberCount: 0, totalQuota: 0 },
    subscribingNotify: false,
    testingNotify: false,
    activeUserFeedback: null,
    userFeedbackReplyText: "",
    userFeedbackReplyStatus: "replied",
    userFeedbackStatusOptions: USER_FEEDBACK_STATUS_OPTIONS,
    userFeedbackError: "",
    savingUserFeedback: false,
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
    sheetDragY: 0,
    sheetDragging: false,
    sheetClosing: false,
    sheetShadeOpacity: 1,
    uiBase: "/assets/ui",
  },

  onLoad(query) {
    this.targetFeedbackId = typeof query?.id === "string" ? query.id : "";
    this.sheetDrag = createPageSheetDrag(this, {
      onDismiss: () => {
        if (this.data.activeUserFeedback) this.closeUserFeedback();
        else if (this.data.review) this.closeReview();
        else if (this.data.detail) this.closeDetail();
        else if (this.data.credentialOpen) this.closeCredential();
      },
    });
    this.loadSummary();
    this.loadCatalog();
  },

  onUnload() {
    this.sheetDrag?.reset();
  },

  noopSheet() {},
  onSheetScroll(event) { this.sheetDrag?.onScroll(event); },
  startSheetDrag(event) { this.sheetDrag?.start(event); },
  moveSheetDrag(event) { this.sheetDrag?.move(event); },
  endSheetDrag(event) { this.sheetDrag?.end(event); },
  cancelSheetDrag() { this.sheetDrag?.cancel(); },

  async loadSummary() {
    this.setData({ loading: true, error: "" });
    try {
      const [summary, fbSummary] = await Promise.all([
        api.request("corrections/summary"),
        api.request("feedback/summary").catch(() => ({ pendingCount: 0, reviewEnabled: false })),
      ]);
      this.setData({
        loading: false,
        reviewEnabled: Boolean(summary.reviewEnabled || fbSummary.reviewEnabled),
        pendingCount: summary.pendingCount || 0,
        userFeedbackPendingCount: fbSummary.pendingCount || 0,
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  decorateUserFeedback(item) {
    return {
      ...item,
      createdAtText: dateText(item.createdAt),
    };
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
      const [admin, fbRes] = await Promise.all([
        api.request("corrections/admin", { reviewToken: token }),
        api.request("feedback/admin/list", { reviewToken: token, status: this.data.userFeedbackFilter }).catch(() => null),
      ]);
      this.reviewToken = token;
      this.credential = "";
      const userFeedbacks = (fbRes?.items || []).map(item => this.decorateUserFeedback(item));
      this.setData({
        adminLoading: false,
        credentialOpen: false,
        hasCredential: false,
        authorized: true,
        reviewEnabled: Boolean(admin.reviewEnabled),
        pendingCount: admin.pendingCount || 0,
        feedbacks: (admin.feedbacks || []).map(feedback => this.decorateFeedback(feedback)),
        versions: admin.versions || [],
        userFeedbacks,
        userFeedbackSummary: fbRes?.summary || this.data.userFeedbackSummary,
        userFeedbackPendingCount: fbRes?.summary?.pending ?? this.data.userFeedbackPendingCount,
        feedbackNotify: fbRes?.notify || this.data.feedbackNotify,
      });
      if (this.targetFeedbackId) {
        const target = userFeedbacks.find(item => item.id === this.targetFeedbackId);
        this.targetFeedbackId = "";
        if (target) this.openUserFeedbackItem(target);
      }
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
    this.sheetDrag?.reset();
    this._sheetScrollTop = 0;
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
      const [admin, fbRes] = await Promise.all([
        api.request("corrections/admin", { reviewToken: this.reviewToken }),
        api.request("feedback/admin/list", { reviewToken: this.reviewToken, status: this.data.userFeedbackFilter }).catch(() => null),
      ]);
      this.setData({
        adminLoading: false,
        pendingCount: admin.pendingCount || 0,
        feedbacks: (admin.feedbacks || []).map(feedback => this.decorateFeedback(feedback)),
        versions: admin.versions || [],
        ...(fbRes ? {
          userFeedbacks: (fbRes.items || []).map(item => this.decorateUserFeedback(item)),
          userFeedbackSummary: fbRes.summary || this.data.userFeedbackSummary,
          userFeedbackPendingCount: fbRes.summary?.pending ?? this.data.userFeedbackPendingCount,
          feedbackNotify: fbRes.notify || this.data.feedbackNotify,
        } : {}),
      });
    } catch (error) {
      this.setData({ adminLoading: false, error: error.message });
    }
  },

  lock() {
    if (this.data.adminLoading) return;
    this.reviewToken = "";
    this.setData({
      authorized: false,
      feedbacks: [],
      versions: [],
      userFeedbacks: [],
      detail: null,
      review: null,
      activeUserFeedback: null,
    });
    this.loadSummary();
  },

  async setUserFeedbackFilter(event) {
    const status = event.currentTarget.dataset.status;
    if (!status || status === this.data.userFeedbackFilter || !this.reviewToken) return;
    this.setData({ userFeedbackFilter: status });
    try {
      const fbRes = await api.request("feedback/admin/list", { reviewToken: this.reviewToken, status });
      this.setData({
        userFeedbacks: (fbRes.items || []).map(item => this.decorateUserFeedback(item)),
        userFeedbackSummary: fbRes.summary || this.data.userFeedbackSummary,
        userFeedbackPendingCount: fbRes.summary?.pending ?? this.data.userFeedbackPendingCount,
        feedbackNotify: fbRes.notify || this.data.feedbackNotify,
      });
    } catch (error) {
      wx.showToast({ title: error.message || "读取失败", icon: "none" });
    }
  },

  openUserFeedback(event) {
    const item = this.data.userFeedbacks.find(entry => entry.id === event.currentTarget.dataset.id);
    if (item) this.openUserFeedbackItem(item);
  },

  openUserFeedbackItem(item) {
    this.setData({
      activeUserFeedback: item,
      userFeedbackReplyText: item.reply?.text || "",
      userFeedbackReplyStatus: item.status === "pending" ? "replied" : item.status,
      userFeedbackError: "",
    });
  },

  closeUserFeedback() {
    if (this.data.savingUserFeedback) return;
    this.sheetDrag?.reset();
    this._sheetScrollTop = 0;
    this.setData({ activeUserFeedback: null, userFeedbackError: "" });
  },

  setUserFeedbackReplyStatus(event) {
    const status = event.currentTarget.dataset.status;
    if (status) this.setData({ userFeedbackReplyStatus: status, userFeedbackError: "" });
  },

  onUserFeedbackReplyInput(event) {
    this.setData({ userFeedbackReplyText: event.detail.value || "", userFeedbackError: "" });
  },

  copyFeedbackContact() {
    const contact = this.data.activeUserFeedback?.contact;
    if (contact) wx.setClipboardData({ data: contact });
  },

  previewUserFeedbackImage(event) {
    const index = Number(event.currentTarget.dataset.index) || 0;
    const urls = (this.data.activeUserFeedback?.images || []).map(img => img.dataUri);
    if (urls[index]) wx.previewImage({ current: urls[index], urls });
  },

  async submitUserFeedbackReply() {
    const target = this.data.activeUserFeedback;
    if (!target || !this.reviewToken || this.data.savingUserFeedback) return;
    this.setData({ savingUserFeedback: true, userFeedbackError: "" });
    try {
      await api.request("feedback/admin/reply", {
        reviewToken: this.reviewToken,
        feedbackId: target.id,
        status: this.data.userFeedbackReplyStatus,
        replyText: String(this.data.userFeedbackReplyText || "").trim(),
      });
      this.setData({ savingUserFeedback: false, activeUserFeedback: null });
      wx.showToast({ title: "已保存回复", icon: "success" });
      await this.refreshAdmin();
    } catch (error) {
      this.setData({ savingUserFeedback: false, userFeedbackError: error.message || "保存失败" });
    }
  },

  subscribeFeedbackNotify() {
    const templateId = this.data.feedbackNotify?.templateId;
    if (!templateId || !this.reviewToken || this.data.subscribingNotify) return;
    this.setData({ subscribingNotify: true });
    // 微信要求 requestSubscribeMessage 必须在点击事件内同步触发，不能放在 await 之后。
    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success: async (subRes) => {
        const accepted = subRes?.[templateId] === "accept";
        if (!accepted) {
          this.setData({ subscribingNotify: false });
          wx.showToast({ title: "未允许接收提醒", icon: "none" });
          return;
        }
        try {
          const loginRes = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }));
          const res = await api.request("feedback/admin/subscribe", {
            reviewToken: this.reviewToken,
            wxCode: loginRes.code,
            label: storage.name(),
            accepted: true,
          });
          this.setData({
            subscribingNotify: false,
            feedbackNotify: res.notify || this.data.feedbackNotify,
          });
          wx.showToast({ title: `已订阅，剩余 ${res.subscriber?.quota ?? 1} 次`, icon: "success" });
        } catch (error) {
          this.setData({ subscribingNotify: false });
          wx.showToast({ title: error.message || "订阅绑定失败", icon: "none" });
        }
      },
      fail: (error) => {
        this.setData({ subscribingNotify: false });
        const msg = String(error?.errMsg || "").includes("cancel") ? "已取消订阅" : "订阅窗口拉起失败";
        wx.showToast({ title: msg, icon: "none" });
      },
    });
  },

  async testFeedbackNotify() {
    if (!this.reviewToken || this.data.testingNotify) return;
    this.setData({ testingNotify: true });
    try {
      const res = await api.request("feedback/admin/test-notify", { reviewToken: this.reviewToken });
      this.setData({
        testingNotify: false,
        feedbackNotify: res.notify || this.data.feedbackNotify,
      });
      wx.showToast({
        title: res.sent > 0 ? "测试提醒已发送" : (res.lastError || res.skippedReason || "未能发送"),
        icon: res.sent > 0 ? "success" : "none",
      });
    } catch (error) {
      this.setData({ testingNotify: false });
      wx.showToast({ title: error.message || "发送失败", icon: "none" });
    }
  },

  openDetail(event) {
    const feedback = this.data.feedbacks.find(item => item.id === event.currentTarget.dataset.id);
    if (feedback) this.setData({ detail: feedback });
  },

  closeDetail() {
    this.sheetDrag?.reset();
    this._sheetScrollTop = 0;
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
    if (this.data.adminLoading) return;
    this.sheetDrag?.reset();
    this._sheetScrollTop = 0;
    this.setData({ review: null, confirming: false, reviewError: "" });
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
