const api = require("../../services/api.js");
const credits = require("../../services/tool-credits.js");
const storage = require("../../utils/storage.js");
const catalogUtil = require("../../utils/catalog.js");
const omrUtil = require("../../utils/omr.js");
const timing = require("../../utils/timing.js");
const { createPageSheetDrag } = require("../../utils/sheet-gesture.js");
const { resumeEntryTimer, pauseEntryTimer } = require("../../vendor/practice-timer.js");

const { ASSET } = require("../../config.js");

const CHOICES = ["A", "B", "C", "D"];
const DEFAULT_SCAN_COST = 0.1;

function creditUnits(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num * 10) : 0;
}

function showConfirmModal({ title, content, confirmText = "确定", cancelText = "取消", showCancel = true }) {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      confirmText,
      cancelText,
      showCancel,
      success: (res) => resolve(Boolean(res && res.confirm)),
      fail: () => resolve(false),
    });
  });
}

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
    scrollAnimated: true,
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
    scanCost: DEFAULT_SCAN_COST,
    scanCostText: credits.formatCredit(DEFAULT_SCAN_COST),
    scanBalance: null,
    scanBalanceText: "",
    scanCreditSignedIn: false,
    scanChargedText: "",
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
    if (this.data.sheet === "scan") this.refreshScanCredits();
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
      if (this.data.current > 1) this.jump(this.data.current, false, false);
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
    const questionNumber = Number(number);
    const index = questionNumber - 1;
    const answers = this.data.answers.slice();
    const firstAnswer = !answers[index];
    answers[index] = answers[index] === choice ? "" : choice;
    this.clearPageTurnTimers();
    this.setData({ answers, current: questionNumber, singleOffset: 0, singleOpacity: 1, singleDragging: false });
    this.reflect();
    if (answers[index] && (firstAnswer || this.data.single)) {
      this.moveQuestion(1, true, { delayMs: this.data.single ? 110 : 90 });
    }
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

  clearPageTurnTimers() {
    clearTimeout(this.listScrollTimer);
    clearTimeout(this.singleAdvanceTimer);
    clearTimeout(this.singleAnimTimer);
    this.pendingSingleNumber = 0;
  },

  scrollListToRow(number, { keepVisible = false, animated = true, delayMs = 0 } = {}) {
    clearTimeout(this.listScrollTimer);
    const id = "answer-" + number;
    const run = () => {
      if (this.data.single || this.data.current !== number) return;
      const query = this.createSelectorQuery();
      query.select(".practice__scroller").boundingClientRect();
      query.select(".practice__scroller").scrollOffset();
      query.select(".practice__scroller").node();
      query.select("#" + id).boundingClientRect();
      query.exec(([list, offset, scroller, row]) => {
        if (this.data.single || this.data.current !== number) return;
        if (!list || !row) {
          if (!keepVisible) this.setData({ scrollAnimated: animated, scrollTarget: id });
          return;
        }
        const outOfView = row.bottom > list.bottom - 4 || row.top < list.top + 4;
        if (keepVisible && !outOfView) return;
        const scrollerNode = scroller && scroller.node;
        if (scrollerNode && typeof scrollerNode.scrollTo === "function" && offset) {
          const targetTop = Math.max(0, Math.round(offset.scrollTop + (row.top - list.top) - 10));
          scrollerNode.scrollTo({ top: targetTop, duration: animated ? 320 : 0, animated });
        } else {
          this.setData({ scrollAnimated: animated, scrollTarget: id });
        }
      });
    };
    if (animated && delayMs > 0) this.listScrollTimer = setTimeout(run, delayMs);
    else run();
  },

  jump(number, keepVisible = false, animated = true, delayMs = 0) {
    this.clearPageTurnTimers();
    this.setData({ current: number, scrollTarget: "", singleOffset: 0, singleOpacity: 1, singleDragging: false });
    this.reflect();
    if (!this.data.single) {
      this.scrollListToRow(number, { keepVisible, animated, delayMs });
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
    this.jump(this.data.current, false, false);
  },

  transitionSingleTo(number, direction, { delayMs = 0, fromDrag = false } = {}) {
    this.clearPageTurnTimers();
    this.pendingSingleNumber = number;
    const exitOffset = direction > 0 ? -64 : 64;
    const enterOffset = direction > 0 ? 56 : -56;
    const exitMs = fromDrag ? 105 : 135;

    const startExit = () => {
      if (!this.data.single) return;
      this.setData({ singleOffset: exitOffset, singleOpacity: 0, singleDragging: false });
      this.singleAnimTimer = setTimeout(() => {
        if (!this.data.single) return;
        this.pendingSingleNumber = 0;
        this.setData(
          { current: number, singleOffset: enterOffset, singleOpacity: 0, singleDragging: true },
          () => {
            this.reflect();
            this.persist();
            // 留出两帧让微信双线程先提交离场起点的无过渡位置，再平滑滑入。
            this.singleAnimTimer = setTimeout(() => {
              if (!this.data.single) return;
              this.setData({ singleOffset: 0, singleOpacity: 1, singleDragging: false });
            }, 32);
          },
        );
      }, exitMs);
    };

    if (delayMs > 0) this.singleAdvanceTimer = setTimeout(startExit, delayMs);
    else startExit();
  },

  moveQuestion(direction, keepVisible = false, options = {}) {
    const { questions, currentQuestion, single } = this.data;
    const baseNumber = (single && this.pendingSingleNumber) || currentQuestion?.number;
    const position = questions.findIndex(question => question.number === baseNumber);
    const next = questions[position + direction];
    if (!next) return false;
    if (single) {
      this.transitionSingleTo(next.number, direction, options);
    } else {
      this.jump(next.number, keepVisible, true, options.delayMs || 0);
    }
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
      const moved = this.moveQuestion(dx < 0 ? 1 : -1, false, { fromDrag: true });
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

  async refreshScanCredits() {
    let cost = this.data.scanCost || DEFAULT_SCAN_COST;
    let walletAvailable = true;
    try {
      const quoted = await credits.quote("answer-sheet");
      if (quoted && Number.isFinite(quoted.cost) && quoted.cost > 0) cost = quoted.cost;
    } catch (error) {
      if (error?.errorId === "wallet-unavailable" || error?.statusCode === 503) walletAvailable = false;
    }
    let signedIn = false;
    let balance = null;
    if (walletAvailable && credits.hasSession()) {
      try {
        const wallet = await credits.wallet(0);
        signedIn = true;
        balance = wallet.balance;
      } catch (error) {
        if (error?.errorId === "wallet-unavailable" || error?.statusCode === 503) walletAvailable = false;
        signedIn = false;
        balance = null;
      }
    }
    this.setData({
      scanCost: cost,
      scanCostText: credits.formatCredit(cost),
      scanCreditSignedIn: signedIn,
      scanBalance: balance,
      scanBalanceText: balance === null ? "" : credits.formatCredit(balance),
    });
    return { cost, signedIn, balance, walletAvailable };
  },

  async showInsufficientCreditsModal(cost, balance) {
    const costText = credits.formatCredit(cost || DEFAULT_SCAN_COST);
    const balanceLine = typeof balance === "number" && Number.isFinite(balance)
      ? `当前可用余额 ${credits.formatCredit(balance)} 卷豆，`
      : "";
    const goRecharge = await showConfirmModal({
      title: "卷豆不足",
      content: `本次扫描答题卡需要消耗 ${costText} 卷豆，${balanceLine}卷豆不足，请先充值或领取后再试。`,
      confirmText: "去获取卷豆",
      cancelText: "手动录入",
    });
    if (goRecharge) {
      wx.navigateTo({ url: "/pages/credits/credits" });
    }
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
      scanChargedText: "",
      scanMode: this.data.answered > 0 ? "fill-blank" : "replace",
      scanCanApply: false,
    });
    this.refreshScanCredits();
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
        this.confirmAndRunScan(file.tempFilePath, Number(file.size) || 0);
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

  async confirmAndRunScan(filePath, fileSize) {
    const seq = (this.scanSeq || 0) + 1;
    this.scanSeq = seq;
    const priorPreview = this.data.scanPreview;
    const priorPhase = this.data.scanPhase;
    const restorePrior = () => {
      if (this.scanResult && priorPhase === "ready") {
        this.setData({ scanPhase: "ready", scanPreview: priorPreview });
      } else {
        this.setData({ scanPhase: "idle", scanPreview: "" });
      }
    };
    this.setData({
      scanPreview: filePath,
      scanError: "",
      scanChargedText: "",
    });
    const status = await this.refreshScanCredits();
    if (seq !== this.scanSeq || this.data.sheet !== "scan") return;
    const cost = status.cost || DEFAULT_SCAN_COST;
    const costText = credits.formatCredit(cost);

    if (status.walletAvailable && !status.signedIn) {
      const ok = await showConfirmModal({
        title: "确认消耗卷豆识图",
        content: `本次识别答题卡将消耗 ${costText} 卷豆（识别失败不扣豆）。\n请先登录微信账号核验卷豆余额，新账号首次登录即赠 3 卷豆。`,
        confirmText: "登录并识图",
        cancelText: "取消",
      });
      if (seq !== this.scanSeq || this.data.sheet !== "scan") return;
      if (!ok) {
        restorePrior();
        return;
      }
      wx.showLoading({ title: "正在登录", mask: true });
      let wallet;
      try {
        await credits.login({ bindLegacy: false });
        wallet = await credits.wallet(0);
      } catch (error) {
        wx.hideLoading();
        if (seq !== this.scanSeq || this.data.sheet !== "scan") return;
        this.setData({
          scanPhase: "error",
          scanError: (error && error.message) || "微信登录失败，请重试。",
        });
        return;
      }
      wx.hideLoading();
      if (seq !== this.scanSeq || this.data.sheet !== "scan") return;
      this.setData({
        scanCreditSignedIn: true,
        scanBalance: wallet.balance,
        scanBalanceText: credits.formatCredit(wallet.balance),
      });
      if (creditUnits(wallet.balance) < creditUnits(cost)) {
        this.setData({
          scanPhase: "error",
          scanError: `可用卷豆不足（需 ${costText} 卷豆，当前 ${credits.formatCredit(wallet.balance)} 卷豆）。`,
        });
        await this.showInsufficientCreditsModal(cost, wallet.balance);
        return;
      }
      this.runScan(filePath, fileSize, cost);
      return;
    }

    if (status.walletAvailable && status.signedIn && creditUnits(status.balance) < creditUnits(cost)) {
      this.setData({
        scanPhase: "error",
        scanError: `可用卷豆不足（需 ${costText} 卷豆，当前 ${credits.formatCredit(status.balance)} 卷豆）。`,
      });
      await this.showInsufficientCreditsModal(cost, status.balance);
      return;
    }

    const balanceTip = status.signedIn && status.balance !== null
      ? `\n当前可用余额：${credits.formatCredit(status.balance)} 卷豆`
      : "";
    const confirmed = await showConfirmModal({
      title: "确认消耗卷豆识图",
      content: `本次识别答题卡将消耗 ${costText} 卷豆（识别失败不扣豆）。${balanceTip}`,
      confirmText: "开始识图",
      cancelText: "取消",
    });
    if (seq !== this.scanSeq || this.data.sheet !== "scan") return;
    if (!confirmed) {
      restorePrior();
      return;
    }
    this.runScan(filePath, fileSize, cost);
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

  async runScan(filePath, fileSize, quotedCost = this.data.scanCost || DEFAULT_SCAN_COST) {
    const seq = (this.scanSeq || 0) + 1;
    this.scanSeq = seq;
    this.scanResult = null;
    this.setData({
      scanPhase: "loading",
      scanPreview: filePath,
      scanError: "",
      scanSummary: null,
      scanLowConfidenceText: "",
      scanChargedText: "",
      scanCanApply: false,
    });
    try {
      const base64 = await this.prepareScanJpeg(filePath, fileSize);
      if (seq !== this.scanSeq) return;
      const result = await api.recognizeAnswerSheet({
        image: base64,
        expectedQuestions: this.version.questionCount,
        quotedCost,
        operationId: storage.uuid(),
      });
      if (seq !== this.scanSeq) return;
      const summary = omrUtil.summarizeOmrResult(result, {
        questionCount: this.version.questionCount,
        currentAnswers: this.data.answers,
      });
      if (summary.recognized === 0) {
        this.setData({
          scanPhase: "error",
          scanError: summary.warnings[0] || "未识别到有效涂黑，请重拍（本次未扣卷豆）",
        });
        this.refreshScanCredits();
        return;
      }
      const mode = this.data.answered > 0 ? "fill-blank" : "replace";
      const lowConfidenceText = summary.lowConfidenceCount > 0
        ? `${summary.lowConfidence.slice(0, 6).join("、")}${summary.lowConfidenceCount > 6 ? ` 等 ${summary.lowConfidenceCount} 题` : " 题"}`
        : "";
      const charged = result && result.billing && Number(result.billing.charged);
      const scanChargedText = Number.isFinite(charged) && charged > 0
        ? `本次已消耗 ${credits.formatCredit(charged)} 卷豆`
        : "";
      this.scanResult = result;
      this.setData({
        scanPhase: "ready",
        scanSummary: summary,
        scanLowConfidenceText: lowConfidenceText,
        scanChargedText,
        scanMode: mode,
        scanCanApply: this.canApplyScan(summary, mode),
      });
      if (Number.isFinite(charged) && charged > 0) this.refreshScanCredits();
    } catch (error) {
      if (seq !== this.scanSeq) return;
      if (error && (error.statusCode === 402 || error.errorId === "balance")) {
        const status = await this.refreshScanCredits();
        const costText = credits.formatCredit(status.cost || quotedCost);
        this.setData({
          scanPhase: "error",
          scanError: `可用卷豆不足（需 ${costText} 卷豆），请充值后再试或手动录入。`,
        });
        await this.showInsufficientCreditsModal(status.cost || quotedCost, status.balance);
        return;
      }
      if (error && (error.statusCode === 401 || error.errorId === "login")) {
        storage.clearToolCreditSession();
        this.setData({
          scanCreditSignedIn: false,
          scanBalance: null,
          scanBalanceText: "",
          scanPhase: "error",
          scanError: "卷豆账号登录已过期，请点击重拍重新登录后识图。",
        });
        return;
      }
      if (error && error.statusCode === 409 && error.errorId === "quote") {
        await this.refreshScanCredits();
        this.setData({
          scanPhase: "error",
          scanError: `扫卡用量已更新为 ${this.data.scanCostText} 卷豆，请点击重拍重新确认。`,
        });
        return;
      }
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
    this.clearPageTurnTimers();
    clearTimeout(this.swipeClickTimer);
    this.stopEntryClock();
    this.persist();
  },

  onHide() {
    this.entryVisible = false;
    this.clearPageTurnTimers();
    this.stopEntryClock();
    this.persist();
  },
});
