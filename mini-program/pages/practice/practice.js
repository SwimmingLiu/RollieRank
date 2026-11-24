const api = require("../../services/api.js");
const storage = require("../../utils/storage.js");
const catalogUtil = require("../../utils/catalog.js");
const omrUtil = require("../../utils/omr.js");
const timing = require("../../utils/timing.js");
const { createPageSheetDrag } = require("../../utils/sheet-gesture.js");
const { resumeEntryTimer, pauseEntryTimer } = require("../../vendor/practice-timer.js");

const { ASSET } = require("../../config.js");

const CHOICES = ["A", "B", "C", "D"];

function sectionsOf(version) {
  // 章节来自逐题题型，不把题量或题号写死；服务端公开目录保持原始顺序。
  const sections = [];
  for (const question of version.questions) {
    const last = sections[sections.length - 1];
    if (last && last.type === question.type) {
      last.end = question.number;
      last.count += 1;
    } else {
      sections.push({ type: question.type, start: question.number, end: question.number, count: 1 });
    }
  }
  return sections.map(section => ({ ...section, key: `${section.type}-${section.start}` }));
}

Page({
  data: {
    loading: true,
    error: "",
    version: null,
    title: "",
    identity: "",
    sections: [],
    sheetSections: [],
    sheetScrollTop: 0,
    activeSection: 0,
    questions: [],
    allQuestions: [],
    currentQuestion: null,
    current: 1,
    single: false,
    markOnly: false,
    scrollTarget: "",
    sheet: "",
    progress: 0,
    publisherLogo: "",
    answers: [],
    marks: [],
    answered: 0,
    uncertain: 0,
    submitting: false,
    singleOffset: 0,
    singleOpacity: 1,
    singleDragging: false,
    sheetDragY: 0,
    sheetDragging: false,
    sheetClosing: false,
    sheetShadeOpacity: 1,
    scanPhase: "idle",
    scanPreview: "",
    scanError: "",
    scanSummary: null,
    scanLowConfidenceText: "",
    scanMode: "fill-blank",
    scanCanApply: false,
    uiBase: "/assets/ui",
    choices: CHOICES,
  },

  onLoad(query) {
    this.sheetDrag = createPageSheetDrag(this, { onDismiss: () => this.closeSheet() });
    this.attemptId = query.attemptId || "";
    this.versionId = decodeURIComponent(query.versionId || "");
    this.retry();
  },

  onShow() {
    this.entryVisible = true;
    this.startEntryClock();
  },

  startEntryClock() {
    if (!this.entryVisible || !this.attemptId || this.data.loading) return;
    const current = timing.readTimedEntry(this.versionId, this.attemptId);
    if (current) timing.setEntryTiming(resumeEntryTimer(current));
  },

  stopEntryClock() {
    if (!this.attemptId) return;
    const current = timing.readTimedEntry(this.versionId, this.attemptId);
    if (current?.entrySince) timing.setEntryTiming(pauseEntryTimer(current));
  },

  async retry() {
    this.setData({ loading: true, error: "" });
    try {
      const versions = await api.catalog();
      const version = versions.find(v => v.id === this.versionId);
      if (!version) throw new Error("找不到这套卷，请回到选卷页重新选择。");
      const draft = storage.loadDraft(version.id) || {};
      this.savedDraft = Boolean(draft.id);
      const answers = new Array(version.questionCount).fill("");
      if (Array.isArray(draft.answers)) {
        draft.answers.forEach((value, index) => {
          if (index < answers.length && CHOICES.includes(value)) answers[index] = value;
        });
      }
      const marks = new Array(version.questionCount).fill(false);
      if (Array.isArray(draft.marks)) draft.marks.forEach((value, index) => {
        if (index < marks.length) marks[index] = Boolean(value);
      });
      if (!this.attemptId) this.attemptId = draft.id || storage.pendingId(version.id);
      this.version = version;
      this.setData({
        loading: false,
        version: { id: version.id, questionCount: version.questionCount, invigilator: version.timeLimitMinutes || 0 },
        title: catalogUtil.versionTitle(version),
        identity: catalogUtil.practiceIdentity(version),
        publisherLogo: ASSET[catalogUtil.LOGO[version.institution]] || "",
        current: Math.min(version.questionCount, Math.max(1, Number(draft.current) || 1)),
        single: Boolean(draft.single),
        sections: sectionsOf(version),
        answers,
        marks,
      });
      this.reflect();
      this.startEntryClock();
      if (this.data.current > 1) this.jump(this.data.current);
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },


  reflect() {
    const { answers, marks, current, markOnly, sections } = this.data;
    const allQuestions = this.version.questions.map(question => ({
      number: question.number,
      type: question.type,
      answer: answers[question.number - 1] || "",
      marked: Boolean(marks[question.number - 1]),
    }));
    const questions = markOnly ? allQuestions.filter(question => question.marked) : allQuestions;
    const currentQuestion = questions.find(question => question.number === current) || questions[0] || null;
    const activeSection = Math.max(0, sections.findIndex(section => current >= section.start && current <= section.end));
    const answered = answers.filter(Boolean).length;
    const rows = questions.map((question, index) => {
      const previous = questions[index - 1];
      const section = sections.find(item => question.number >= item.start && question.number <= item.end);
      return section && (!previous || previous.number < section.start)
        ? { ...question, heading: section.type, range: `${section.start}–${section.end}` }
        : question;
    });
    this.setData({
      allQuestions, questions: rows, currentQuestion, activeSection, answered,
      firstQuestion: questions[0]?.number || 0,
      lastQuestion: questions[questions.length - 1]?.number || 0,
      uncertain: marks.filter(Boolean).length,
      progress: answered / this.version.questionCount * 100,
    });
  },

  choose(event) {
    if (this.swipeMoved) return;
    const { number, choice } = event.currentTarget.dataset;
    const index = Number(number) - 1;
    const answers = this.data.answers.slice();
    const firstAnswer = !answers[index];
    answers[index] = answers[index] === choice ? "" : choice;
    this.setData({ answers, current: Number(number) });
    this.reflect();
    if (answers[index] && (firstAnswer || this.data.single)) this.moveQuestion(1, true);
    this.persist();
  },

  toggleMark(event) {
    if (this.swipeMoved) return;
    const number = Number(event.currentTarget.dataset.number);
    const marks = this.data.marks.slice();
    marks[number - 1] = !marks[number - 1];
    this.setData({ marks });
    this.reflect();
    this.persist();
  },

  switchSection(event) {
    const section = this.data.sections[Number(event.currentTarget.dataset.index)];
    if (!section) return;
    this.setData({ markOnly: false, sheet: "" });
    this.jump(section.start);
  },

  goQuestion(event) {
    this.setData({ markOnly: false, sheet: "" });
    this.jump(Number(event.currentTarget.dataset.number));
  },

  jump(number, keepVisible = false) {
    this.setData({ current: number, scrollTarget: "" });
    this.reflect();
    const id = "answer-" + number;
    if (!this.data.single && keepVisible) {
      const query = this.createSelectorQuery();
      query.select(".practice__scroller").boundingClientRect();
      query.select("#" + id).boundingClientRect();
      query.exec(([list, row]) => {
        if (this.data.current === number && list && row && (row.bottom > list.bottom || row.top < list.top)) {
          this.setData({ scrollTarget: id });
        }
      });
    } else if (!this.data.single) {
      this.setData({ scrollTarget: id });
    }
    this.persist();
  },

  toggleMarkFilter() {
    const markOnly = !this.data.markOnly;
    const current = markOnly ? this.data.allQuestions.find(question => question.marked)?.number || this.data.current : this.data.current;
    this.setData({ markOnly });
    this.jump(current);
  },

  toggleMode() {
    this.setData({ single: !this.data.single });
    this.jump(this.data.current);
  },

  animateSingleTransition(direction) {
    clearTimeout(this.singleAnimTimer);
    this.setData({ singleOffset: direction > 0 ? 44 : -44, singleOpacity: 0.35, singleDragging: true }, () => {
      this.singleAnimTimer = setTimeout(() => {
        this.setData({ singleOffset: 0, singleOpacity: 1, singleDragging: false });
      }, 16);
    });
  },

  moveQuestion(direction, keepVisible = false) {
    const { questions, currentQuestion, single } = this.data;
    const position = questions.findIndex(question => question.number === currentQuestion?.number);
    const next = questions[position + direction];
    if (!next) return false;
    this.jump(next.number, keepVisible);
    if (single) this.animateSingleTransition(direction);
    return true;
  },

  previousQuestion() { this.moveQuestion(-1); },

  nextQuestion() { this.moveQuestion(1); },

  startSwipe(event) {
    const point = event.touches?.[0];
    if (!point || event.touches.length > 1) {
      this.swipeStart = null;
      return;
    }
    this.swipeStart = { x: point.clientX, y: point.clientY, startedAt: Date.now() };
    this.swipeAxis = null;
    this.swipeMoved = false;
    clearTimeout(this.swipeClickTimer);
  },

  moveSwipe(event) {
    const start = this.swipeStart;
    const point = event.touches?.[0];
    if (!start || !point) return;
    const dx = point.clientX - start.x;
    const dy = point.clientY - start.y;
    if (!this.swipeAxis) {
      if (Math.hypot(dx, dy) < 8) return;
      this.swipeAxis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
    }
    if (this.swipeAxis !== "x") return;
    this.swipeMoved = true;
    const atEdge = (dx < 0 && this.data.current === this.data.lastQuestion)
      || (dx > 0 && this.data.current === this.data.firstQuestion);
    const offset = atEdge
      ? Math.round(Math.max(-18, Math.min(18, dx * 0.12)))
      : Math.round(Math.max(-56, Math.min(56, dx * 0.34)));
    const opacity = atEdge ? 1 : Number(Math.max(0.76, 1 - Math.abs(offset) / 220).toFixed(2));
    if (offset !== this.data.singleOffset || opacity !== this.data.singleOpacity || !this.data.singleDragging) {
      this.setData({ singleOffset: offset, singleOpacity: opacity, singleDragging: true });
    }
  },

  endSwipe(event) {
    const start = this.swipeStart;
    const end = event.changedTouches?.[0];
    this.swipeStart = null;
    const axis = this.swipeAxis;
    this.swipeAxis = null;
    if (this.swipeMoved) {
      clearTimeout(this.swipeClickTimer);
      this.swipeClickTimer = setTimeout(() => { this.swipeMoved = false; }, 120);
    }
    if (!start || !end) {
      if (this.data.singleOffset || this.data.singleOpacity !== 1 || this.data.singleDragging) {
        this.setData({ singleOffset: 0, singleOpacity: 1, singleDragging: false });
      }
      return;
    }
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    const distance = Math.abs(dx);
    const velocity = distance / Math.max(1, Date.now() - start.startedAt);
    const horizontal = distance > Math.abs(dy) * 1.2;
    const deliberate = distance >= 36 || (distance >= 22 && velocity >= 0.45);
    if ((axis === "x" || (!axis && horizontal && distance >= 22)) && horizontal && deliberate) {
      const moved = this.moveQuestion(dx < 0 ? 1 : -1);
      if (moved) return;
    }
    if (this.data.singleOffset || this.data.singleOpacity !== 1 || this.data.singleDragging) {
      this.setData({ singleOffset: 0, singleOpacity: 1, singleDragging: false });
    }
  },

  cancelSwipe() {
    this.swipeStart = null;
    this.swipeAxis = null;
    this.swipeMoved = false;
    if (this.data.singleOffset || this.data.singleOpacity !== 1 || this.data.singleDragging) {
      this.setData({ singleOffset: 0, singleOpacity: 1, singleDragging: false });
    }
  },

  persist() {
    if (!this.version || !this.attemptId) return;
    const { answers, marks, current, single, answered, title, identity } = this.data;
    if (!answered && !marks.some(Boolean) && current === 1 && !single && !this.savedDraft) return;
    const versionId = this.version.id;
    storage.saveDraft(versionId, { id: this.attemptId, versionId, answers: answers.map(value => value || null), marks, current, single });
    storage.setDraftEntry(versionId, {
      id: this.attemptId, answered, title, identity, questionCount: this.version.questionCount, versionId,
    });
    this.savedDraft = true;
  },

  openSections() {
    this.setData({ sheet: "sections" });
  },

  openScan() {
    this.scanSeq = (this.scanSeq || 0) + 1;
    this.scanResult = null;
    this.setData({
      sheet: "scan",
      sheetScrollTop: 0,
      scanPhase: "idle",
      scanPreview: "",
      scanError: "",
      scanSummary: null,
      scanLowConfidenceText: "",
      scanMode: this.data.answered > 0 ? "fill-blank" : "replace",
      scanCanApply: false,
    });
  },

  chooseScanImage() {
    if (!this.version) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["camera", "album"],
      sizeType: ["original"],
      success: (res) => {
        const file = res && Array.isArray(res.tempFiles) ? res.tempFiles[0] : null;
        if (!file || !file.tempFilePath) return;
        this.runScan(file.tempFilePath, Number(file.size) || 0);
      },
      fail: (error) => {
        const msg = String((error && error.errMsg) || "");
        if (/cancel/i.test(msg)) return;
        this.setData({
          scanPhase: "error",
          scanError: "无法打开相机或相册，请检查微信权限后重试。",
        });
      },
    });
  },

  readFileBase64(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: "base64",
        success: (res) => {
          if (typeof res.data === "string" && res.data) resolve(res.data);
          else reject(new Error("照片读取失败，请重新拍摄。"));
        },
        fail: () => reject(new Error("照片读取失败，请重新拍摄。")),
      });
    });
  },

  getImageInfo(src) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src,
        success: resolve,
        fail: () => reject(new Error("无法读取这张照片，请选择清晰的 JPG 图片重试。")),
      });
    });
  },

  convertToJpegViaCanvas(filePath, width, height) {
    return new Promise((resolve, reject) => {
      const longEdge = Math.max(width, height);
      const scale = longEdge > omrUtil.OMR_TARGET_EDGE ? omrUtil.OMR_TARGET_EDGE / longEdge : 1;
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));
      this.createSelectorQuery()
        .select("#omr-canvas")
        .fields({ node: true })
        .exec((results) => {
          const canvas = results && results[0] && results[0].node;
          if (!canvas) {
            reject(new Error("当前环境无法转换照片格式，请直接拍摄 JPG 照片。"));
            return;
          }
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext("2d");
          const img = canvas.createImage();
          img.onload = () => {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            wx.canvasToTempFilePath({
              canvas,
              fileType: "jpg",
              quality: 0.92,
              success: (out) => resolve(out.tempFilePath),
              fail: () => reject(new Error("照片转码失败，请重新拍摄。")),
            });
          };
          img.onerror = () => reject(new Error("照片解码失败，请重新选择。"));
          img.src = filePath;
        });
    });
  },

  async prepareScanJpeg(filePath, fileSize) {
    const info = await this.getImageInfo(filePath);
    const width = Number(info.width) || 0;
    const height = Number(info.height) || 0;
    if (!width || !height) throw new Error("照片尺寸无效，请重新拍摄。");
    const type = String(info.type || "").toLowerCase();
    const isJpeg = type === "jpeg" || type === "jpg" || /\.jpe?g$/i.test(filePath);
    const longEdge = Math.max(width, height);
    if (isJpeg && longEdge <= omrUtil.OMR_DIRECT_MAX_EDGE && (!fileSize || fileSize <= omrUtil.OMR_DIRECT_MAX_BYTES)) {
      return this.readFileBase64(filePath);
    }
    const convertedPath = await this.convertToJpegViaCanvas(filePath, width, height);
    return this.readFileBase64(convertedPath);
  },

  canApplyScan(summary, mode) {
    if (!summary || !summary.recognized) return false;
    if (this.data.answered > 0 && mode === "fill-blank") return summary.fillBlankAdded > 0;
    return true;
  },

  async runScan(filePath, fileSize) {
    const seq = (this.scanSeq || 0) + 1;
    this.scanSeq = seq;
    this.scanResult = null;
    this.setData({
      scanPhase: "loading",
      scanPreview: filePath,
      scanError: "",
      scanSummary: null,
      scanLowConfidenceText: "",
      scanCanApply: false,
    });
    try {
      const base64 = await this.prepareScanJpeg(filePath, fileSize);
      if (seq !== this.scanSeq) return;
      const result = await api.recognizeAnswerSheet({
        image: base64,
        expectedQuestions: this.version.questionCount,
      });
      if (seq !== this.scanSeq) return;
      const summary = omrUtil.summarizeOmrResult(result, {
        questionCount: this.version.questionCount,
        currentAnswers: this.data.answers,
      });
      if (summary.recognized === 0) {
        this.setData({
          scanPhase: "error",
          scanError: summary.warnings[0] || "未识别到有效涂黑，请重拍",
        });
        return;
      }
      const mode = this.data.answered > 0 ? "fill-blank" : "replace";
      const lowConfidenceText = summary.lowConfidenceCount > 0
        ? `${summary.lowConfidence.slice(0, 6).join("、")}${summary.lowConfidenceCount > 6 ? ` 等 ${summary.lowConfidenceCount} 题` : " 题"}`
        : "";
      this.scanResult = result;
      this.setData({
        scanPhase: "ready",
        scanSummary: summary,
        scanLowConfidenceText: lowConfidenceText,
        scanMode: mode,
        scanCanApply: this.canApplyScan(summary, mode),
      });
    } catch (error) {
      if (seq !== this.scanSeq) return;
      this.setData({
        scanPhase: "error",
        scanError: (error && error.message) || "识别失败，请重拍或手动录入。",
      });
    }
  },

  setScanMode(event) {
    const mode = event.currentTarget.dataset.mode === "replace" ? "replace" : "fill-blank";
    this.setData({
      scanMode: mode,
      scanCanApply: this.canApplyScan(this.data.scanSummary, mode),
    });
  },

  cancelScan() {
    this.scanSeq = (this.scanSeq || 0) + 1;
    this.setData({
      scanPhase: this.scanResult ? "ready" : "idle",
      scanError: "",
    });
  },

  applyScanResult() {
    if (!this.scanResult || !this.version || !this.data.scanCanApply) return;
    const mode = this.data.answered > 0 ? this.data.scanMode : "replace";
    const applied = omrUtil.applyOmrResult({
      result: this.scanResult,
      questionCount: this.version.questionCount,
      currentAnswers: this.data.answers,
      currentMarks: this.data.marks,
      mode,
    });
    this.scanResult = null;
    this.sheetDrag?.reset();
    this._sheetScrollTop = 0;
    this.setData({
      answers: applied.answers,
      marks: applied.marks,
      markOnly: false,
      sheet: "",
    });
    this.jump(applied.firstFocusQuestion);
    wx.showToast({
      title: omrUtil.formatOmrApplyToast({
        appliedCount: applied.appliedCount,
        lowConfidenceMarked: applied.lowConfidenceMarked,
        mode,
      }),
      icon: "none",
      duration: 2400,
    });
  },

  openSheet() {
    const sheetSections = this.data.sections.map(section => ({
      ...section,
      questions: this.data.allQuestions
        .filter(question => question.number >= section.start && question.number <= section.end)
        .map(question => ({ ...question, current: question.number === this.data.current })),
    }));
    this.setData({ sheet: "answers", sheetSections, sheetScrollTop: 0 }, () => {
      const query = this.createSelectorQuery();
      query.select(".sheet-scroll").boundingClientRect();
      query.select("#answer-sheet-" + this.data.current).boundingClientRect();
      query.exec(([list, cell]) => {
        // Leave room for the sticky section heading when jumping to a distant question.
        if (this.data.sheet === "answers" && list && cell && cell.bottom > list.bottom) {
          this.setData({ sheetScrollTop: Math.max(0, cell.top - list.top - 48) });
        }
      });
    });
  },

  closeSheet() {
    if (this.data.sheet === "scan") this.scanSeq = (this.scanSeq || 0) + 1;
    this.sheetDrag?.reset();
    this._sheetScrollTop = 0;
    this.setData({ sheet: "" });
  },

  noopSheet() {},
  onSheetScroll(event) { this.sheetDrag?.onScroll(event); },
  startSheetDrag(event) { this.sheetDrag?.start(event); },
  moveSheetDrag(event) { this.sheetDrag?.move(event); },
  endSheetDrag(event) { this.sheetDrag?.end(event); },
  cancelSheetDrag() { this.sheetDrag?.cancel(); },

  submit() {
    if (!this.data.submitting) this.setData({ sheet: "submit" });
  },

  confirmSubmission() {
    if (storage.position()?.id) this.doSubmit();
    else this.setData({ sheet: "position-prompt" });
  },

  openPosition() {
    this.setData({ sheet: "position" });
  },

  submitAfterPosition(event) {
    if (event.detail.position) this.doSubmit();
    else this.closeSheet();
  },

  async doSubmit() {
    if (this.data.submitting) return;
    this.setData({ submitting: true, sheet: "" });
    wx.showLoading({ title: "正在核分", mask: true });
    try {
      const answers = this.data.answers.map(value => (value ? value : null));
      // 只提交当前答卷的计时。第一次提交时冻结用时，失败重试仍用同一份数据。
      this.stopEntryClock();
      this.timingReceipt ??= timing.entrySummary(this.version.id, this.attemptId);
      const attempt = await api.submit({ version: this.version, answers, attemptId: this.attemptId, timing: this.timingReceipt });
      storage.upsertAttempt(attempt);
      wx.setStorageSync(storage.KEYS.marks(attempt.id), this.data.marks);
      storage.dropDraft(this.version.id);
      storage.clearPendingId(this.version.id, this.attemptId);
      storage.setDraftEntry(this.version.id, null);
      timing.clearEntryTiming(this.version.id, this.attemptId);
      this.attemptId = "";
      wx.hideLoading();
      wx.redirectTo({ url: `/pages/report/report?attemptId=${attempt.id}` });
    } catch (error) {
      wx.hideLoading();
      if (this.attemptId) this.setData({ submitting: false, sheet: "submit" });
      wx.showModal({ title: "交卷未完成", content: error.message, showCancel: false });
    }
  },

  onUnload() {
    this.scanSeq = (this.scanSeq || 0) + 1;
    this.sheetDrag?.reset();
    clearTimeout(this.singleAnimTimer);
    clearTimeout(this.swipeClickTimer);
    this.stopEntryClock();
    this.persist();
  },

  onHide() {
    this.entryVisible = false;
    this.stopEntryClock();
    this.persist();
  },
});
