import { esc, icon, score, pct, date, empty, routeLink } from "../ui.js";
import { resolveSubjectDimension, subjectDimensions } from "../subjects.js";

const action = (name, label, className = "button outline", attrs = "") =>
  `<button type="button" class="${className}" data-position-action="${name}" ${attrs}>${label}</button>`;
const examName = (exam) => exam === "guokao" ? "国考" : "省考";
const option = (value, label, selected) => `<option value="${esc(value)}" ${String(value) === String(selected) ? "selected" : ""}>${esc(label)}</option>`;
// 官方长标题允许换行，图标留在链接末侧，避免独自落到下一行。
const sourceLink = (source) => source.sourcePage
  ? `<a class="positions-source-link" href="${esc(source.sourcePage)}" target="_blank" rel="noopener noreferrer"><span class="positions-source-name">${esc(source.label)}</span>${icon("right")}</a>`
  : esc(source.label);
const selectedLabel = (p) => p ? `${p.year} ${examName(p.exam)} · ${p.department} · ${p.title}` : "尚未选岗";
const localDate = () => new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function createPositionsFeature(ctx) {
  const document = globalThis.document;
  let profile = null, profileLoaded = false, profileError = "", profilePromise;
  let catalog = null, catalogError = "", catalogPromise;
  // 未选岗时实际读全国榜；显式比较范围须与自动选岗默认值区分，避免导航时被重置。
  let scope = "nationwide", explicitScope = false, browsingPosition = null, page = 1;
  let lastPage = null;
  let board = { key: null, data: null, error: "", loading: false };
  let picker = null, pickerSequence = 0, savingSelection = false;
  let bypassSubmissionFor = null, resumeSubmission = false;
  let importFile = null, importing = false, importMessage = "", importFailed = false;
  const importFields = { exam: "guokao", year: "2027", region: "全国", label: "", publisher: "用户提供文件",
    sourcePage: "", downloadUrl: "", retrievedAt: localDate() };
  const state = () => ctx.state();
  const submissionKey = () => state().drafts?.[ctx.route()?.id]?.id || ctx.route()?.id;
  const route = () => ctx.route()?.page;
  const findMount = (name) => document?.querySelector(`[data-feature="${name}"]`);
  const remember = (value) => {
    profile = value;
    profileLoaded = true;
    profileError = "";
    // 只有真实岗位才能成为默认范围；保留用户已主动选择的全国或其他岗位比较。
    if (!explicitScope || scope === "selected" && !value.position) scope = value.position ? "selected" : "nationwide";
    state().positions = { positionId: value.positionId, position: value.position };
    const ids = new Set(value.participation.attemptIds);
    for (const attempt of state().attempts ?? []) {
      attempt.participate = ids.has(attempt.id);
      if (attempt.participate) attempt.ownerId = state().guestId;
    }
    ctx.persist();
    return value;
  };
  async function loadProfile(force = false) {
    if (profilePromise) return profilePromise;
    if (profileLoaded && !force) return profile;
    profilePromise = ctx.api(`positions/profile?${new URLSearchParams({ guestId: state().guestId })}`)
      .then(remember).catch((error) => { profileError = error.message; throw error; })
      .finally(() => { profilePromise = null; });
    return profilePromise;
  }
  async function loadCatalog(force = false) {
    if (catalogPromise) return catalogPromise;
    if (catalog && !force) return catalog;
    catalogPromise = ctx.api("positions/catalog?pageSize=1").then((result) => {
      catalog = result;
      catalogError = "";
      return result;
    }).catch((error) => { catalogError = error.message; throw error; }).finally(() => { catalogPromise = null; });
    return catalogPromise;
  }
  const boardKey = (version, dimension) => [version?.id, dimension, scope, browsingPosition?.id, page].join("|");
  const invalidateBoard = () => { board = { key: null, data: null, error: "", loading: false }; };
  async function loadBoard(force = false) {
    const version = ctx.version();
    if (!version || route() !== "rank") return;
    // 四个判断子型共用一个排名维度，旧页面状态也归一后再查询。
    const dimension = resolveSubjectDimension(version.questions, ctx.dimension() || "total");
    const key = boardKey(version, dimension);
    if (!force && board.key === key) return;
    board = { key, data: null, error: "", loading: true };
    const query = new URLSearchParams({ guestId: state().guestId, versionId: version.id, dimension, scope, page: String(page) });
    if (scope === "position" && browsingPosition) query.set("positionId", browsingPosition.id);
    try {
      const result = await ctx.api(`positions/leaderboard?${query}`);
      if (board.key !== key) return;
      board = { key, data: result, error: "", loading: false };
    } catch (error) {
      if (board.key !== key) return;
      board = { key, data: null, error: error.message, loading: false };
    }
    if (route() === "rank") ctx.render();
  }

  function profileView() {
    const job = profile?.position;
    if (profileError) return `<section class="card positions-profile"><p class="positions-error" role="alert">${esc(profileError)}</p>${action("retry-profile", "重新读取岗位")}</section>`;
    if (!profileLoaded) return `<section class="card positions-profile"><p role="status">正在读取选岗信息…</p></section>`;
    return `<section class="card positions-profile"><div><h2>我的岗位</h2>${job
      ? `<p class="positions-job-title">${esc(job.title)}</p><p>${esc(job.year)} ${examName(job.exam)} · ${esc(job.department)}${job.unit ? ` · ${esc(job.unit)}` : ""}</p><p class="positions-caption">岗位编码 ${esc(job.code)}${job.location ? ` · ${esc(job.location)}` : ""}</p>`
      : '<p>尚未选岗。选岗后，练习榜会默认展示你的岗位。</p>'}</div><div class="positions-actions">${action("choose", job ? "更换岗位" : "选择岗位", "button primary")}${job ? action("clear-selection", "清除选岗", "text-button") : ""}</div></section>`;
  }

  function pickerView(current) {
    const data = current.data;
    const facets = data?.facets || catalog?.facets || { years: [], exams: [], regions: [] };
    return `<form data-position-form="search" class="positions-search-form"><div class="positions-filter-grid"><label>招考年度<select name="year">${option("", "全部年度", current.year)}${facets.years.map((y) => option(y, y, current.year)).join("")}</select></label><label>考试<select name="exam">${option("", "全部考试", current.exam)}${facets.exams.map((e) => option(e, examName(e), current.exam)).join("")}</select></label><label>目录地区<select name="region">${option("", "全部地区", current.region)}${facets.regions.map((r) => option(r, r, current.region)).join("")}</select></label></div><div class="positions-search-row"><label for="positions-search" class="positions-sr-only">搜索部门、岗位、地点或编码</label><input id="positions-search" name="q" type="search" maxlength="120" value="${esc(current.q)}" placeholder="搜索部门、岗位、地点或编码"/><button type="submit" class="button primary">${icon("search")}搜索</button></div></form><div class="positions-picker-meta" role="status">${current.loading ? "正在查询岗位…" : data ? `${data.total.toLocaleString("zh-CN")} 个岗位` : ""}${current.mode === "browse" ? '<span>仅切换榜单范围</span>' : ""}</div><p data-position-picker-error class="positions-error" role="alert">${esc(current.error)}</p><div class="positions-picker-list">${data && !current.loading ? data.items.length
      ? data.items.map((p) => `<article class="positions-picker-row"><div><span class="positions-caption">${p.year} ${examName(p.exam)} · ${esc(p.department)}</span><h3>${esc(p.title)}</h3>${p.unit ? `<p>${esc(p.unit)}</p>` : ""}<p class="positions-caption">${esc(p.location || p.region)} · 编码 ${esc(p.code)}${p.recruits === null ? "" : ` · 招 ${p.recruits} 人`}</p><details><summary>报考条件与来源</summary><p>${esc(p.education || "学历见原表")} · ${esc(p.major || "专业见原表")}</p><p>${sourceLink(data.sources.find((s) => s.id === p.sourceId) || { label: "来源见目录" })} · ${esc(p.sourceSheet)} 第 ${p.sourceRow} 行</p></details></div>${action("pick-position", current.mode === "browse" ? "查看榜单" : profile?.positionId === p.id ? "已选择" : "选择", "button soft", `data-position-id="${esc(p.id)}" ${savingSelection ? "disabled" : ""}`)}</article>`).join("")
      : `<div class="positions-empty">${data.sources.length ? "没有匹配的岗位，请调整搜索条件。" : "岗位目录为空，请先在管理页导入岗位表。"}</div>` : current.loading ? '<div class="positions-empty" aria-busy="true">正在加载岗位…</div>' : ""}</div>${data ? `<div class="positions-pagination">${action("picker-prev", "上一页", "button outline", `data-page="${data.page - 1}" ${data.page <= 1 || current.loading ? "disabled" : ""}`)}<span>第 ${data.page} / ${data.pages} 页</span>${action("picker-next", "下一页", "button outline", `data-page="${data.page + 1}" ${data.page >= data.pages || current.loading ? "disabled" : ""}`)}</div>` : ""}${current.error ? action("picker-retry", "重新查询") : ""}`;
  }
  function paintPicker() {
    const root = document?.querySelector(`[data-positions-picker="${picker?.sequence}"]`);
    if (!root || !picker) return;
    const focused = document.activeElement;
    const field = focused?.name;
    const selection = focused?.tagName === "INPUT" ? focused.selectionStart : null;
    root.innerHTML = pickerView(picker);
    if (field) {
      const restored = root.querySelector(`[name="${field}"]`);
      restored?.focus();
      if (selection !== null && restored?.type === "search") restored.setSelectionRange(selection, selection);
    }
  }
  async function queryPicker() {
    if (!picker) return;
    const current = picker;
    const requestId = (current.requestId || 0) + 1;
    current.requestId = requestId;
    current.loading = true;
    current.error = "";
    paintPicker();
    try {
      const { q, year, exam, region, page } = current;
      const result = await ctx.api(`positions/catalog?${new URLSearchParams({ q, year, exam, region, page: String(page), pageSize: "20" })}`);
      if (picker !== current || current.requestId !== requestId) return;
      current.data = result;
      current.page = result.page;
      catalog = { ...result, items: [] };
      catalogError = "";
    } catch (error) {
      if (picker !== current || current.requestId !== requestId) return;
      current.error = error.message;
    }
    current.loading = false;
    paintPicker();
  }
  async function openPicker(mode = "select") {
    // 原生手机选择器可按真实组织层级呈现；数据保存与继续提交仍由同一个状态机负责。
    if (ctx.openPositionPicker) return ctx.openPositionPicker(mode);
    picker = { sequence: ++pickerSequence, mode, q: "", year: "", exam: "", region: "", page: 1, data: null, loading: false, error: "" };
    // The native dialog already provides close/Escape; a second footer pushed pagination below short viewports.
    ctx.openModal(mode === "browse" ? "查看其他岗位榜" : "选择我的岗位", `<div data-positions-picker="${picker.sequence}">${pickerView(picker)}</div>`,
      "", "positions-modal");
    document?.querySelector("#positions-search")?.focus();
    await queryPicker();
  }
  async function setSelection(positionId) {
    if (savingSelection) return;
    savingSelection = true;
    paintPicker();
    try {
      const result = await ctx.api("positions/selection", { guestId: state().guestId, positionId });
      remember(result);
      // 清岗后的榜单属于全国，不能继续把岗位按钮标成当前范围。
      scope = result.position ? "selected" : "nationwide";
      explicitScope = true;
      browsingPosition = null;
      page = 1;
      invalidateBoard();
      picker = null;
      ctx.closeModal();
      ctx.render();
      ctx.toast(positionId ? "岗位已保存。" : "已清除选岗。");
      if (resumeSubmission) { resumeSubmission = false; await ctx.submitAttempt(); }
      return true;
    } catch (error) {
      if (picker) { picker.error = error.message; paintPicker(); }
      else ctx.toast(error.message);
      return false;
    } finally { savingSelection = false; paintPicker(); }
  }
  async function pickPosition(id) {
    const position = picker?.data?.items.find((p) => p.id === id);
    if (!position) return;
    if (picker.mode === "browse") {
      scope = "position";
      explicitScope = true;
      browsingPosition = position;
      page = 1;
      invalidateBoard();
      picker = null;
      ctx.closeModal();
      ctx.render();
    } else await setSelection(id);
  }

  // 正式交卷已原子入榜；候选界面不再提供第二套公开答卷选择表单。
  async function withdraw() {
    remember(await ctx.api("positions/withdraw", { guestId: state().guestId }));
    invalidateBoard();
    ctx.closeModal();
    ctx.render();
    ctx.toast("已撤回全部榜单成绩，练习记录仍保留。");
  }

  function rankView({ catalog: versions, version, dimension = "total" }) {
    if (!version) return empty("还没有可用套卷", "请先导入并发布一套卷。");
    dimension = resolveSubjectDimension(version.questions, dimension);
    const data = board.key === boardKey(version, dimension) ? board.data : null;
    const error = board.key === boardKey(version, dimension) ? board.error : "";
    const dimensions = subjectDimensions(version.questions).map(type => [type.id, type.name]);
    const label = scope === "nationwide" ? "全国" : scope === "position" ? selectedLabel(browsingPosition) : selectedLabel(profile?.position);
    const value = (row) => dimension === "total" ? `${score(row.value)}<small> 分</small>` : `${pct(row.rate)}<small>${score(row.value)} / ${score(row.maxCents)} 分</small>`;
    return `<div class="page-title"><div><h1>同卷练习榜</h1><p>交卷自动入榜，同卷取最高分。</p></div>${action("rules", `${icon("info")}榜单规则`)}</div><div class="positions-rank-layout"><section class="card positions-board"><div class="positions-paper"><label for="rank-paper">套卷<select id="rank-paper">${versions.map((v) => option(v.id, `${v.title} · ${v.period}${v.status === "offline" ? "（已下线）" : ""}`, version.id)).join("")}</select></label><span class="tag">${version.questionCount} 题 · ${score(version.maxCents)} 分</span></div><div class="positions-dimensions" role="group" aria-label="排行榜维度">${[["total", "总分榜"], ...dimensions].map(([id, name]) => `<button type="button" class="chip ${dimension === id ? "selected" : ""}" data-action="dimension" data-value="${esc(id)}" aria-pressed="${dimension === id}">${esc(name)}</button>`).join("")}</div><div class="positions-scope" role="group" aria-label="榜单范围">${action("scope-selected", "我的岗位", `chip ${scope === "selected" ? "selected" : ""}`, `aria-pressed="${scope === "selected"}"`)}${action("scope-nationwide", "全国", `chip ${scope === "nationwide" ? "selected" : ""}`, `aria-pressed="${scope === "nationwide"}"`)}${action("browse", "查看其他岗位", `chip ${scope === "position" ? "selected" : ""}`, `aria-pressed="${scope === "position"}"`)}</div><div class="positions-board-meta"><span>${esc(label)}</span><span>${data ? `${data.count} 位参与者` : ""}</span></div>${data?.selectionMissing ? `<div class="positions-reminder">尚未选岗，当前展示全国榜。${action("choose", "选择岗位", "text-button")}</div>` : ""}${error ? `<div class="positions-empty"><p class="positions-error" role="alert">${esc(error)}</p>${action("retry-board", "重新读取榜单")}</div>` : !data ? '<div class="positions-empty" role="status">正在读取成绩…</div>' : !data.rows.length ? `<div class="positions-empty"><span class="positions-empty-icon">${icon("trophy")}</span><h3>暂无真实成绩</h3></div>` : `<div class="positions-board-head"><span>名次</span><span>练习者</span><span>最佳${dimension === "total" ? "得分" : "得分率"}</span></div><ol class="positions-board-list">${data.rows.map((row) => `<li class="positions-board-row ${row.isMe ? "positions-is-me" : ""}"><span class="positions-rank-number">${row.rank}</span><div class="positions-person"><span class="avatar small">${esc(row.name[0])}</span><span><b>${esc(row.name)}${row.isMe ? '<span class="me-badge">我</span>' : ""}</b><small>${date(row.createdAt)}</small></span></div><strong>${value(row)}</strong></li>`).join("")}</ol><div class="positions-pagination">${action("board-prev", "上一页", "button outline", `${data.page <= 1 ? "disabled" : ""}`)}<span>第 ${data.page} / ${data.pages} 页</span>${action("board-next", "下一页", "button outline", `${data.page >= data.pages ? "disabled" : ""}`)}</div>`}<p class="positions-board-note">同分并列；总分和题型的个人最佳可能来自不同答卷。</p></section><aside class="positions-aside"><section class="card positions-self"><h2>我的同卷最佳</h2>${data?.self ? `<strong class="positions-self-rank">${data.self.rank}<small> / ${data.count} 名</small></strong><b class="positions-self-value">${value(data.self)}</b>` : '<p>暂无真实成绩</p>'}</section><section class="card positions-self"><h2>我的岗位</h2><p>${esc(selectedLabel(profile?.position))}</p>${action("choose", profile?.position ? "更换岗位" : "选择岗位", "button soft")}${routeLink("me", "我的练习记录", "text-button")}</section></aside></div>`;
  }

  function adminView() {
    const field = (name, label, type = "text", required = false, extra = "") => `<label>${label}<input type="${type}" name="${name}" data-position-field="${name}" value="${esc(importFields[name])}" ${required ? "required" : ""} ${extra}/></label>`;
    return `<section class="card positions-admin" data-positions-admin-body><div class="positions-admin-heading"><h2>岗位目录</h2>${action("refresh-catalog", "刷新目录", "text-button")}</div>${catalogError ? `<p class="positions-error" role="alert">${esc(catalogError)}</p>` : !catalog ? '<p role="status">正在读取目录…</p>' : catalog.sources.length ? `<ul class="positions-source-list">${catalog.sources.map((source) => `<li><b>${sourceLink(source)}</b><span>${source.count.toLocaleString("zh-CN")} 个岗位 · ${source.year} 年 · ${esc(source.region)}</span><small>${source.origin === "bundled-official" ? "官方发布文件" : "用户导入文件"} · 获取于 ${esc(source.retrievedAt)}</small></li>`).join("")}</ul>` : '<p>目录为空，请导入岗位表。</p>'}<details class="positions-import-details"><summary>导入 Excel 或岗位目录</summary><form data-position-form="import" class="positions-import-form"><label>岗位文件<input type="file" name="file" data-position-file accept=".xls,.xlsx,.json" ${importing ? "disabled" : ""}/></label><p class="positions-caption" data-position-file-name>${esc(importFile?.name || "支持 .xls、.xlsx 和已转换的 .json，最大 20 MB。")}</p><div class="positions-filter-grid"><label>考试<select name="exam" data-position-field="exam">${option("guokao", "国考", importFields.exam)}${option("shengkao", "省考", importFields.exam)}</select></label>${field("year", "招考年度", "number", true, 'min="2000" max="2100"')}${field("region", "地区", "text", true, 'maxlength="80"')}</div><div class="positions-import-fields">${field("label", "目录名称", "text", true, 'maxlength="300"')}${field("publisher", "来源机构", "text", true, 'maxlength="200"')}${field("sourcePage", "来源页面（可选）", "url")}${field("downloadUrl", "原文件下载地址（可选）", "url")}${field("retrievedAt", "文件获取日期", "date", true)}</div><p class="positions-caption">JSON 文件使用自带的来源信息。Excel 使用以上信息，未提供链接时标记为用户提供文件。</p><p class="positions-import-status ${importFailed ? "positions-error" : ""}" data-position-import-status role="status">${esc(importMessage)}</p><button type="submit" class="button primary" data-position-import-submit ${importing ? "disabled" : ""}>${importing ? "正在导入…" : "校验并导入"}</button></form></details></section>`;
  }
  function paintImportStatus(message, failed = false) {
    importMessage = message;
    importFailed = failed;
    const status = document?.querySelector("[data-position-import-status]");
    if (status) { status.textContent = message; status.classList.toggle("positions-error", failed); }
    const button = document?.querySelector("[data-position-import-submit]");
    if (button) { button.disabled = importing; button.textContent = importing ? "正在导入…" : "校验并导入"; }
    const file = document?.querySelector("[data-position-file]");
    if (file) file.disabled = importing;
  }
  async function importPositions(form) {
    if (importing) return;
    if (!importFile) { paintImportStatus("请选择岗位文件。", true); return; }
    if (importFile.size > 20 * 1024 * 1024 || !/\.(xls|xlsx|json)$/i.test(importFile.name)) {
      paintImportStatus("请选择不超过 20 MB 的 Excel 或岗位目录 JSON。", true); return;
    }
    const isJson = /\.json$/i.test(importFile.name);
    if (!isJson && !form.reportValidity()) return;
    for (const element of form.querySelectorAll("[data-position-field]")) importFields[element.name] = element.value;
    importing = true;
    paintImportStatus("正在上传文件…");
    let uploadId;
    try {
      const metadata = { ...importFields, year: Number(importFields.year), id: `user-${importFields.year}-${globalThis.crypto.randomUUID()}`,
        sourceType: importFields.sourcePage && importFields.downloadUrl ? "published" : "user-file" };
      const started = await ctx.api("positions/import/start", { guestId: state().guestId, fileName: importFile.name, size: importFile.size, metadata });
      uploadId = started.uploadId;
      for (let offset = 0, index = 0; offset < importFile.size; offset += started.chunkSize, index++) {
        const bytes = new Uint8Array(await importFile.slice(offset, offset + started.chunkSize).arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        await ctx.api("positions/import/chunk", { guestId: state().guestId, uploadId, index, chunk: globalThis.btoa(binary) });
        paintImportStatus(`已上传 ${Math.round(Math.min(importFile.size, offset + started.chunkSize) / importFile.size * 100)}%，正在校验…`);
      }
      const result = await ctx.api("positions/import/finish", { guestId: state().guestId, uploadId });
      uploadId = null;
      await loadCatalog(true);
      importing = false;
      importFile = null;
      paintImportStatus(`已导入 ${result.imported.toLocaleString("zh-CN")} 个岗位。`);
      ctx.render();
      ctx.toast("岗位目录已更新。");
    } catch (error) {
      if (uploadId) { try { await ctx.api("positions/import/cancel", { guestId: state().guestId, uploadId }); } catch { /* Failed/expired imports have already discarded their session. */ } }
      importing = false;
      paintImportStatus(error.message, true);
    }
  }

  async function beforeSubmit() {
    if (bypassSubmissionFor && bypassSubmissionFor === submissionKey()) return true;
    try { await loadProfile(); } catch { /* 读取岗位失败时仍可明确跳过提醒，交卷与自动计分继续。 */ }
    if (profile?.position) return true;
    resumeSubmission = true;
    if (ctx.openPositionSubmitPrompt) {
      ctx.openPositionSubmitPrompt({ failed: Boolean(profileError) });
      return false;
    }
    // 选岗用途直接放进短标题，避免标题、解释与返回动作重复占位。
    ctx.openModal(profileError ? "岗位暂不可用" : "选岗查看同岗排名", "",
      action("choose", "去选岗", "button primary") + action("skip-submit", "先提交", "button outline"), "positions-submit-modal");
    return false;
  }
  async function afterSubmit(attempt) {
    bypassSubmissionFor = null;
    resumeSubmission = false;
    // 服务端提交事务已纳入榜单；这里只读取回执状态，不再另发公开成绩请求。
    if (!attempt.isSample) {
      try { await loadProfile(true); }
      catch (error) { ctx.toast("成绩已保存，排名暂未刷新。"); throw error; }
    }
    invalidateBoard();
  }
  async function onRoute() {
    const previousPage = lastPage;
    lastPage = route();
    if (!["me", "rank", "admin", "practice"].includes(route())) return;
    if (route() === "rank" && previousPage !== "rank") {
      // 返回榜单只重置翻页，保留用户选择的比较范围及其浏览岗位。
      page = 1; invalidateBoard();
    }
    if (route() !== "practice") { bypassSubmissionFor = null; resumeSubmission = false; }
    await Promise.allSettled([loadProfile(true), loadCatalog()]);
    if (route() === "rank") { invalidateBoard(); await loadBoard(); }
    ctx.render();
  }
  function afterRender() {
    const personal = findMount("positions-profile");
    if (personal) personal.innerHTML = profileView();
    const admin = findMount("positions-admin");
    if (admin && !admin.querySelector("[data-positions-admin-body]")) admin.innerHTML = adminView();
    if (route() === "rank") void loadBoard();
  }

  const actions = {
    choose: () => openPicker(), browse: () => openPicker("browse"),
    close: () => { picker = null; resumeSubmission = false; ctx.closeModal(); },
    "pick-position": (button) => pickPosition(button.dataset.positionId),
    "picker-prev": (button) => { picker.page = Number(button.dataset.page); return queryPicker(); },
    "picker-next": (button) => { picker.page = Number(button.dataset.page); return queryPicker(); },
    "picker-retry": queryPicker,
    "clear-selection": () => ctx.openModal("清除当前岗位？", "<p>已参与的成绩仍保留在全国榜，你可以随时重新选岗。</p>", action("close", "取消") + action("confirm-clear", "清除选岗", "button primary")),
    "confirm-clear": () => setSelection(null),
    // 没有岗位时点击岗位入口先完成选岗，不产生一个实际仍为全国的假岗位范围。
    "scope-selected": () => { if (!profile?.position) return openPicker(); scope = "selected"; explicitScope = true; page = 1; invalidateBoard(); ctx.render(); },
    "scope-nationwide": () => { scope = "nationwide"; explicitScope = true; page = 1; invalidateBoard(); ctx.render(); },
    "board-prev": () => { page = Math.max(1, page - 1); invalidateBoard(); ctx.render(); },
    "board-next": () => { page++; invalidateBoard(); ctx.render(); },
    "retry-board": () => { invalidateBoard(); ctx.render(); },
    "retry-profile": async () => { await loadProfile(true); ctx.render(); },
    "refresh-catalog": async () => { await loadCatalog(true); const mount = findMount("positions-admin"); if (mount) mount.innerHTML = adminView(); },
    "skip-submit": async () => { bypassSubmissionFor = submissionKey(); resumeSubmission = false; ctx.closeModal(); await ctx.submitAttempt(); },
    "cancel-submit": () => { resumeSubmission = false; ctx.closeModal(); },
    rules: () => ctx.openModal("榜单规则", '<div class="positions-rules"><p>交卷自动入榜，同卷取最高分。</p><p>全国看全部考生，岗位看同岗考生。</p><p>同分并列，答案更正后自动更新。</p></div>', action("close", "知道了", "button primary")),
  };
  const clickListener = (event) => {
    const button = event.target?.closest?.("[data-position-action]");
    if (!button || button.disabled) return;
    const handler = actions[button.dataset.positionAction];
    if (!handler) return;
    event.preventDefault();
    Promise.resolve().then(() => handler(button)).catch((error) => ctx.toast(error.message));
  };
  const submitListener = (event) => {
    const form = event.target?.closest?.("[data-position-form]");
    if (!form) return;
    event.preventDefault();
    if (form.dataset.positionForm === "search" && picker) {
      for (const name of ["q", "year", "exam", "region"]) picker[name] = form.elements[name].value;
      picker.page = 1;
      void queryPicker();
    } else if (form.dataset.positionForm === "import") void importPositions(form);
  };
  const changeListener = (event) => {
    const input = event.target;
    if (input?.matches?.("[data-position-file]")) {
      importFile = input.files?.[0] || null;
      if (importFile && !importFields.label) importFields.label = importFile.name.replace(/\.[^.]+$/, "");
      const label = document.querySelector('[data-position-field="label"]');
      if (label) label.value = importFields.label;
      const hint = document.querySelector("[data-position-file-name]");
      if (hint) hint.textContent = importFile?.name || "尚未选择文件";
      // JSON already carries its source metadata, so unrelated Excel inputs must not block its form submission.
      const form = input.closest("form");
      for (const field of form.querySelectorAll("[data-position-field]")) field.disabled = /\.json$/i.test(importFile?.name || "");
    } else if (input?.matches?.("[data-position-field]")) importFields[input.name] = input.value;
  };
  document?.addEventListener("click", clickListener);
  document?.addEventListener("submit", submitListener);
  document?.addEventListener("change", changeListener);
  // The iOS island renders these same server results in its existing beUI cards; a copy keeps view adapters from mutating shared selection state.
  const snapshot = () => structuredClone({ profile, profileLoaded, profileError, catalog, catalogError, scope, browsingPosition, page, board });
  const browsePosition = (position) => {
    // 浏览其他岗位只改变比较对象，往返报告后仍保留，不覆盖报考岗位。
    scope = "position"; explicitScope = true; browsingPosition = structuredClone(position); page = 1; invalidateBoard();
    ctx.closeModal(); ctx.render();
  };
  const cancelSubmissionPrompt = () => { resumeSubmission = false; bypassSubmissionFor = null; };
  return { afterRender, onRoute, beforeSubmit, afterSubmit, rankView, openPicker, withdraw, snapshot,
    selectPosition: setSelection, browsePosition, cancelSubmissionPrompt,
    destroy() {
      document?.removeEventListener("click", clickListener);
      document?.removeEventListener("submit", submitListener);
      document?.removeEventListener("change", changeListener);
    },
  };
}
