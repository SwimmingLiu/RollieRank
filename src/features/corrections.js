import { esc, icon, score, date } from "../ui.js";

const statusNames = { pending: "待审核", partial: "部分已处理", approved: "已通过", rejected: "已拒绝", mixed: "已处理" };
const statusLabel = (status) => `<span class="correction-status correction-status-${esc(status)}">${statusNames[status] ?? "待审核"}</span>`;
const revisionLabel = (versionLabel, revision) => `v${esc(versionLabel)} · 答案修订 ${Number(revision ?? 0)}`;
const delta = (value) => `${value > 0 ? "+" : ""}${score(value)}`;
const actionButton = (action, label, className = "button outline", attrs = "") =>
  `<button type="button" class="${className}" data-correction-action="${action}" ${attrs}>${label}</button>`;
const errorBox = (message) => `<p class="correction-error" role="alert">${esc(message)}</p>`;
const makeId = () => globalThis.crypto.randomUUID();

export function createCorrectionsFeature(ctx) {
  let personal = { feedbacks: [], notifications: [] };
  let summary = null;
  let admin = null;
  let reviewToken = "";
  let loadError = "";
  let adminError = "";
  let draft = null;
  let reviewDraft = null;
  let busy = false;
  let generation = 0;
  let modalSubject = null;
  let syncNeeded = false;
  const reportAttempt = () => ctx.attempt?.();
  const findAttempt = (attemptId) => ctx.state().attempts.find((attempt) => attempt.id === attemptId) ??
    (reportAttempt()?.id === attemptId ? reportAttempt() : null);
  // 维护者也可能是反馈者；管理页以刚刷新的队列为准，避免旧个人缓存掩盖已处理状态。
  const findFeedback = (feedbackId) => ctx.route().page === "admin"
    ? admin?.feedbacks.find((feedback) => feedback.id === feedbackId) ?? personal.feedbacks.find((feedback) => feedback.id === feedbackId)
    : personal.feedbacks.find((feedback) => feedback.id === feedbackId) ?? admin?.feedbacks.find((feedback) => feedback.id === feedbackId);
  const close = () => { modalSubject = null; ctx.closeModal(); };
  const rerender = () => ctx.render();
  const modalError = (message) => {
    const node = document.querySelector("[data-correction-modal-error]");
    if (node) node.textContent = message;
    else ctx.toast(message);
  };
  const footer = (primary = "") => `${actionButton("close", "关闭")}${primary}`;

  async function refresh() {
    const currentGeneration = ++generation;
    const page = ctx.route().page;
    loadError = "";
    adminError = "";
    const jobs = [ctx.api("corrections/summary").then((value) => { if (currentGeneration === generation) summary = value; })];
    // 逐题对照现在也能打开纠错，直接进入该页时需要同一份反馈及通知上下文。
    if (["report", "details", "me"].includes(page)) jobs.push(ctx.api("corrections/list", { guestId: ctx.state().guestId })
      .then((value) => { if (currentGeneration === generation) personal = value; }));
    if (page === "admin" && reviewToken) jobs.push(ctx.api("corrections/admin", { reviewToken })
      .then((value) => { if (currentGeneration === generation) admin = value; })
      .catch((error) => { if (currentGeneration === generation) { admin = null; adminError = error.message; } }));
    const results = await Promise.allSettled(jobs);
    if (currentGeneration !== generation) return;
    loadError = results.find((result) => result.status === "rejected")?.reason.message ?? "";
    rerender();
  }

  const feedbackRows = (feedbacks) => feedbacks.map((feedback) => `<li class="correction-list-row"><div><b>${esc(feedback.paperTitle)}</b><small>第 ${feedback.items.map((item) => item.question).join("、")} 题 · ${revisionLabel(feedback.versionLabel, feedback.baseRevision)} · ${date(feedback.createdAt)}</small></div>${statusLabel(feedback.status)}${actionButton("detail", "查看", "text-button", `data-feedback-id="${esc(feedback.id)}"`)}</li>`).join("");
  const noticeRows = (notices) => notices.map((notice) => `<li class="correction-list-row"><div><b>${esc(notice.paperTitle)} · 标准答案已订正</b><small>第 ${notice.changes.map((change) => change.question).join("、")} 题 · 答案修订 ${notice.toRevision} · ${score(notice.before.totalCents)} → ${score(notice.after.totalCents)} 分</small></div>${actionButton("notice", "处理详情", "text-button", `data-notice-id="${esc(notice.id)}"`)}</li>`).join("");

  function reportHtml() {
    const attempt = reportAttempt();
    if (!attempt) return "";
    const feedbacks = personal.feedbacks.filter((feedback) => feedback.attemptId === attempt.id);
    const notices = personal.notifications.filter((notice) => notice.attemptId === attempt.id);
    return `<section class="card correction-card"><div class="correction-heading"><div><h2>答案反馈</h2><p>${revisionLabel(attempt.versionLabel, attempt.answerRevision)}${attempt.isSample ? " · 示例报告" : ""}</p></div>${actionButton("feedback", `${icon("flag")}反馈答案`, "button outline", attempt.isSample ? "disabled" : "")}</div>${attempt.isSample ? '<p class="correction-muted">完成正式练习后，可反馈题目答案。</p>' : ""}${loadError ? errorBox(loadError) : ""}${notices.length ? `<ul class="correction-list">${noticeRows(notices)}</ul>` : ""}${feedbacks.length ? `<ul class="correction-list">${feedbackRows(feedbacks)}</ul>` : ""}${syncNeeded ? actionButton("sync", "刷新正式成绩", "text-button") : ""}</section>`;
  }

  function userHtml() {
    return `<section class="card correction-card"><div class="correction-heading"><h2>反馈与订正通知</h2>${actionButton("refresh", `${icon("refresh")}刷新`, "text-button")}</div>${loadError ? errorBox(loadError) : ""}${personal.notifications.length ? `<ul class="correction-list">${noticeRows(personal.notifications)}</ul>` : ""}${personal.feedbacks.length ? `<ul class="correction-list">${feedbackRows(personal.feedbacks)}</ul>` : personal.notifications.length ? "" : `<p class="correction-muted">${summary ? "暂无反馈或答案订正通知。" : "正在读取反馈…"}</p>`}${syncNeeded ? actionButton("sync", "刷新正式成绩", "text-button") : ""}</section>`;
  }

  function adminHtml() {
    const pending = admin?.feedbacks.filter((feedback) => feedback.items.some((item) => item.status === "pending"));
    const handled = admin?.feedbacks.filter((feedback) => feedback.items.every((item) => item.status !== "pending"));
    return `<section class="card correction-card"><div class="correction-heading"><div><h2>答案反馈审核 ${summary ? `<span class="correction-count">${summary.pendingCount} 待审核</span>` : ""}</h2></div><div class="correction-actions">${actionButton("refresh", `${icon("refresh")}刷新`, "text-button")}${reviewToken ? actionButton("lock", "退出审核", "button outline") : actionButton("unlock", `${icon("lock")}维护者审核`, "button outline", summary?.reviewEnabled === false ? "disabled" : "")}</div></div>${summary?.reviewEnabled === false ? '<p class="correction-muted">审核尚未启用，请联系维护者配置审核凭证。</p>' : ""}${loadError || adminError ? errorBox(loadError || adminError) : ""}${admin ? `${pending.length ? `<ul class="correction-list">${pending.map((feedback) => `<li class="correction-list-row"><div><b>${esc(feedback.paperTitle)}</b><small>第 ${feedback.items.filter((item) => item.status === "pending").map((item) => item.question).join("、")} 题 · ${revisionLabel(feedback.versionLabel, feedback.baseRevision)}</small></div>${statusLabel(feedback.status)}${actionButton("review", "核对与审核", "button outline", `data-feedback-id="${esc(feedback.id)}"`)}</li>`).join("")}</ul>` : '<p class="correction-muted">当前没有待审核反馈。</p>'}${handled.length ? `<details class="correction-history"><summary>已处理反馈（${handled.length}）</summary><ul class="correction-list">${feedbackRows(handled)}</ul></details>` : ""}` : reviewToken ? '<p class="correction-muted">正在读取审核队列…</p>' : `<p class="correction-muted">${summary ? `${summary.pendingQuestionCount} 道题等待核对。` : "正在读取待审核数量…"}审核通过后会订正标准答案，并更新该版本的全部答卷。</p>`}${syncNeeded ? actionButton("sync", "重试成绩同步", "text-button") : ""}</section>`;
  }

  function afterRender() {
    for (const [slot, render] of [["corrections-report", reportHtml], ["corrections-user", userHtml], ["corrections-admin", adminHtml]]) {
      const node = document.querySelector(`[data-feature="${slot}"]`);
      if (node) node.innerHTML = render();
    }
  }

  function captureDraft() {
    if (!draft) return;
    draft.items = [...document.querySelectorAll("[data-correction-row]")].map((row) => ({
      question: row.querySelector("[name=question]").value,
      suggestedAnswer: row.querySelector("[data-suggested-answer]:checked")?.value ?? row.querySelector("[name=suggestedAnswer]")?.value ?? "",
      evidence: row.querySelector("[name=evidence]").value,
    }));
  }

  function feedbackForm() {
    const attempt = findAttempt(draft.attemptId);
    modalSubject = { type: "feedback", id: draft.attemptId };
    // Mobile feedback starts from an actual question and uses the paper UI; the foundation keeps its native form.
    const presentation = ctx.feedbackPresentation?.({ attempt, draft });
    if (presentation) {
      ctx.openModal(presentation.title, presentation.body, presentation.actions, "correction-dialog");
      return;
    }
    ctx.openModal("反馈答案", `<p class="correction-context">${esc(attempt.paperTitle)} · ${revisionLabel(attempt.versionLabel, draft.baseRevision)}</p><form id="correction-feedback-form" data-correction-form="feedback"><div class="correction-fields">${draft.items.map((item, index) => `<fieldset class="correction-fieldset" data-correction-row><legend>题目 ${index + 1}</legend><div class="correction-inputs"><label class="field-label">题号<input name="question" ${index === 0 ? "autofocus" : ""} type="number" min="1" max="${attempt.report.rows.length}" step="1" required value="${esc(item.question)}"/></label><label class="field-label">建议答案<select name="suggestedAnswer" required><option value="">请选择</option>${["A", "B", "C", "D"].map((answer) => `<option ${item.suggestedAnswer === answer ? "selected" : ""}>${answer}</option>`).join("")}</select></label><span class="correction-reference" data-correction-reference>${referenceFor(attempt, item.question)}</span>${draft.items.length > 1 ? actionButton("remove-row", icon("trash"), "icon-button", `data-row-index="${index}" aria-label="删除题目 ${index + 1}"`) : ""}</div><label class="field-label">核对依据<textarea name="evidence" rows="3" required maxlength="4000" aria-description="请填写出处、页码或核对过程">${esc(item.evidence)}</textarea></label></fieldset>`).join("")}</div>${actionButton("add-row", `${icon("paste")}添加题目`, "text-button")}<p class="correction-muted">提交后可以试算建议成立时的得分。正式成绩以审核后的参考答案为准。</p><p class="correction-error" data-correction-modal-error role="alert"></p></form>`, `${actionButton("close", "取消")}<button class="button primary" type="submit" form="correction-feedback-form">提交反馈</button>`, "correction-dialog");
  }
  const referenceFor = (attempt, question) => {
    const row = attempt.report.rows.find((item) => item.question === Number(question));
    return row ? `当前参考答案 ${esc(row.correctAnswer)}` : "";
  };

  function openFeedback(questionNumber) {
    // 标题栏可直接调用公开方法，也必须遵守原点击入口的保存锁，避免替换正在提交的草稿。
    if (busy) return false;
    const attempt = reportAttempt();
    if (!attempt || attempt.isSample) return false;
    // 对照页可带入题号；新入口不继承已取消表单中的题目，避免无意合并两次反馈。
    if (questionNumber !== undefined && (!Number.isInteger(questionNumber) || !attempt.report.rows.some((row) => row.question === questionNumber))) {
      ctx.toast("请选择这份答卷中的有效题号。");
      return false;
    }
    const preferred = questionNumber ?? ctx.defaultFeedbackQuestion?.(attempt);
    draft = { id: makeId(), attemptId: attempt.id,
      baseRevision: attempt.answerRevision ?? 0, items: [{ question: preferred === undefined ? "" : String(preferred), suggestedAnswer: "", evidence: "" }] };
    feedbackForm();
    return true;
  }

  async function saveFeedback(form) {
    if (!form.reportValidity() || busy) return;
    captureDraft();
    await saving(async () => {
      const result = await ctx.api("corrections/submit", { guestId: ctx.state().guestId,
        attemptId: draft.attemptId, feedbackId: draft.id, baseRevision: draft.baseRevision,
        changes: draft.items.map((item) => ({ ...item, question: Number(item.question) })) });
      personal.feedbacks = [result.feedback, ...personal.feedbacks.filter((item) => item.id !== result.feedback.id)];
      draft = null;
      ctx.toast("反馈已提交，可以查看审核进度。");
      showDetail(result.feedback.id);
      rerender();
    });
  }

  const itemsHtml = (feedback) => `<div class="correction-detail-items">${feedback.items.map((item) => `<article class="correction-detail-item"><div class="correction-heading"><b>第 ${item.question} 题</b>${statusLabel(item.status)}</div><p class="correction-answer-change">参考答案 <strong>${esc(item.originalAnswer)}</strong><span>→</span>建议 <strong>${esc(item.suggestedAnswer)}</strong></p><p class="correction-evidence">${esc(item.evidence)}</p>${item.stale ? '<p class="correction-error">这题的参考答案已订正，请按最新答案重新反馈。</p>' : ""}${item.reason ? `<p class="correction-reason">审核理由：${esc(item.reason)}</p><small>${date(item.reviewedAt, true)}${item.answerRevision ? ` · 答案修订 ${item.answerRevision}` : ""}</small>` : ""}</article>`).join("")}</div>`;

  function showDetail(feedbackId) {
    const feedback = findFeedback(feedbackId);
    if (!feedback) return;
    modalSubject = { type: "detail", id: feedbackId };
    const own = personal.feedbacks.some((item) => item.id === feedbackId);
    ctx.openModal("反馈处理详情", `<p class="correction-context">${esc(feedback.paperTitle)} · ${revisionLabel(feedback.versionLabel, feedback.baseRevision)}</p>${itemsHtml(feedback)}${own && feedback.items.some((item) => item.status === "pending") ? `<div class="correction-preview" data-correction-preview><p class="correction-muted">可试算建议答案成立时，这份答卷的得分变化。</p>${actionButton("preview", "试算影响", "button outline", `data-feedback-id="${esc(feedback.id)}"`)}</div>` : ""}`, footer(), "correction-dialog");
  }

  async function showPreview(feedbackId) {
    const panel = document.querySelector("[data-correction-preview]");
    if (!panel) return;
    panel.innerHTML = '<p class="correction-muted" role="status">正在试算…</p>';
    try {
      const result = await ctx.api("corrections/preview", { guestId: ctx.state().guestId, feedbackId });
      if (modalSubject?.type !== "detail" || modalSubject.id !== feedbackId || !panel.isConnected) return;
      panel.innerHTML = `<h3>若建议答案成立</h3><div class="correction-preview-scores"><span>当前正式成绩<b>${score(result.official.totalCents)}<small> 分</small></b></span><span>建议成立时<b>${score(result.projected.totalCents)}<small> 分</small></b></span><span>试算变化<b>${delta(result.deltaCents)}<small> 分</small></b></span></div><p class="correction-muted">按答案修订 ${result.baseRevision} 试算；正式成绩仍以审核结果为准。</p>`;
      // 试算会替换刚点击的按钮，让键盘焦点跟随新结果，避免留在已移除的节点上。
      const heading = panel.querySelector("h3");
      heading.tabIndex = -1;
      heading.focus();
    } catch (error) {
      if (panel.isConnected) panel.innerHTML = `${errorBox(error.message)}${actionButton("preview", "重试试算", "text-button", `data-feedback-id="${esc(feedbackId)}"`)}`;
    }
  }

  function showNotice(noticeId) {
    const notice = personal.notifications.find((item) => item.id === noticeId);
    if (!notice) return;
    modalSubject = { type: "notice", id: noticeId };
    ctx.openModal("标准答案订正", `<p class="correction-context">${esc(notice.paperTitle)} · v${esc(notice.versionLabel)} · 答案修订 ${notice.fromRevision} → ${notice.toRevision}</p><div class="correction-detail-items">${notice.changes.map((change) => `<p class="correction-answer-change">第 ${change.question} 题：<strong>${esc(change.beforeAnswer)}</strong><span>→</span><strong>${esc(change.afterAnswer)}</strong></p>`).join("")}</div><p class="correction-evidence">审核理由：${esc(notice.reason)}</p><p>这份答卷 ${score(notice.before.totalCents)} → ${score(notice.after.totalCents)} 分（${delta(notice.deltaCents)} 分）</p><p class="correction-muted">${date(notice.createdAt, true)} · 原答卷与提交时间已保留。</p>`, footer(actionButton("open-report", "查看最新报告", "button primary", `data-attempt-id="${esc(notice.attemptId)}"`)), "correction-dialog");
  }

  function unlock() {
    modalSubject = { type: "credential" };
    ctx.openModal("维护者审核", `<form id="correction-credential-form" data-correction-form="credential"><label class="field-label">维护者凭证<input name="reviewToken" type="password" autofocus required maxlength="4096" autocomplete="off"/></label><p class="correction-muted">凭证仅在当前页面会话中保留。</p><p class="correction-error" data-correction-modal-error role="alert"></p></form>`, `${actionButton("close", "取消")}<button type="submit" form="correction-credential-form" class="button primary">进入审核</button>`, "correction-dialog");
  }

  async function authorize(form) {
    if (!form.reportValidity() || busy) return;
    const field = form.querySelector("[name=reviewToken]");
    const credential = field.value;
    field.value = "";
    await saving(async () => {
      const result = await ctx.api("corrections/admin", { reviewToken: credential });
      reviewToken = credential;
      admin = result;
      summary = result;
      adminError = "";
      close();
      rerender();
    });
  }

  function openReview(feedbackId, preserve = false) {
    const feedback = admin?.feedbacks.find((item) => item.id === feedbackId);
    if (!feedback || !reviewToken) return;
    if (!preserve) reviewDraft = { feedbackId, reviewId: makeId(),
      expectedRevision: admin.versions.find((version) => version.id === feedback.versionId)?.answerRevision ?? 0,
      questionNumbers: feedback.items.filter((item) => item.status === "pending").map((item) => item.question), reason: "", decision: "approve" };
    modalSubject = { type: "review", id: feedbackId };
    const pending = feedback.items.filter((item) => item.status === "pending");
    ctx.openModal("核对答案反馈", `<p class="correction-context">${esc(feedback.paperTitle)} · ${revisionLabel(feedback.versionLabel, feedback.baseRevision)} · 当前修订 ${feedback.currentRevision}</p><form id="correction-review-form" data-correction-form="review"><div class="correction-review-items">${pending.map((item) => `<article class="correction-detail-item"><label class="correction-select-item"><input type="checkbox" name="questionNumbers" value="${item.question}" ${reviewDraft.questionNumbers.includes(item.question) ? "checked" : ""}/><b>第 ${item.question} 题</b><span>${esc(item.originalAnswer)} → ${esc(item.suggestedAnswer)}</span></label><p class="correction-evidence">${esc(item.evidence)}</p>${item.stale ? '<p class="correction-error">这题的参考答案已修订，只能拒绝旧反馈并请考生重新提交。</p>' : ""}</article>`).join("")}</div><label class="field-label">处理结论<select name="decision"><option value="approve" ${reviewDraft.decision === "approve" ? "selected" : ""}>通过并重算</option><option value="reject" ${reviewDraft.decision === "reject" ? "selected" : ""}>拒绝</option></select></label><label class="field-label">审核理由<textarea name="reason" rows="3" maxlength="2000" required>${esc(reviewDraft.reason)}</textarea></label><p class="correction-error" data-correction-modal-error role="alert"></p></form>`, `${actionButton("close", "取消")}<button type="submit" form="correction-review-form" class="button primary">核对处理范围</button>`, "correction-dialog");
  }

  function confirmReview(form) {
    if (!form.reportValidity() || busy) return;
    reviewDraft.questionNumbers = [...form.querySelectorAll("[name=questionNumbers]:checked")].map((input) => Number(input.value));
    reviewDraft.reason = form.querySelector("[name=reason]").value.trim();
    reviewDraft.decision = form.querySelector("[name=decision]").value;
    if (!reviewDraft.questionNumbers.length) { modalError("请至少选择一道题。"); return; }
    const feedback = findFeedback(reviewDraft.feedbackId);
    if (reviewDraft.decision === "approve" && feedback.items.some((item) => reviewDraft.questionNumbers.includes(item.question) && item.stale)) {
      modalError("所选题目的依据已过期，请拒绝旧反馈并按最新答案重新核对。"); return;
    }
    const count = admin.versions.find((version) => version.id === feedback.versionId)?.receiptCount ?? 0;
    const approve = reviewDraft.decision === "approve";
    modalSubject = { type: "confirm-review", id: feedback.id };
    ctx.openModal(approve ? "确认订正并重算" : "确认拒绝反馈", `<p class="correction-context">${esc(feedback.paperTitle)} · 第 ${reviewDraft.questionNumbers.join("、")} 题</p><p>${approve ? `将订正 ${reviewDraft.questionNumbers.length} 题，并重新计算该版本的 ${count} 份答卷。原答案和提交时间保留。` : `将拒绝所选 ${reviewDraft.questionNumbers.length} 题的反馈，并向反馈者显示审核理由。`}</p><p class="correction-evidence">${esc(reviewDraft.reason)}</p><p class="correction-error" data-correction-modal-error role="alert"></p>`, `${actionButton("back-review", "返回核对")}${actionButton("confirm-review", approve ? "确认通过并重算" : "确认拒绝", "button primary")}`, "correction-dialog");
  }

  async function syncResults() {
    // 成绩同步失败也继续刷新版本；两个读取都可重试，不能因网络失败重复审核。
    const results = await Promise.allSettled([
      Promise.resolve().then(() => ctx.syncAttempts()),
      Promise.resolve().then(() => ctx.refreshCatalog()),
    ]);
    syncNeeded = results.some((result) => result.status === "rejected");
    if (syncNeeded) {
      ctx.toast("审核结果已保存，成绩同步暂未完成，请重试刷新。");
    }
  }

  async function saveReview() {
    if (!reviewDraft || !reviewToken) return;
    await saving(async () => {
      await ctx.api("corrections/review", { ...reviewDraft, reviewToken });
      reviewDraft = null;
      close();
      ctx.toast("审核结果已保存。");
      await syncResults();
      await refresh();
    });
  }

  async function saving(operation) {
    if (busy) return;
    busy = true;
    modalError("");
    // iOS 复用 beUI BottomSheet；保存禁用范围由宿主提供，根应用仍使用原生 dialog。
    const modalRoot = document.querySelector(ctx.modalSelector ?? "dialog[open]");
    const buttons = [...(modalRoot?.querySelectorAll("button") ?? [])];
    const enabled = buttons.filter((button) => !button.disabled);
    enabled.forEach((button) => { button.disabled = true; });
    try { await operation(); }
    catch (error) { modalError(error.message); }
    finally {
      busy = false;
      enabled.forEach((button) => { if (button.isConnected) button.disabled = false; });
    }
  }

  async function click(event) {
    const button = event.target.closest?.("[data-correction-action]");
    if (!button || button.disabled) return;
    event.preventDefault();
    const action = button.dataset.correctionAction;
    if (busy && !["detail", "notice"].includes(action)) return;
    try {
      if (action === "close") close();
      else if (action === "feedback") openFeedback(button.dataset.question ? Number(button.dataset.question) : undefined);
      else if (action === "pick-feedback-question" && draft) {
        const question = Number(button.dataset.question), attempt = findAttempt(draft.attemptId);
        if (!Number.isInteger(question) || !attempt.report.rows.some(row => row.question === question)) return;
        const index = draft.items.findIndex(item => !item.question);
        if (index < 0) return;
        if (draft.items.some(item => Number(item.question) === question)) { modalError("这道题已在本次反馈中。"); return; }
        draft.items[index].question = String(question);
        feedbackForm();
      }
      else if (action === "cancel-feedback-question" && draft) {
        draft.items = draft.items.filter(item => item.question);
        if (draft.items.length) feedbackForm(); else close();
      }
      else if (action === "detail") showDetail(button.dataset.feedbackId);
      else if (action === "notice") showNotice(button.dataset.noticeId);
      else if (action === "preview") await showPreview(button.dataset.feedbackId);
      else if (action === "refresh") await refresh();
      else if (action === "unlock") unlock();
      else if (action === "lock") { reviewToken = ""; admin = null; reviewDraft = null; rerender(); }
      else if (action === "review") openReview(button.dataset.feedbackId);
      else if (action === "back-review") openReview(reviewDraft.feedbackId, true);
      else if (action === "confirm-review") await saveReview();
      else if (action === "add-row") {
        captureDraft();
        if (draft.items.length >= findAttempt(draft.attemptId).report.rows.length) { modalError("题目数量已达到这套卷的题量。"); return; }
        draft.items.push({ question: "", suggestedAnswer: "", evidence: "" });
        feedbackForm();
        document.querySelector("[data-correction-row]:last-child [name=question]")?.focus();
      } else if (action === "remove-row") {
        captureDraft(); draft.items.splice(Number(button.dataset.rowIndex), 1); feedbackForm();
      } else if (action === "sync") { await syncResults(); await refresh(); }
      else if (action === "open-report") { close(); ctx.navigate(`report/${encodeURIComponent(button.dataset.attemptId)}`); }
    } catch (error) { ctx.toast(error.message); }
  }

  function submit(event) {
    const form = event.target.closest?.("[data-correction-form]");
    if (!form) return;
    event.preventDefault();
    if (form.dataset.correctionForm === "feedback") void saveFeedback(form);
    else if (form.dataset.correctionForm === "credential") void authorize(form);
    else if (form.dataset.correctionForm === "review") confirmReview(form);
  }
  function change(event) {
    if (event.target.matches?.("[data-correction-row] [name=question]") && draft) {
      const row = event.target.closest("[data-correction-row]");
      row.querySelector("[data-correction-reference]").textContent = referenceFor(findAttempt(draft.attemptId), event.target.value);
    }
  }
  document.addEventListener("click", click);
  document.addEventListener("submit", submit);
  document.addEventListener("input", change);
  // 包装层只读取本答卷的通知副本，不能修改原缓存或另建分数状态。
  const reportNotifications = () => reportAttempt()?.isSample ? [] : structuredClone(personal.notifications.filter((notice) => notice.attemptId === reportAttempt()?.id));
  return { afterRender, onRoute: refresh, afterSubmit: refresh, openFeedback, reportNotifications,
    dispose() { generation++; reviewToken = ""; document.removeEventListener("click", click);
      document.removeEventListener("submit", submit); document.removeEventListener("input", change); } };
}
