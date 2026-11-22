// 全国逐题统计与面板共用一份整卷响应；切卷、离页和答案订正都会使旧响应失效。
export function createIOSInsightsFeature(ctx) {
  const document = ctx.document ?? globalThis.document;
  const ui = () => document.defaultView.RollieUI;
  let panel = null, panelObserver = null, disposePanel, active = true, generation = 0, contextId = "", routeId = "", national = null;
  const entryMounts = new Map();
  const choices = ["A", "B", "C", "D"];
  const realAttempt = () => { const attempt = ctx.attempt(); return attempt && !attempt.isSample ? attempt : null; };
  const validRate = (value) => value === null || (Number.isFinite(value) && value >= 0 && value <= 1);
  const validCount = (value) => Number.isSafeInteger(value) && value >= 0;
  const receiptKey = (attempt) => attempt ? JSON.stringify([ctx.state().guestId, attempt.id, attempt.versionId, attempt.answerRevision ?? 0,
    attempt.report?.rows?.map((row) => [row.question, row.answer, row.correctAnswer, row.status])]) : "";
  const currentRoute = () => { const route = ctx.route?.() ?? {}; return `${route.page ?? ""}:${route.id ?? ""}`; };
  function validInsights(data) {
    if (!data || !validCount(data.sampleCount) || !validCount(data.participantCount) || !Array.isArray(data.bands) ||
      !Array.isArray(data.questions) || !Array.isArray(data.subjects)) return false;
    const numbers = new Set();
    return data.questions.every((question) => {
      if (!Number.isSafeInteger(question.number) || question.number < 1 || numbers.has(question.number) || !choices.includes(question.correctAnswer) ||
        !(question.ownAnswer === null || choices.includes(question.ownAnswer)) || !Array.isArray(question.options) || question.options.length !== 4 ||
        !validCount(question.blank?.count) || !validRate(question.blank?.rate)) return false;
      numbers.add(question.number);
      const options = new Set();
      return question.options.every((option) => {
        if (!choices.includes(option.answer) || options.has(option.answer) || !validCount(option.count) || !validRate(option.rate)) return false;
        options.add(option.answer);
        return data.sampleCount ? option.rate !== null : option.rate === null;
      }) && question.options.reduce((sum, option) => sum + option.count, question.blank.count) === data.sampleCount;
    }) && data.subjects.every((subject) => validRate(subject.ownRate) && validRate(subject.averageRate) &&
      (subject.deltaRate === null || Number.isFinite(subject.deltaRate)) && (data.sampleCount > 0 || (subject.averageRate === null && subject.deltaRate === null)));
  }
  function syncContext() {
    const attempt = realAttempt(), route = currentRoute(), next = `${route}|${receiptKey(attempt)}`;
    if (next === contextId) return attempt;
    const moved = routeId && routeId !== route;
    routeId = route; contextId = next; national = null; generation++;
    if (panel) {
      if (moved || (panel.kind !== "public" && (!attempt || panel.attemptId !== attempt.id || panel.versionId !== attempt.versionId))) {
        const owned = document.querySelector('[data-ios-insights-panel]');
        panel = null; panelObserver?.disconnect(); panelObserver = null; disposePanel?.(); disposePanel = undefined;
        if (owned) ctx.closeModal();
      } else panel.loadedKey = "";
    }
    return attempt;
  }
  function releaseDetached() {
    for (const [host, dispose] of entryMounts) if (!host.isConnected) { dispose(); entryMounts.delete(host); }
  }
  function paintRows() {
    const attempt = realAttempt();
    if (!active || !attempt || ctx.route?.().page !== "details" || !ui()?.mountInsightQuestionStat) return;
    releaseDetached();
    const snapshot = national?.key === receiptKey(attempt) ? national : null;
    const questions = new Map((snapshot?.data?.questions ?? []).map((question) => [question.number, question]));
    const ownRows = new Map((attempt.report?.rows ?? []).map((row) => [row.question, row]));
    for (const host of document.querySelectorAll('.view[data-page="details"] [data-insight-row]')) {
      const number = Number(host.dataset.insightRow), question = questions.get(number), own = ownRows.get(number);
      if (!Number.isSafeInteger(number) || number < 1) continue;
      const wrong = question ? choices.includes(question.ownAnswer) && question.ownAnswer !== question.correctAnswer : own?.status === "wrong" && choices.includes(own.answer);
      const state = question ? { kind: "ready", correctRate: question.options.find((option) => option.answer === question.correctAnswer)?.rate ?? null,
        sameWrongRate: wrong ? question.options.find((option) => option.answer === question.ownAnswer)?.rate ?? null : null }
        : snapshot?.error || snapshot?.data ? { kind: "error" } : { kind: "loading" };
      entryMounts.set(host, ui().mountInsightQuestionStat(host, { question: number, wrong, state }));
    }
  }
  function nationwide(attempt, force = false) {
    const key = receiptKey(attempt);
    if (national?.key === key && national.pending) return national.pending;
    if (!force && national?.key === key && (national.data || national.error)) return Promise.resolve(national.data);
    const entry = { key, context: contextId, data: null, error: "", pending: null };
    national = entry; paintRows();
    entry.pending = (async () => {
      try {
        const query = new URLSearchParams({ versionId: attempt.versionId, guestId: ctx.state().guestId, attemptId: attempt.id, scope: "nationwide", band: "all" });
        const data = await ctx.api(`positions/insights?${query}`);
        if (!active || national !== entry || contextId !== entry.context) return null;
        if (!validInsights(data) || data.versionId !== attempt.versionId || data.scope !== "nationwide" || data.band !== "all") throw new Error("分析数据格式无效，请重试。");
        entry.data = data;
      } catch (error) {
        if (!active || national !== entry || contextId !== entry.context) return null;
        entry.error = error.message || "暂时无法读取统计。";
      } finally {
        entry.pending = null;
        if (active && national === entry && contextId === entry.context) paintRows();
      }
      return entry.data;
    })();
    return entry.pending;
  }
  function paint() {
    const host = document.querySelector('[data-ios-insights-panel]');
    if (!active || !panel || !ui()?.mountInsightPanel) return;
    // Cached responses can finish before BottomSheet's portal commits; mount the latest state once its host exists.
    if (!host) {
      if (!panelObserver) {
        panelObserver = new MutationObserver(paint);
        panelObserver.observe(document.body, { childList: true, subtree: true });
      }
      return;
    }
    panelObserver?.disconnect(); panelObserver = null;
    disposePanel = ui().mountInsightPanel(host, {
      state: panel.state, scope: panel.scope,
      onScope(scope) { if (!panel) return; panel.scope = scope; panel.positionId = null; void load(); },
      onBand(band) { if (!panel) return; panel.band = band; void load(); },
      onQuestion(question) { if (!panel || panel.state.kind !== "questions") return; panel.question = question; panel.state = { ...panel.state, question }; paint(); },
      onRetry: () => { void load(true); },
      // Transfer the question context after releasing this panel's observers and pending reads.
      onFeedback: typeof ctx.feedbackQuestion === "function" ? question => { ctx.closeModal(); ctx.feedbackQuestion(question); } : undefined,
    });
  }
  function load(force = false) {
    const current = panel;
    if (!current) return Promise.resolve();
    const query = new URLSearchParams({ versionId: current.versionId, guestId: ctx.state().guestId, scope: current.scope });
    if (current.positionId) query.set("positionId", current.positionId);
    if (current.kind === "public") query.set("publicId", current.publicId);
    else { query.set("attemptId", current.attemptId); query.set("band", current.band); }
    const key = `${query}|${receiptKey(realAttempt())}`;
    if (current.pending && current.requestKey === key) return current.pending;
    if (!force && current.loadedKey === key) { paint(); return Promise.resolve(); }
    const sequence = ++generation;
    current.requestKey = key; current.state = { kind: "loading" }; paint();
    const task = (async () => {
      try {
        const attempt = realAttempt();
        const shared = current.kind !== "public" && current.scope === "nationwide" && current.band === "all" && attempt?.id === current.attemptId;
        const data = shared ? await nationwide(attempt, force) : await ctx.api(`positions/${current.kind === "public" ? "public-result" : "insights"}?${query}`);
        if (!active || panel !== current || sequence !== generation) return;
        if (current.kind === "public") {
          if (!data?.result || !Array.isArray(data.result.subjects) || !validCount(data.participantCount)) throw new Error("公开成绩格式无效，请重试。");
          current.state = { kind: "public", data };
        } else {
          if (!validInsights(data) || data.versionId !== current.versionId) throw new Error(national?.error || "分析数据格式无效，请重试。");
          current.state = current.kind === "questions" ? { kind: "questions", data, question: current.question } : { kind: "comparison", data };
        }
        current.loadedKey = key;
      } catch (error) {
        if (!active || panel !== current || sequence !== generation) return;
        current.state = { kind: "error", message: error.message || "暂时无法读取，请重试。" };
      } finally { if (current.pending === task) current.pending = null; }
      paint();
    })();
    current.pending = task;
    return task;
  }
  function show(options) {
    const attempt = syncContext();
    if (options.kind !== "public" && !attempt) return;
    panel = { ...options, versionId: options.versionId || attempt?.versionId || ctx.version()?.id, attemptId: attempt?.id,
      band: "all", scope: options.scope || "nationwide", positionId: options.positionId || null, loadedKey: "", pending: null,
      state: { kind: "loading" } };
    ctx.openModal(options.kind === "public" ? "公开成绩" : options.kind === "questions" ? "答题分布" : "分数段对比", '<div data-ios-insights-panel></div>');
    queueMicrotask(() => { paint(); void load(); });
  }
  const close = ctx.onModalClose?.(() => { generation++; panel = null; panelObserver?.disconnect(); panelObserver = null; disposePanel?.(); disposePanel = undefined; });
  const onPublic = (event) => {
    const detail = event.detail;
    if (detail && typeof detail.publicId === "string") show({ kind: "public", ...detail });
  };
  document.addEventListener("rollierank:public-result", onPublic);
  return {
    afterRender() {
      const attempt = syncContext(); releaseDetached();
      if (!attempt) return;
      const header = document.querySelector('.view[data-page="report"] .rr6-radar-card [data-slot="card-header"]');
      if (header && !header.querySelector('[data-ios-insights-entry]') && ui()?.mountInsightEntry) {
        const host = document.createElement("span"); host.className = "rr-insight-entry"; host.dataset.iosInsightsEntry = "";
        header.append(host); entryMounts.set(host, ui().mountInsightEntry(host, { onOpen: () => show({ kind: "comparison" }) }));
      }
      for (const row of document.querySelectorAll('.view[data-page="details"] .detail-answer-row')) {
        const number = Number(row.getAttribute("aria-label")?.match(/^第(\d+)题/)?.[1]);
        const cell = row.querySelector('th[scope="row"]');
        if (!number || !cell || cell.querySelector('[data-insight-question]')) continue;
        const label = cell.textContent;
        const host = document.createElement("span"); host.dataset.insightQuestion = String(number); cell.replaceChildren(host);
        entryMounts.set(host, ui().mountInsightQuestionEntry(host, { question: number, label, onOpen: () => show({ kind: "questions", question: number }) }));
      }
      if (document.querySelector('.view[data-page="details"] [data-insight-row]')) { paintRows(); void nationwide(attempt); }
      if (panel) void load();
    },
    onRoute() {
      const attempt = syncContext();
      if (attempt && ctx.route?.().page === "details") { paintRows(); return nationwide(attempt); }
      if (panel) return load();
    },
    openComparison: () => show({ kind: "comparison" }),
    openQuestion: (question) => show({ kind: "questions", question }),
    destroy() { active = false; generation++; national = null; panelObserver?.disconnect(); panelObserver = null; close?.(); disposePanel?.(); for (const dispose of entryMounts.values()) dispose(); entryMounts.clear(); document.removeEventListener("rollierank:public-result", onPublic); },
  };
}
