// 原工作区把报告绑定到可变草稿，无法保留多次练习；路由层改用独立草稿与提交快照。
import { parseAnswers } from "./answers.js";
import { CHOICES, parseQuestionCsv, gradeVersion, resultCsv } from "./model.js";
import {
  STATE_KEY,
  initialState,
  loadState,
  saveState,
  newDraft,
  recordAttempt,
  syncAttemptSnapshots,
} from "./prototype-state.js";
import {
  icon,
  esc,
  score,
  button,
  routeLink,
  empty,
  shell,
  date,
} from "./ui.js";
import { homeView, paperView, unique } from "./views-home.js";
import {
  practiceView,
  answerGrid,
  reportView,
  detailsView,
} from "./views-practice.js";
import { rankView, meView, statsView } from "./views-records.js";
import {
  adminView,
  adminCatalog,
  adminImport,
  adminAudit,
  templateCsv,
} from "./views-admin.js";
import { drawPoster, downloadBlob } from "./poster.js";
import { createAnalyticsFeature } from "./features/analytics.js";
import { createDiscussionsFeature } from "./features/discussions.js";
import { createDiscussionsAdminFeature } from "./features/discussions-admin.js";
import { createCorrectionsFeature } from "./features/corrections.js";
import { createPositionsFeature } from "./features/positions.js";
import { subjectResponse, subjectVersion } from "./subjects.js";
import "./scrollbars.js";

const $ = (selector) => document.querySelector(selector);
const modal = $("#modal");
let catalog = [],
  state,
  storage,
  saveWarning = false,
  admin,
  adminToken = "",
  adminAuthRequired = false,
  adminLoadError = "";
let current = { page: "home" },
  sample,
  search = "",
  detailFilter = "all",
  typeFilter = "all",
  dimension = "total",
  historyPaper = "all",
  allTypes = false;
let toastTimer,
  pendingEntries = [],
  submitting = false;
let pendingRestore = null;
// 各任务模块只在这里组合，委托事件只注册一次，避免跨页重绘重复提交评论或反馈。
let features = [];
let routeGeneration = 0;
let modalOpener = null;
const posterOptions = {
  style: "score",
  showDate: false,
  name: null,
};
try {
  storage = window.localStorage;
} catch {
  storage = {
    getItem() {
      throw new Error("Storage blocked");
    },
    setItem() {
      throw new Error("Storage blocked");
    },
  };
}

async function api(path, data) {
  let response;
  try {
    const headers = data ? { "Content-Type": "application/json" } : {};
    if (adminToken && (path === "admin" || path.startsWith("admin/"))) {
      headers.Authorization = `Bearer ${adminToken}`;
    }
    response = await fetch(`/api/${path}`, {
      method: data ? "POST" : "GET",
      headers,
      ...(data ? { body: JSON.stringify(data) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    // 同一入口也承载评论和纠错，不再把所有网络失败都描述为答题失败。
    throw new Error("暂时连接不到本地服务。请保留当前页面，恢复连接后重试。");
  }
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error ?? "操作失败，请重试。"),
    { statusCode: response.status });
  // 公开界面的新旧成绩统一显示主板块，API保存的原题型与逐题权重保持原样。
  return subjectResponse(result);
}

function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 3600);
}

function persist() {
  try {
    saveState(storage, state);
    saveWarning = false;
  } catch {
    saveWarning = true;
  }
  if ($(".save-indicator")) {
    $(".save-indicator").classList.toggle("warning", saveWarning);
    $(".save-indicator").innerHTML =
      `${icon(saveWarning ? "info" : "check")}${saveWarning ? "保存失败，请勿关闭页面" : "草稿已保存到本机"}`;
  }
  if (saveWarning) toast("本机保存不可用，请保持页面打开并及时导出记录。");
}

const versionById = (id) => catalog.find((v) => v.id === id);
const selectedVersion = () => versionById(current.id);
const selectedDraft = () => state.drafts[current.id];
const selectedAttempt = () =>
  state.attempts.find((a) => a.id === current.id) ??
  (sample?.id === current.id ? sample : null);

async function syncAttempts() {
  if (!state) return;
  const result = await api("attempts/sync", { guestId: state.guestId,
    attemptIds: state.attempts.map((attempt) => attempt.id) });
  if (syncAttemptSnapshots(state, result.attempts)) persist();
  return result;
}

const featureContext = {
  state: () => state, catalog: () => catalog, route: () => current,
  attempt: selectedAttempt, version: selectedVersion, dimension: () => dimension,
  api, persist, toast, openModal, closeModal: () => modal.close(), navigate,
  render, refreshCatalog, submitAttempt, syncAttempts,
};

function featureView(name, context) {
  for (const feature of features) {
    const content = feature[name]?.(context);
    if (content !== undefined && content !== null) return content;
  }
  return null;
}

function navigate(path) {
  if (location.hash === "#/" + path) {
    current = parseRoute();
    render();
    window.scrollTo(0, 0);
  } else location.hash = "#/" + path;
}

function parseRoute() {
  try {
    const [page = "home", id] = location.hash
      .replace(/^#\/?/, "")
      .split("/")
      .map(decodeURIComponent);
    return { page: page || "home", id };
  } catch {
    return { page: "home" };
  }
}

function render() {
  if (!state) return;
  const focusedElement = document.activeElement;
  const focusId = focusedElement?.id;
  const focusKey = focusedElement?.dataset.focuskey;
  const selection =
    focusedElement?.tagName === "INPUT" &&
    ["search", "text"].includes(focusedElement.type)
      ? focusedElement.selectionStart
      : null;
  let content,
    focused = false,
    active = "home";
  const context = { catalog, state, saveWarning };
  const version = selectedVersion();
  if (current.page === "home") content = homeView({ ...context, search });
  else if (current.page === "paper" && version)
    content = paperView({ ...context, version });
  else if (current.page === "practice" && version) {
    if (!state.drafts[version.id]) {
      state.drafts[version.id] = newDraft(version);
      persist();
    }
    content = practiceView({
      ...context,
      version,
      draft: selectedDraft(),
      saveWarning,
    });
    focused = true;
  } else if (current.page === "report" && selectedAttempt())
    // 比较、讨论和订正使用同一份已同步的成绩，在原报告后呈现，避免另存可变分数。
    content = reportView({ ...context, attempt: selectedAttempt(), allTypes }) +
      '<div data-feature="analytics-comparison"></div><div data-feature="corrections-report"></div><div data-feature="discussions"></div>';
  else if (current.page === "details" && selectedAttempt())
    content = detailsView({
      ...context,
      attempt: selectedAttempt(),
      detailFilter,
      typeFilter,
    });
  else if (current.page === "rank" && catalog.length) {
    const target =
      version ?? catalog.find((v) => v.status === "published") ?? catalog[0];
    current.id = target.id;
    content = featureView("rankView", { ...context, version: target, dimension }) ??
      rankView({ ...context, version: target, dimension });
    active = "rank";
  } else if (current.page === "me") {
    if (
      historyPaper !== "all" &&
      !state.attempts.some((a) => a.paperId === historyPaper)
    )
      historyPaper = "all";
    content = meView({ ...context, historyPaper }) +
      '<div data-feature="positions-profile"></div><div data-feature="analytics-entry"></div><div data-feature="corrections-user"></div>';
    active = "me";
  } else if (current.page === "stats") {
    content = featureView("statsView", { ...context, version, versionId: current.id }) ??
      statsView({ ...context, version, versionId: current.id });
    active = "me";
  } else if (current.page === "admin") {
    content = adminView({ admin, authRequired: adminAuthRequired, error: adminLoadError });
    active = "admin";
  } else
    content = `<div class="card">${empty("这页练习暂时找不到了", "成绩保存在提交时使用的浏览器中，可以返回选卷继续。", routeLink("home", "返回选卷", "button primary"))}</div>`;
  const hadMainFocus = !modal.open && Boolean($("#main")?.contains(document.activeElement) || document.activeElement?.id === "main");
  $("#app").innerHTML = shell(
    `${saveWarning ? '<p class="notice warning">本机保存不可用，请保持页面打开并及时导出记录。</p>' : ""}${content}`,
    { state, active, focused, adminLocked: adminAuthRequired, adminAuthorized: Boolean(adminToken) },
  );
  // 选岗放在身份之后，VS 紧接成绩摘要，避免新增功能被长历史或题型表挤到页尾。
  const moveSlotAfter = (name, selector) => {
    const slot = $(`[data-feature="${name}"]`);
    const anchor = $(selector);
    if (slot && anchor) anchor.after(slot);
  };
  moveSlotAfter("positions-profile", ".profile-card");
  moveSlotAfter("analytics-comparison", ".report-layout");
  const analyticsEntry = $('[data-feature="analytics-entry"]');
  if (analyticsEntry && $(".same-paper-card")) $(".same-paper-card").before(analyticsEntry);
  for (const feature of features) feature.afterRender?.();
  if (focusId) {
    const target = document.getElementById(focusId);
    target?.focus({ preventScroll: true });
    if (selection !== null && target?.setSelectionRange)
      target.setSelectionRange(selection, selection);
  } else if (focusKey)
    $(`[data-focuskey="${CSS.escape(focusKey)}"]`)?.focus({
      preventScroll: true,
    });
  else if (hadMainFocus && (!document.activeElement || document.activeElement === document.body)) {
    const main = $("#main");
    if (main) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    }
  }
}

async function onRoute() {
  const generation = ++routeGeneration;
  const previousPage = current.page;
  current = parseRoute();
  if (previousPage !== current.page) {
    detailFilter = "all";
    typeFilter = "all";
    allTypes = false;
    dimension = "total";
  }
  modal.close();
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
  // 离开结果页时必须立即通知讨论模块释放麦克风，不能等可能失败的成绩同步。
  const featureRefresh = Promise.allSettled(features.map((feature) => feature.onRoute?.()));
  // 路由切换时重取订正后的成绩；异步返回不能把用户拉回已经离开的页面。
  try {
    if (["report", "details", "rank", "me", "stats"].includes(current.page)) {
      await syncAttempts();
      if (generation !== routeGeneration) return;
      render();
    }
  } catch (error) {
    if (generation === routeGeneration) toast(error.message);
  }
  const featureResults = await featureRefresh;
  if (generation !== routeGeneration) return;
  const featureError = featureResults.find((result) => result.status === "rejected");
  if (featureError) toast(featureError.reason.message);
  if (current.page === "admin") {
    await loadAdminData();
  }
}

async function loadAdminData() {
  adminLoadError = "";
  try {
    admin = await api("admin");
    adminAuthRequired = false;
    if (current.page === "admin") render();
  } catch (error) {
    if (error.statusCode === 401) {
      admin = null;
      adminAuthRequired = true;
      if (current.page === "admin") render();
      return;
    }
    adminLoadError = error.message;
    toast(error.message);
    if (current.page === "admin") render();
  }
}

function openAdminUnlockModal() {
  openModal(
    "解锁运营后台",
    `<form id="admin-unlock-form">
      <label class="field-label">维护者凭证<input name="reviewToken" type="password" autofocus required maxlength="4096" autocomplete="off" placeholder="输入 ROLLIERANK_REVIEW_TOKEN"/></label>
      <p class="field-help">一次验证即可解锁套卷管理、评论审核与答案纠错，凭证仅保留在当前内存会话中。</p>
      <p class="disc-admin-error" id="admin-unlock-error" role="alert"></p>
    </form>`,
    `${button("close-modal", "取消", "button outline")}<button type="submit" form="admin-unlock-form" class="button primary">验证并解锁</button>`,
  );
}

function openModal(title, body, actions = "", className = "") {
  const wasOpen = modal.open;
  // 连续的反馈、审核确认会替换已打开的弹窗；保留原触发点，并把焦点移入新内容。
  if (!wasOpen) {
    const target = document.activeElement;
    const attributes = ["data-action", "data-position-action", "data-correction-action", "data-discussions-action"];
    const key = attributes.find((attribute) => target?.hasAttribute(attribute));
    modalOpener = { target, id: target?.id, key, value: key ? target.getAttribute(key) : null,
      route: `${current.page}:${current.id ?? ""}` };
  }
  modal.className = className;
  modal.innerHTML = `<div class="modal-heading"><h2 id="modal-title">${title}</h2>${button("close-modal", icon("close"), "icon-button", 'aria-label="关闭弹窗"')}</div><div class="modal-body">${body}</div>${actions ? `<div class="modal-actions">${actions}</div>` : ""}`;
  if (!modal.open) modal.showModal();
  if (wasOpen) {
    const focusTarget = modal.querySelector('[autofocus]') ??
      modal.querySelector('.modal-body input:not([type="hidden"]):not(:disabled), .modal-body textarea:not(:disabled), .modal-body select:not(:disabled), .modal-body button:not(:disabled)') ??
      modal.querySelector('.modal-actions button:not(:disabled), .modal-heading button');
    focusTarget?.focus({ preventScroll: true });
  }
}

function confirm(
  title,
  description,
  action,
  label,
  attrs = "",
  danger = false,
) {
  openModal(
    title,
    `<p class="dialog-description">${description}</p>`,
    `${button("close-modal", "再想想", "button outline")}${button(action, label, `button ${danger ? "danger-fill" : "primary"}`, attrs)}`,
  );
}

function updateDraft() {
  selectedDraft().updatedAt = Date.now();
  persist();
  render();
}

function jump(question) {
  const version = selectedVersion();
  if (
    !Number.isInteger(question) ||
    question < 1 ||
    question > version.questionCount
  ) {
    toast(`请输入 1–${version.questionCount} 之间的题号。`);
    return;
  }
  selectedDraft().current = question;
  persist();
  render();
}

function selectAnswer(answer) {
  const draft = selectedDraft();
  draft.answers[draft.current - 1] = answer;
  if (draft.autoNext && draft.current < selectedVersion().questionCount)
    draft.current++;
  updateDraft();
}

function changeFilter(key, value) {
  state.filters[key] = value;
  if (["institution", "project", "period"].includes(key)) {
    let versions = catalog.filter(
      (v) =>
        v.status === "published" && v.institution === state.filters.institution,
    );
    if (key === "institution")
      state.filters.project = versions[0]?.project ?? "暂无考试项目";
    versions = versions.filter((v) => v.project === state.filters.project);
    if (key !== "period")
      state.filters.period = versions[0]?.period ?? "暂无期数";
    state.filters.variant =
      versions.find((v) => v.period === state.filters.period)?.variant ?? "";
  }
  persist();
  render();
}

function openBulk() {
  pendingEntries = [];
  openModal(
    "批量粘贴答案",
    `<p class="dialog-description">把已作答的选项粘贴进来，先核对预览，再确认录入。</p><div class="format-examples"><span><b>连续选项</b><code>ABCD-ABCD</code></span><span><b>带题号</b><code>1.A 2.B 3.C</code></span><span><b>分组题号</b><code>1-5 ABCDA</code></span></div><label class="field-label inline">连续选项起始题号<input id="bulk-start" type="number" min="1" max="${selectedVersion().questionCount}" value="${selectedDraft().current}"/></label><label class="sr-only" for="bulk-input">粘贴答案</label><textarea id="bulk-input" rows="6" placeholder="在这里粘贴答案，空题可用 -、_ 或 ? 占位" spellcheck="false" autocapitalize="characters"></textarea><div id="bulk-preview" class="bulk-preview" aria-live="polite">粘贴后会显示题号范围及覆盖数量。</div>`,
    `${button("close-modal", "取消", "button outline")}${button("bulk-confirm", "确认录入", "button primary", 'id="bulk-confirm" disabled')}`,
    "bulk-modal",
  );
  $("#bulk-input").focus();
}

function updateBulk() {
  const value = $("#bulk-input").value;
  const start = $("#bulk-start");
  start.disabled = /\d/.test(value.normalize("NFKC"));
  pendingEntries = [];
  $("#bulk-confirm").disabled = true;
  const preview = $("#bulk-preview");
  preview.classList.remove("error");
  if (!value.trim()) {
    preview.textContent = "粘贴后会显示题号范围及覆盖数量。";
    return;
  }
  try {
    pendingEntries = parseAnswers(
      value,
      start.disabled ? 1 : Number(start.value),
      selectedVersion().questionCount,
    );
    const overwritten = pendingEntries.filter(
      (entry) => selectedDraft().answers[entry.question - 1] !== null,
    ).length;
    preview.innerHTML = `<b>识别 ${pendingEntries.length} 题</b><span>第 ${pendingEntries[0].question}–${pendingEntries.at(-1).question} 题${overwritten ? `，将覆盖 ${overwritten} 个已有选项` : ""}。</span><div class="preview-chips">${pendingEntries
      .slice(0, 20)
      .map((q) => `<span>${q.question}. ${q.answer ?? "空"}</span>`)
      .join("")}${pendingEntries.length > 20 ? "<span>…</span>" : ""}</div>`;
    $("#bulk-confirm").disabled = false;
  } catch (error) {
    pendingEntries = [];
    preview.textContent = error.message;
    preview.classList.add("error");
  }
}

function openSubmit() {
  const version = selectedVersion(),
    draft = selectedDraft();
  const blanks = draft.answers.flatMap((a, i) => (a ? [] : [i + 1]));
  openModal(
    blanks.length
      ? `还有 ${blanks.length} 题没有作答`
      : "认真完成了，核对一下再提交",
    `<p class="dialog-description">已答 ${version.questionCount - blanks.length} / ${version.questionCount} 题。${blanks.length ? "未答题按 0 分计入，确认后可查看完整报告。" : "提交后保留这次成绩，再次练习会创建新记录。"}</p>${
      blanks.length
        ? `<div class="missing-questions">${blanks
            .slice(0, 30)
            .map((n) =>
              button(
                "fill-missing",
                String(n),
                "missing-chip",
                `data-question="${n}"`,
              ),
            )
            .join(
              "",
            )}${blanks.length > 30 ? `<span>另 ${blanks.length - 30} 题</span>` : ""}</div><p class="field-help">点击题号可返回补答。</p>`
        : ""
    }${draft.marks.length ? `<p class="notice warning">另有 ${draft.marks.length} 题标记为待检查：${draft.marks.join("、")}。</p>` : ""}<p id="submit-error" class="form-error" aria-live="polite"></p>`,
    `${button("close-modal", blanks.length ? "返回补答" : "再检查一下", "button outline")}${button("submit-attempt", "确认提交并查看成绩", "button primary", 'id="submit-attempt"')}`,
  );
}

async function submitAttempt() {
  if (submitting) return;
  // 正式交卷已在服务端原子入榜，选岗提醒继续提交时无需额外的公开选择。
  for (const feature of features)
    if (await feature.beforeSubmit?.() === false) return;
  if (!selectedDraft()) return;
  submitting = true;
  const submitButton = $("#submit-attempt");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner"></span>正在生成成绩';
  }
  try {
    const draft = selectedDraft();
    const attempt = await api("submit", {
      versionId: current.id,
      attemptId: draft.id,
      guestId: state.guestId,
      answers: draft.answers,
      name: state.profile?.name || "卷友",
    });
    recordAttempt(state, attempt);
    persist();
    modal.close();
    const followups = await Promise.allSettled(features.map((feature) => feature.afterSubmit?.(attempt)));
    navigate(`report/${encodeURIComponent(attempt.id)}`);
    toast(
      saveWarning
        ? "成绩已生成，请立即导出备份。"
        : followups.some((result) => result.status === "rejected")
          ? "成绩已保存，部分关联信息同步失败，可在记录页重试。"
        : "这一次的努力，已经好好记下了。",
    );
  } catch (error) {
    if ($("#submit-error")) $("#submit-error").textContent = error.message;
    else toast(error.message);
    if (submitButton?.isConnected) {
      submitButton.disabled = false;
      submitButton.textContent = "重新提交";
    }
  } finally {
    submitting = false;
  }
}

function login() {
  openModal(
    "给自己一个小小的名字",
    `<p class="dialog-description">设置本机昵称，用于练习榜和评论。</p><form id="login-form"><label class="field-label">匿名昵称<input name="name" id="profile-name" maxlength="16" minlength="1" value="${esc(state.profile?.name ?? "")}" placeholder="例如：每天多一分" required autocomplete="nickname"/></label><p class="privacy-inline">这是本机体验身份，不是微信登录。记录不会上传到微信或跨设备同步。</p><div class="form-actions"><button class="button primary full" type="submit">${state.profile ? "保存昵称" : "开始体验"}${icon("arrow")}</button></div></form>`,
    "",
    "login-modal",
  );
}


function settings() {
  if (!state.profile) {
    login();
    return;
  }
  openModal(
    "我的隐私与设置",
    `<div class="settings-profile"><span class="avatar large">${esc(state.profile.name[0])}</span><div><h3>${esc(state.profile.name)}</h3><p>本机体验身份</p></div></div><div class="settings-list">${button("login", `修改匿名昵称 ${icon("right")}`, "settings-row")}${button("privacy", `隐私与数据说明 ${icon("right")}`, "settings-row")}${button("logout", `退出体验身份 ${icon("logout")}`, "settings-row danger")}</div><p class="privacy-inline">退出身份后保留练习记录。</p>`,
  );
}

async function openPoster() {
  const attempt = selectedAttempt();
  posterOptions.style = "score";
  posterOptions.name = null;
  posterOptions.showDate = false;
  openModal(
    "把这一次成绩，留成一张卡片",
    `<div class="poster-layout"><div class="poster-preview"><canvas id="poster-canvas" aria-label="成绩海报预览"></canvas></div><div class="poster-controls"><span class="field-label">选择样式</span><div class="poster-styles">${[
      ["score", "成绩摘要", "分数与题型概览"],
      ["grid", "题号色块", "定位错题与漏答"],
      ["answers", "答案对照", "仅供本人复盘存档"],
    ]
      .map(([id, title, description]) =>
        button(
          "poster-style",
          `<b>${title}</b><small>${description}</small>${icon("check")}`,
          `poster-style ${id === "score" ? "selected" : ""}`,
          `data-value="${id}"`,
        ),
      )
      .join(
        "",
      )}</div><span class="field-label">选择公开内容</span><label class="checkbox-row"><input id="poster-name" type="checkbox" ${state.profile ? "" : "disabled"}/>显示匿名昵称${state.profile ? "" : "（可在我的中设置）"}</label><label class="checkbox-row"><input id="poster-date" type="checkbox"/>显示练习日期</label><div id="poster-privacy" class="privacy-inline">默认匿名。分享只包含你确认的字段，不包含私人报告链接。</div><p class="field-help">当前为本机原型，海报通过套卷名称回访；微信小程序码待正式接入。</p></div></div>`,
    `${button("copy-paper-link", `${icon("share")}复制同卷链接`, "button outline", 'id="poster-copy-link"')}${button("save-poster", `${icon("download")}保存 PNG 海报`, "button primary")}`,
    "poster-modal",
  );
  await drawPoster($("#poster-canvas"), attempt, posterOptions);
}

async function redrawPoster() {
  if (!$("#poster-canvas")) return;
  posterOptions.name = $("#poster-name")?.checked ? state.profile?.name : null;
  posterOptions.showDate = $("#poster-date")?.checked ?? false;
  await drawPoster($("#poster-canvas"), selectedAttempt(), posterOptions);
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    openModal(
      "复制内容",
      `<p class="dialog-description">可选择下方文字并复制。</p><textarea readonly rows="4" aria-label="待复制内容">${esc(text)}</textarea>`,
      button("close-modal", "完成", "button primary"),
    );
  }
}

function showAdminTab(value, revision = null) {
  document
    .querySelectorAll(".admin-tabs button")
    .forEach((b) => b.classList.toggle("selected", b.dataset.value === value));
  $("#admin-panel").innerHTML =
    value === "import"
      ? adminImport(admin, revision)
      : value === "audit"
        ? adminAudit(admin)
        : adminCatalog(admin);
}

function validateImport() {
  const form = $("#import-form");
  if (!form.reportValidity()) return null;
  try {
    const data = Object.fromEntries(new FormData(form));
    const questions = parseQuestionCsv(data.csv);
    // 导入预览同样按主板块显示，提交的原CSV仍保留机构提供的题型与逐题权重。
    const version = subjectVersion({ questions });
    const correct = gradeVersion(
      version,
      questions.map((q) => q.correctAnswer),
    );
    const wrong = gradeVersion(
      version,
      questions.map((q) => CHOICES.find((a) => a !== q.correctAnswer)),
    );
    const blank = gradeVersion(
      version,
      questions.map(() => null),
    );
    const mixed = gradeVersion(
      version,
      questions.map((q, i) => (i % 2 ? null : q.correctAnswer)),
    );
    $("#import-preview").innerHTML =
      `<div class="import-success"><b>${icon("check")}整卷校验通过</b><span>${questions.length} 题 · ${correct.breakdown.length} 类题型 · 满分 ${score(correct.maxCents)} 分</span><div class="trial-results"><span>全对 <b>${score(correct.totalCents)}</b></span><span>全错 <b>${score(wrong.totalCents)}</b></span><span>全空 <b>${score(blank.totalCents)}</b></span><span>交替答对 / 空 <b>${score(mixed.totalCents)}</b></span></div></div>`;
    return data;
  } catch (error) {
    $("#import-preview").innerHTML =
      `<p class="form-error preserve-space">${esc(error.message)}</p>`;
    return null;
  }
}

async function refreshCatalog() {
  const [publicData, adminData] = await Promise.all([
    api("catalog"),
    api("admin"),
  ]);
  catalog = publicData.versions;
  admin = adminData;
}

const actions = {
  "close-modal": () => {
    if (!submitting) modal.close();
  },
  help: () =>
    openModal(
      "一份练习，三步记下来",
      `<div class="help-steps"><div><b>01</b><span><strong>选择正在练习的套卷</strong><p>核对机构、期数、卷别和版本后开始。</p></span></div><div><b>02</b><span><strong>录入纸质题本上的选项</strong><p>逐题点击，或批量粘贴。电脑支持 A–D 录入、左右键切题；答案即时保存在本机。</p></span></div><div><b>03</b><span><strong>看成绩，回到题本复盘</strong><p>提交后查看题型分析、答案对照和 CSV。再次作答会保留过去的每一次成绩。</p></span></div></div><p class="notice">按机构练习评分参考估分，实际考试评分以考试组织方为准。</p>`,
      button("close-modal", "开始练习", "button primary"),
    ),
  institution: (b) => changeFilter("institution", b.dataset.value),
  variant: (b) => changeFilter("variant", b.dataset.value),
  "status-filter": (b) => changeFilter("status", b.dataset.value),
  "reset-filters": () => {
    state.filters = initialState().filters;
    search = "";
    persist();
    render();
  },
  sample: async (b) => {
    const id =
      b.dataset.version ?? catalog.find((v) => v.status === "published")?.id;
    if (!id) return;
    b.disabled = true;
    try {
      sample = await api("sample", { versionId: id });
      try {
        sessionStorage.setItem("rollierank:sample", JSON.stringify(sample));
      } catch {
        /* 示例可留在内存，存储禁用不阻断报告体验。 */
      }
      navigate(`report/${encodeURIComponent(sample.id)}`);
    } finally {
      b.disabled = false;
    }
  },
  answer: (b) => selectAnswer(b.dataset.answer),
  prev: () => jump(Math.max(1, selectedDraft().current - 1)),
  next: () =>
    jump(
      Math.min(selectedVersion().questionCount, selectedDraft().current + 1),
    ),
  question: (b) => {
    jump(Number(b.dataset.question));
    modal.close();
  },
  "clear-answer": () => {
    selectedDraft().answers[selectedDraft().current - 1] = null;
    updateDraft();
  },
  mark: () => {
    const draft = selectedDraft();
    draft.marks = draft.marks.includes(draft.current)
      ? draft.marks.filter((n) => n !== draft.current)
      : [...draft.marks, draft.current];
    updateDraft();
  },
  sheet: () =>
    openModal(
      "答题卡",
      `<div class="sheet-legend"><span><i class="done"></i>已答</span><span><i></i>未答</span><span><i class="mark"></i>待检查</span></div>${answerGrid(selectedVersion(), selectedDraft())}`,
      `${button("bulk", `${icon("paste")}批量粘贴`, "button outline")}${button("close-modal", "继续作答", "button primary")}`,
      "sheet-modal",
    ),
  bulk: openBulk,
  "bulk-confirm": () => {
    updateBulk();
    if (!pendingEntries.length || $("#bulk-confirm").disabled) return;
    const count = pendingEntries.length;
    pendingEntries.forEach((q) => {
      selectedDraft().answers[q.question - 1] = q.answer;
    });
    selectedDraft().current = Math.min(
      selectedVersion().questionCount,
      pendingEntries.at(-1).question + 1,
    );
    modal.close();
    updateDraft();
    toast(`已录入 ${count} 题，草稿已保存。`);
  },
  "reset-draft": () =>
    confirm(
      "清空这套卷的草稿？",
      "这次尚未提交的选项与标记将被清除。已提交的成绩和其他套卷保持不变。",
      "confirm-reset",
      "清空草稿",
      "",
      true,
    ),
  "confirm-reset": () => {
    state.drafts[current.id] = newDraft(selectedVersion());
    persist();
    modal.close();
    render();
  },
  "confirm-submit": openSubmit,
  "fill-missing": (b) => {
    modal.close();
    jump(Number(b.dataset.question));
  },
  "submit-attempt": submitAttempt,
  "all-types": () => {
    allTypes = !allTypes;
    render();
  },
  "detail-filter": (b) => {
    detailFilter = b.dataset.value;
    render();
  },
  "export-csv": () => {
    const a = selectedAttempt();
    downloadBlob(
      new Blob([resultCsv(a)], { type: "text/csv;charset=utf-8" }),
      `卷卷小榜-${a.paperTitle}-v${a.versionLabel}.csv`,
    );
    toast("已导出这次练习的全部逐题成绩。");
  },
  "copy-wrong": () => {
    const rows = selectedAttempt().report.rows.filter(
      (q) => q.status === "wrong",
    );
    return copyText(
      rows.map((q) => q.question).join("、") || "本次没有错题",
      `已复制 ${rows.length} 道错题的题号。`,
    );
  },
  poster: openPoster,
  "poster-style": async (b) => {
    posterOptions.style = b.dataset.value;
    document
      .querySelectorAll(".poster-style")
      .forEach((item) => item.classList.toggle("selected", item === b));
    $("#poster-privacy").textContent =
      posterOptions.style === "answers"
        ? "此样式含逐题答案，请仅用于本人复盘存档。"
        : "默认匿名。只展示你确认的字段，不包含私人报告链接。";
    $("#poster-copy-link").disabled = posterOptions.style === "answers";
    await redrawPoster();
  },
  "save-poster": () => {
    const a = selectedAttempt();
    $("#poster-canvas").toBlob((blob) => {
      if (blob) {
        downloadBlob(
          blob,
          `卷卷小榜-${a.paperTitle}-${posterOptions.style}.png`,
        );
        toast("海报已保存为 PNG。");
      } else toast("海报生成失败，请重新打开后重试。");
    }, "image/png");
  },
  "copy-paper-link": () => {
    const a = selectedAttempt();
    const url = new URL(location.href);
    url.hash = `/paper/${encodeURIComponent(a.practiceVersionId ?? a.versionId)}`;
    return copyText(url.href, "已复制同卷详情链接，不包含私人报告。");
  },
  dimension: (b) => {
    dimension = b.dataset.value;
    render();
  },
  "rank-rules": () =>
    openModal(
      "同卷练习榜，怎样计算？",
      `<div class="rule-copy"><p>交卷自动入榜，同卷取最高分。</p><p>全国看全部考生，岗位看同岗考生。</p><p>同分并列，答案更正后自动更新。</p></div>`,
      button("close-modal", "知道了", "button primary"),
    ),
  login,
  settings,
  // 参与状态已由真实榜单服务保存，退出和撤回必须先确认服务端成功，再更新本机显示。
  logout: async () => {
    await api("positions/withdraw", { guestId: state.guestId });
    for (const a of state.attempts) a.participate = false;
    state.profile = null;
    persist();
    modal.close();
    render();
    await Promise.all(features.map((feature) => feature.onRoute?.()));
    toast("已退出体验身份，练习记录仍保存在本机。");
  },
  withdraw: () =>
    confirm(
      "退出全部排行榜？",
      "个人练习记录会保留，服务端已参与的名次会撤回。",
      "confirm-withdraw",
      "退出排行榜",
    ),
  "confirm-withdraw": async () => {
    await api("positions/withdraw", { guestId: state.guestId });
    for (const a of state.attempts) a.participate = false;
    persist();
    modal.close();
    render();
    await Promise.all(features.map((feature) => feature.onRoute?.()));
    toast("已撤回全部排行榜成绩。");
  },
  privacy: () =>
    openModal(
      "你的练习，怎样保存？",
      `<div class="rule-copy"><p>草稿、身份、历史和选岗保存在当前浏览器。清除浏览器数据或切换设备后，不能自动找回；可先备份本机数据。</p><p>本地服务保存套卷、答卷、岗位选择、参与状态、评论及纠错审核记录，用于核分、讨论和订正。它不连接微信，不提供云同步。</p><p>正式交卷后按同卷最高成绩排名。评论及附件会显示给完成该试卷的其他用户。</p><p>公开海报默认匿名；答案对照样式仅供本人导出复盘。复制同卷链接不会公开私人报告。</p></div>`,
      button("close-modal", "知道了", "button primary"),
    ),
  feedback: () => {
    const a = selectedAttempt();
    // 旧入口只导出文本、无法进入审核；统一指向已提交报告中的真实反馈流程。
    if (a && !a.isSample) {
      if (current.page === "report") $('[data-correction-action="feedback"]')?.click();
      else navigate(`report/${encodeURIComponent(a.id)}`);
      return;
    }
    openModal(
      "选择要反馈的练习",
      state.attempts.length
        ? `<p class="dialog-description">打开对应报告，选择「反馈答案」填写题号、建议答案与核对依据。</p><div class="claim-list">${state.attempts.map((attempt) => routeLink(`report/${encodeURIComponent(attempt.id)}`, `${esc(attempt.paperTitle)} · ${date(attempt.createdAt, true)}`, "button outline")).join("")}</div>`
        : '<p class="dialog-description">完成一份正式练习后，可以从成绩报告提交答案反馈。</p>',
      button("close-modal", "关闭", "button outline"),
    );
  },
  "export-data": () => {
    downloadBlob(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
      "卷卷小榜-本机练习备份.json",
    );
    toast("已备份本机草稿、身份和历史。");
  },
  "restore-data": () => {
    pendingRestore = null;
    openModal(
      "从备份恢复本机练习",
      `<p class="dialog-description">恢复会替换当前浏览器的草稿、身份与历史。请先备份当前记录，并确认选择了自己的备份文件。</p><label class="field-label">选择 JSON 备份<input type="file" id="restore-file" accept=".json,application/json"/></label><div id="restore-preview" class="bulk-preview" aria-live="polite">选择文件后会先校验，不会立即覆盖记录。</div>`,
      `${button("close-modal", "取消", "button outline")}${button("confirm-restore", "恢复并替换本机记录", "button primary", 'id="restore-confirm" disabled')}`,
    );
  },
  "confirm-restore": async () => {
    if (!pendingRestore) return;
    state = pendingRestore;
    pendingRestore = null;
    persist();
    modal.close();
    // 恢复和清空会改变本机凭证；关联模块必须重新读取，不能继续展示上一身份的缓存。
    await syncAttempts();
    await Promise.all(features.map((feature) => feature.onRoute?.()));
    render();
    toast("本机练习已从备份恢复。");
  },
  "delete-attempt": (b) =>
    confirm(
      "删除这次练习？",
      "这份成绩将从本机历史和排行榜中移除，操作后不能恢复。",
      "confirm-delete",
      "删除这次练习",
      `data-id="${esc(b.dataset.id)}"`,
      true,
    ),
  "confirm-delete": async (b) => {
    await api("attempts/delete", {
      guestId: state.guestId,
      attemptIds: [b.dataset.id],
    });
    state.attempts = state.attempts.filter((a) => a.id !== b.dataset.id);
    persist();
    modal.close();
    render();
    toast("已删除这次练习。");
  },
  "delete-all": () =>
    confirm(
      "删除本机的全部练习记录？",
      "将删除所有草稿、成绩与体验身份，并撤回排行榜记录。建议先备份需要保留的数据。",
      "confirm-delete-all",
      "删除全部记录",
      "",
      true,
    ),
  "confirm-delete-all": async () => {
    await api("attempts/delete", {
      guestId: state.guestId,
      attemptIds: state.attempts.map((a) => a.id),
    });
    state = initialState();
    persist();
    modal.close();
    await Promise.all(features.map((feature) => feature.onRoute?.()));
    render();
    toast("本机练习记录已删除。");
  },
  "admin-tab": (b) => showAdminTab(b.dataset.value),
  "admin-unlock": () => openAdminUnlockModal(),
  "admin-logout": () => {
    adminToken = "";
    admin = null;
    window.dispatchEvent(new CustomEvent("rr:admin-token-change", { detail: { token: "", source: "app" } }));
    if (current.page === "admin") void loadAdminData();
    toast("已退出维护者凭证。");
  },
  "admin-jump": (b) => {
    const target = b.dataset.target;
    if (["catalog", "import", "audit"].includes(target) && admin) {
      showAdminTab(target);
      $("#admin-section-catalog")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const map = {
      discussions: "#admin-section-discussions",
      corrections: "#admin-section-corrections",
      catalog: "#admin-section-catalog",
      import: "#admin-section-catalog",
      audit: "#admin-section-catalog",
      positions: "#admin-section-positions",
    };
    $(map[target] || "#admin-section-discussions")?.scrollIntoView({ behavior: "smooth", block: "start" });
  },
  "csv-template": () =>
    downloadBlob(
      new Blob(["\uFEFF" + templateCsv], { type: "text/csv;charset=utf-8" }),
      "卷卷小榜-套卷导入模板.csv",
    ),
  "validate-import": validateImport,
  "admin-revise": (b) =>
    showAdminTab(
      "import",
      admin.versions.find((v) => v.id === b.dataset.id),
    ),
  "admin-preview": (b) => {
    // 参考卷的公开题目保留原始权重和折算分值；预览与正式报告使用同一显示分值。
    const v = admin.versions.find((item) => item.id === b.dataset.id);
    const types = unique(v.questions.map((q) => q.typeId));
    openModal(
      "整卷预览与发布核对",
      `<h3>${esc(v.title)} · v${esc(v.versionLabel)}</h3><p class="dialog-description">${esc(v.institution)} · ${esc(v.project)} · ${esc(v.period)}<br/>${v.questionCount} 题，满分 ${score(v.maxCents)} 分。</p><div class="rules-list">${types
        .map((id) => {
          const qs = v.questions.filter((q) => q.typeId === id);
          return `<div><span>${esc(qs[0].type)}</span><span>${qs.length} 题</span><b>${score(qs.reduce((n, q) => n + (q.scoreCents ?? q.cents), 0))} 分</b></div>`;
        })
        .join(
          "",
        )}</div><div class="trial-results"><span>全对预期 <b>${score(v.maxCents)}</b></span><span>全错预期 <b>0</b></span><span>全空预期 <b>0</b></span></div><p class="field-help">发布时服务端将再次校验题号、分值与答案，并执行试算。</p>`,
      button("close-modal", "核对完成", "button primary"),
    );
  },
  "admin-status": (b) =>
    confirm(
      b.dataset.status === "published" ? "发布这份套卷？" : "下线这份套卷？",
      b.dataset.status === "published"
        ? "服务端通过整卷校验和试算后，套卷会出现在本机练习目录。"
        : "下线后停止新提交，已提交的报告及草稿仍保留。",
      "confirm-admin-status",
      b.dataset.status === "published" ? "确认发布" : "确认下线",
      `data-id="${esc(b.dataset.id)}" data-status="${b.dataset.status}"`,
    ),
  "confirm-admin-status": async (b) => {
    b.disabled = true;
    try {
      await api("admin/status", {
        versionId: b.dataset.id,
        status: b.dataset.status,
      });
      await refreshCatalog();
      modal.close();
      render();
      toast(
        b.dataset.status === "published"
          ? "已发布到本机套卷目录。"
          : "套卷已下线。",
      );
    } finally {
      b.disabled = false;
    }
  },
  retry: () => location.reload(),
};

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button[data-action]");
  if (!target || target.disabled) return;
  try {
    await actions[target.dataset.action]?.(target);
  } catch (error) {
    toast(error.message);
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.id === "paper-search") {
    search = target.value;
    render();
  }
  if (["bulk-input", "bulk-start"].includes(target.id)) updateBulk();
});

document.addEventListener("change", async (event) => {
  const target = event.target;
  try {
    if (target.id === "filter-project") changeFilter("project", target.value);
    if (target.id === "filter-period") changeFilter("period", target.value);
    if (target.id === "auto-next") {
      selectedDraft().autoNext = target.checked;
      persist();
    }
    if (target.id === "type-filter") {
      typeFilter = target.value;
      render();
    }
    if (target.id === "rank-paper") {
      dimension = "total";
      navigate(`rank/${encodeURIComponent(target.value)}`);
    }
    if (target.id === "history-paper") {
      historyPaper = target.value;
      render();
    }
    if (["poster-name", "poster-date"].includes(target.id))
      await redrawPoster();
    if (target.id === "restore-file" && target.files[0]) {
      pendingRestore = null;
      $("#restore-confirm").disabled = true;
      const file = target.files[0];
      if (file.size > 5 * 1024 * 1024)
        throw new Error("备份文件不能超过 5 MB。");
      const text = await file.text();
      if (target.files[0] !== file) return;
      const result = loadState(
        { getItem: (key) => (key === STATE_KEY ? text : null) },
        catalog,
      );
      if (result.warning)
        throw new Error(
          "备份包含无效成绩，或缺少对应的套卷配置。请核对文件后重试。",
        );
      pendingRestore = result.state;
      $("#restore-preview").textContent =
        `已校验 ${result.state.attempts.length} 份成绩、${Object.keys(result.state.drafts).length} 份草稿，${result.state.profile ? "包含体验身份" : "游客记录"}。确认后替换当前本机记录。`;
      $("#restore-confirm").disabled = false;
    }
    if (target.id === "import-file" && target.files[0]) {
      if (target.files[0].size > 1024 * 1024)
        throw new Error("CSV 文件不能超过 1 MB。");
      $("#import-csv").value = await target.files[0].text();
      $("#import-preview").innerHTML = "";
    }
  } catch (error) {
    if (target.id === "restore-file" && $("#restore-preview"))
      $("#restore-preview").textContent = error.message;
    toast(error.message);
  }
});

document.addEventListener("submit", async (event) => {
  if (!["jump-form", "login-form", "import-form", "admin-unlock-form"].includes(event.target.id))
    return;
  event.preventDefault();
  try {
    if (event.target.id === "admin-unlock-form") {
      const input = event.target.querySelector("[name=reviewToken]");
      const tokenValue = input?.value ?? "";
      if (!tokenValue) return;
      input.value = "";
      const errNode = $("#admin-unlock-error");
      if (errNode) errNode.textContent = "";
      const prev = adminToken;
      adminToken = tokenValue;
      try {
        admin = await api("admin");
        adminAuthRequired = false;
        modal.close();
        window.dispatchEvent(new CustomEvent("rr:admin-token-change", { detail: { token: tokenValue, source: "app" } }));
        render();
        toast("维护者凭证已验证。");
      } catch (error) {
        adminToken = prev;
        if (errNode) errNode.textContent = error.statusCode === 401 ? "维护者凭证无效，请重新输入。" : error.message;
      }
      return;
    }
    if (event.target.id === "jump-form")
      jump(Number(new FormData(event.target).get("question")));
    if (event.target.id === "login-form") {
      const name = String(new FormData(event.target).get("name")).trim();
      if (!name) {
        toast("请输入匿名昵称。");
        return;
      }
      state.profile = { id: state.guestId, name: name.slice(0, 16) };
      persist();
      modal.close();
      render();
      // 本机身份直接关联既有真实记录，避免自动排名后仍要求再认领一遍。
      for (const attempt of state.attempts) if (!attempt.isSample && !attempt.ownerId) attempt.ownerId = state.guestId;
      persist();
      toast("昵称已保存在本机。");
    }
    if (event.target.id === "import-form") {
      const input = validateImport();
      if (!input) return;
      const save = $("#save-import");
      save.disabled = true;
      try {
        await api("admin/import", input);
        await refreshCatalog();
        render();
        toast("草稿已保存，可在预览核对后发布。");
      } catch (error) {
        save.disabled = false;
        $("#import-preview").innerHTML =
          `<p class="form-error preserve-space">${esc(error.message)}</p>`;
      }
    }
  } catch (error) {
    toast(error.message);
  }
});

window.addEventListener("rr:admin-token-change", (event) => {
  if (event.detail?.source === "app") return;
  const next = typeof event.detail?.token === "string" ? event.detail.token : "";
  if (next === adminToken) return;
  adminToken = next;
  if (current.page === "admin") void loadAdminData();
});

document.addEventListener("keydown", (event) => {
  // 保留原 H5 的连续录入能力，并防止长按、输入法或弹窗误填多道题。
  if (
    current.page !== "practice" ||
    modal.open ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.isComposing ||
    event.target.closest('input,textarea,select,[contenteditable="true"]')
  )
    return;
  const key = event.key.toUpperCase();
  if (CHOICES.includes(key)) {
    event.preventDefault();
    selectAnswer(key);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    actions.prev();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    actions.next();
  } else if (["Backspace", "Delete"].includes(event.key)) {
    event.preventDefault();
    actions["clear-answer"]();
  }
});

modal.addEventListener("cancel", (event) => {
  if (submitting) event.preventDefault();
});
modal.addEventListener("close", () => {
  if (!modalOpener || modalOpener.route !== `${current.page}:${current.id ?? ""}`) return;
  const { target, id, key, value } = modalOpener;
  const restored = (target?.isConnected ? target : id ? document.getElementById(id) :
    key ? $(`#app [${key}="${CSS.escape(value)}"]`) : null
  ) ?? $("#main");
  // 审核完成后原操作可能已从队列移除，此时回到主内容，避免键盘焦点遗失到页面外。
  if (restored?.id === "main") restored.setAttribute("tabindex", "-1");
  restored?.focus({ preventScroll: true });
  modalOpener = null;
});
modal.addEventListener("click", (event) => {
  if (event.target === modal && !submitting) {
    const rect = modal.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      modal.close();
  }
});
window.addEventListener("hashchange", onRoute);

async function boot() {
  try {
    catalog = (await api("catalog")).versions;
    const restored = loadState(storage, catalog);
    state = restored.state;
    saveWarning = restored.warning;
    // 页面模块在状态恢复后初始化，事件监听在整个应用生命周期中只注册一次。
    features = [createPositionsFeature(featureContext), createAnalyticsFeature(featureContext), createDiscussionsFeature(featureContext),
      createDiscussionsAdminFeature(featureContext), createCorrectionsFeature(featureContext)];
    try {
      sample = JSON.parse(
        sessionStorage.getItem("rollierank:sample") ?? "null",
      );
    } catch {
      sample = null;
    }
    await onRoute();
  } catch (error) {
    $("#app").innerHTML =
      `<div class="boot-state"><img src="/ios-v3/assets/brand/rollierank-logo-transparent.png" width="48" height="48" alt=""/><h1>暂时没能打开练习本</h1><p>${esc(error.message)}</p>${button("retry", "重新加载", "button primary")}</div>`;
  }
}
boot();
