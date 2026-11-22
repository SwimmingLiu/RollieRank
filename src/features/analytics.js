import {
  analyzeAttempt,
  buildAnalytics,
  buildTrendGeometry,
  classifyExamCategory,
  compareAttempts,
  describeScoringRule,
  paginateTrend,
  selectPreviousAttempt,
} from "../analytics.js";
import { date, esc, icon, pad, pct, routeLink, score } from "../ui.js";

const PAGE_SIZE = 24;
const LABELS = { totalCents: "得分", rate: "得分率", accuracy: "正确率" };
const directionLabel = { up: "进步", down: "退步", same: "持平", unavailable: "未记录" };
const defaults = () => ({ examCategory: null, dimension: "total", metric: "rate", sourceId: "all", from: "", to: "", page: "latest", selectedAttemptId: null });
const idFor = (scope, name) => `analytics-${encodeURIComponent(scope)}-${name}`;
const hasValue = (value) => typeof value === "number" && Number.isFinite(value);
const valueText = (value, metric) => !hasValue(value) ? "—" : metric === "totalCents" ? `${score(value)} 分` : pct(value);
const timestampText = (value) => {
  const time = new Date(value);
  return `${date(value, true)}:${pad(time.getSeconds())}${time.getMilliseconds() ? "." + String(time.getMilliseconds()).padStart(3, "0") : ""}`;
};
const actionButton = (action, label, attrs = "", classes = "button outline") => `<button type="button" class="analytics-button ${classes}" data-analytics-action="${action}" ${attrs}>${label}</button>`;
const reportLink = (attempt, text = "查看报告") => routeLink(`report/${encodeURIComponent(attempt.id)}`, text, "analytics-report-link");

function deltaText(delta, metric) {
  if (!hasValue(delta)) return "未记录";
  if (delta === 0) return "持平";
  const amount = metric === "totalCents" ? `${Math.abs(delta) < 1 ? "不足 0.01" : score(Math.abs(delta))} 分` : `${Math.abs(delta) < 0.001 ? "不足 0.1" : (Math.abs(delta) * 100).toFixed(1).replace(/\.0$/, "")} 个百分点`;
  return `${delta > 0 ? "进步" : "退步"} ${amount}`;
}

function selector(scope, field, label, options, value) {
  const id = idFor(scope, field);
  return `<label class="analytics-field" for="${esc(id)}"><span>${label}</span><select id="${esc(id)}" data-analytics-control="${field}">${options.map((option) => `<option value="${esc(option.value)}" ${option.value === value ? "selected" : ""}>${esc(option.label)}</option>`).join("")}</select></label>`;
}

function excludedRecords(model) {
  if (!model.rejected.length) return "";
  return `<details class="analytics-excluded"><summary>${model.rejected.length} 份记录缺少完整评分依据</summary><ul>${model.rejected.map(({ attempt, reason }) => `<li>${esc(attempt.paperTitle || "练习记录")}：${esc(reason)}</li>`).join("")}</ul></details>`;
}

function metricOptions() {
  return Object.entries(LABELS).map(([value, label]) => ({ value, label }));
}

function dimensionOptions(model) {
  return [{ value: "total", label: "行测整体" }, ...model.types.map((type) => ({ value: type.key, label: type.name }))];
}

function trendControls(scope, filters, model, compact) {
  // 基础页面与移动端一致：只按卷型归组，完整来源分值仍保留在每份报告中。
  return `<div class="analytics-filters ${compact ? "analytics-filters-compact" : ""}">${compact ? "" : selector(scope, "examCategory", "考试类别", model.categories.map(category => ({ value: category.id, label: `${category.label} · ${category.count} 次` })), model.category?.id)}${selector(scope, "dimension", "统计范围", dimensionOptions(model), filters.dimension)}${selector(scope, "metric", "指标", metricOptions(), filters.metric)}${compact ? "" : selector(scope, "sourceId", "来源套卷", [{ value: "all", label: "全部套卷" }, ...model.sources.map((source) => ({ value: source.id, label: `${source.institution || "未标机构"} · ${source.title || source.id}` }))], filters.sourceId)}${compact ? "" : ["from", "to"].map((field) => `<label class="analytics-field" for="${esc(idFor(scope, field))}"><span>${field === "from" ? "开始日期" : "结束日期"}</span><input type="date" id="${esc(idFor(scope, field))}" data-analytics-control="${field}" value="${esc(filters[field])}" ${model.bounds.valid ? "" : 'aria-invalid="true"'}/></label>`).join("")}</div>`;
}

function trendChart(scope, page, filters) {
  const geometry = buildTrendGeometry(page.points, { metric: filters.metric });
  const selected = page.points.find((point) => point.attempt.id === filters.selectedAttemptId) ?? page.points.at(-1);
  const chartId = idFor(scope, "chart");
  const label = LABELS[filters.metric];
  const timeLabels = page.points.length ? [...new Map([...new Set([0, Math.floor((page.points.length - 1) / 2), page.points.length - 1])].map((index) => [geometry.coordinates[index].x, index])).values()].map((index) => {
    const point = geometry.coordinates[index];
    return `<text x="${point.x}" y="${geometry.height - 13}" text-anchor="${index === 0 ? "start" : index === page.points.length - 1 ? "end" : "middle"}">${esc(date(point.attempt.createdAt))}</text>`;
  }).join("") : "";
  return `<div class="analytics-chart" id="${esc(chartId)}" tabindex="0" role="group" aria-label="${label}趋势，使用左右方向键选择记录，Home 和 End 选择首末记录" aria-describedby="${esc(idFor(scope, "chart-help"))}" data-analytics-chart data-analytics-ids="${esc(JSON.stringify(page.points.map((point) => point.attempt.id)))}" data-analytics-selected="${esc(selected?.attempt.id)}"><svg viewBox="0 0 ${geometry.width} ${geometry.height}" role="img" aria-labelledby="${esc(idFor(scope, "chart-title"))}"><title id="${esc(idFor(scope, "chart-title"))}">按提交时间排列的${label}，第 ${page.start + 1} 至 ${page.end} 次练习；详细数据见下表</title>${geometry.ticks.map((tick) => `<path class="analytics-grid-line" d="M${geometry.left} ${tick.y}H${geometry.width - geometry.right}"/><text class="analytics-axis-label" x="${geometry.left - 8}" y="${tick.y + 4}" text-anchor="end">${filters.metric === "totalCents" ? score(tick.value) : pct(tick.value)}</text>`).join("")}${geometry.segments.filter((segment) => segment.length > 1).map((segment) => `<polyline class="analytics-trend-line" points="${segment.map((point) => `${point.x},${point.y}`).join(" ")}"/>`).join("")}${geometry.coordinates.filter((point) => point.y !== null).map((point) => `<circle class="analytics-point ${point.attempt.id === selected?.attempt.id ? "analytics-point-selected" : ""}" cx="${point.x}" cy="${point.y}" r="${point.attempt.id === selected?.attempt.id ? 6 : 4}" data-analytics-action="select" data-attempt-id="${esc(point.attempt.id)}"><title>第 ${point.ordinal} 次，${esc(timestampText(point.attempt.createdAt))}，${esc(point.attempt.paperTitle)}，${valueText(point.value, filters.metric)}</title></circle>`).join("")}${timeLabels}</svg></div><p class="analytics-chart-help" id="${esc(idFor(scope, "chart-help"))}">横轴为提交时间。同一时间的记录全部保留，可通过方向键或下表逐次选择。</p>${selected ? `<output class="analytics-selected-record" aria-live="polite" aria-atomic="true"><span>第 ${selected.ordinal} 次 · ${esc(timestampText(selected.attempt.createdAt))}</span><strong>${valueText(selected.value, filters.metric)}</strong><span>${esc(selected.attempt.institution)} · ${esc(selected.attempt.paperTitle)}</span>${selected.missingReason ? `<span>${esc(selected.missingReason)}</span>` : ""}</output>` : ""}`;
}

function trendTable(page, filters) {
  const selected = page.points.find((point) => point.attempt.id === filters.selectedAttemptId) ?? page.points.at(-1);
  return `<div class="analytics-table-scroll" tabindex="0" role="region" aria-label="每次练习数据，可横向滚动"><table class="analytics-table analytics-attempts"><caption>每次练习数据</caption><thead><tr><th scope="col">记录</th><th scope="col">提交时间</th><th scope="col">来源套卷</th><th scope="col">得分 / 满分</th><th scope="col">得分率</th><th scope="col">正确率</th><th scope="col">报告</th></tr></thead><tbody>${page.points.map((point) => `<tr class="${point.attempt.id === selected?.attempt.id ? "analytics-row-selected" : ""}"><th scope="row">${actionButton("select", `第 ${point.ordinal} 次`, `data-attempt-id="${esc(point.attempt.id)}" aria-pressed="${point.attempt.id === selected?.attempt.id}" id="${esc(idFor(point.attempt.id, "select"))}"`, "analytics-row-button")}</th><td><time datetime="${new Date(point.attempt.createdAt).toISOString()}">${esc(timestampText(point.attempt.createdAt))}</time></td><td class="analytics-source-cell"><b>${esc(point.attempt.paperTitle)}</b><span>${esc(point.attempt.institution)} · ${esc(point.attempt.period)} · v${esc(point.attempt.versionLabel)}</span></td><td>${point.metrics ? `${hasValue(point.metrics.totalCents) ? score(point.metrics.totalCents) : "—"} / ${score(point.metrics.maxCents)}` : "—"}</td><td>${valueText(point.metrics?.rate, "rate")}</td><td>${point.metrics?.correct === null || !point.metrics ? "—" : `${point.metrics.correct} / ${point.metrics.count} · `}${valueText(point.metrics?.accuracy, "accuracy")}${point.missingReason ? `<small class="analytics-missing">${esc(point.missingReason)}</small>` : ""}</td><td>${reportLink(point.attempt)}</td></tr>`).join("")}</tbody></table></div>`;
}

function pagination(scope, page) {
  if (page.pageCount < 2) return `<p class="analytics-range">共 ${page.total} 次练习</p>`;
  return `<nav class="analytics-pagination" aria-label="练习数据分页">${actionButton("page", `${icon("left")}早一页`, `data-page="${page.page - 1}" ${page.page === 0 ? "disabled" : ""} id="${esc(idFor(scope, "earlier"))}"`)}${selector(scope, "page", "记录范围", Array.from({ length: page.pageCount }, (_, index) => ({ value: String(index), label: `${index * PAGE_SIZE + 1}–${Math.min(page.total, (index + 1) * PAGE_SIZE)} / ${page.total} 次` })), String(page.page))}${actionButton("page", `晚一页${icon("right")}`, `data-page="${page.page + 1}" ${page.page === page.pageCount - 1 ? "disabled" : ""} id="${esc(idFor(scope, "later"))}"`)}</nav>`;
}

function trendContent(scope, model, filters, compact = false) {
  const page = paginateTrend(model.points, filters.page, PAGE_SIZE);
  const points = model.points.filter((point) => point.value !== null);
  const dimensionName = model.types.find((type) => type.key === filters.dimension)?.name ?? "行测整体";
  const chartLabel = `${dimensionName}${LABELS[filters.metric]}`;
  const content = !model.bounds.valid
    ? '<p class="analytics-empty" role="status">请检查日期，开始日期不能晚于结束日期。</p>'
    : !model.points.length
      ? `<div class="analytics-empty" role="status"><p>所选条件下没有练习记录。</p>${actionButton("reset", "清除筛选")}</div>`
      : `${points.length ? `<div class="analytics-summary"><span><b>${model.points.length}</b> 次练习</span><span>最近一次 <b>${valueText(points.at(-1).value, filters.metric)}</b></span><span>平均${LABELS[filters.metric]} <b>${valueText(points.reduce((sum, point) => sum + point.value, 0) / points.length, filters.metric)}</b></span></div>` : ""}${trendChart(scope, page, filters)}${model.points.length < 2 ? '<p class="analytics-note" role="status">目前只有一次记录，下一次完成后再观察变化。</p>' : ""}${model.points.some((point) => point.missingReason) ? `<p class="analytics-note" role="status">${model.points.filter((point) => point.missingReason).length} 次记录缺少所选题型或指标，数据表标为“—”，曲线在缺失处断开。</p>` : ""}${trendTable(page, filters)}${pagination(scope, page)}`;
  // 跨卷统计不把首份报告的分值表冒充整类标准，具体分值通过对应报告查看。
  return `<section class="analytics-trend card" data-analytics-scope="${esc(scope)}"><div class="analytics-section-head"><h2>${compact ? "同卷多刷" : esc(chartLabel)}</h2>${compact ? routeLink("stats", `整体分析${icon("arrow")}`, "analytics-report-link") : ""}</div>${trendControls(scope, filters, model, compact)}${content}</section>`;
}

function comparisonCard(attempt, attempts) {
  if (attempt.isSample) return '<section class="analytics-comparison card"><h2>上一刷 VS 本次</h2><p class="analytics-note">示例报告不计入个人练习对比。</p></section>';
  const previous = selectPreviousAttempt(attempt, attempts);
  const comparison = compareAttempts(attempt, previous);
  if (!comparison) {
    // A first attempt has no decision to make here; keep the report free of an empty comparison card.
    return "";
  }
  return `<section class="analytics-comparison card"><div class="analytics-section-head"><h2>上一刷 VS 本次</h2>${reportLink(previous, `查看上一刷${icon("right")}`)}</div><div class="analytics-comparison-dates"><span>上一刷 <time datetime="${new Date(previous.createdAt).toISOString()}">${esc(timestampText(previous.createdAt))}</time></span><span>本次 <time datetime="${new Date(attempt.createdAt).toISOString()}">${esc(timestampText(attempt.createdAt))}</time></span></div><div class="analytics-vs-grid">${comparison.metrics.map((metric) => `<div class="analytics-vs-metric"><h3>${metric.key === "totalCents" ? "总分" : LABELS[metric.key]}</h3><div class="analytics-vs-values"><span>${valueText(metric.before, metric.key)}</span><span class="analytics-vs-label">VS</span><strong>${valueText(metric.after, metric.key)}</strong></div><span class="analytics-change analytics-change-${metric.direction}" aria-label="${directionLabel[metric.direction]}">${deltaText(metric.delta, metric.key)}</span></div>`).join("")}</div><details class="analytics-type-comparison"><summary>各题型对比 <span>${comparison.types.length} 项</span></summary><div class="analytics-table-scroll" tabindex="0" role="region" aria-label="上一刷与本次题型对比"><table class="analytics-table"><caption class="analytics-sr-only">相同评分规则下的题型对比</caption><thead><tr><th scope="col">题型</th><th scope="col">上一刷得分</th><th scope="col">本次得分</th><th scope="col">得分率变化</th><th scope="col">正确率变化</th><th scope="col">答对题数</th></tr></thead><tbody>${comparison.types.map((type) => `<tr><th scope="row">${esc(type.name)}</th><td>${valueText(type.before.totalCents, "totalCents")}<small>${valueText(type.before.rate, "rate")}</small></td><td>${valueText(type.after.totalCents, "totalCents")}<small>${valueText(type.after.rate, "rate")}</small></td><td class="analytics-change-${type.metrics[1].direction}">${deltaText(type.metrics[1].delta, "rate")}</td><td class="analytics-change-${type.metrics[2].direction}">${deltaText(type.metrics[2].delta, "accuracy")}<small>${valueText(type.before.accuracy, "accuracy")} → ${valueText(type.after.accuracy, "accuracy")}</small></td><td>${type.before.correct ?? "—"} → ${type.after.correct ?? "—"} / ${type.after.count}</td></tr>`).join("")}</tbody></table></div></details></section>`;
}

export function createAnalyticsFeature(ctx) {
  const document = ctx.document ?? globalThis.document;
  const preferences = new Map();
  const filtersFor = (scope, initial = {}) => {
    if (!preferences.has(scope)) preferences.set(scope, { ...defaults(), ...initial });
    return preferences.get(scope);
  };
  const rerender = () => {
    const focusId = document?.activeElement?.id;
    ctx.render();
    if (focusId) {
      const target = document?.getElementById(focusId);
      const focusTarget = target?.disabled ? target.closest(".analytics-pagination")?.querySelector("select") : target;
      focusTarget?.focus({ preventScroll: true });
    }
  };
  const scopeOf = (target) => target.closest("[data-analytics-scope]")?.dataset.analyticsScope;
  const click = (event) => {
    const target = event.target.closest?.("[data-analytics-action]");
    const scope = target && scopeOf(target);
    if (!scope || target.disabled) return;
    const filters = filtersFor(scope);
    if (target.dataset.analyticsAction === "select") filters.selectedAttemptId = target.dataset.attemptId;
    else if (target.dataset.analyticsAction === "page") { filters.page = Number(target.dataset.page); filters.selectedAttemptId = null; }
    else if (target.dataset.analyticsAction === "reset") preferences.set(scope, defaults());
    else return;
    rerender();
  };
  const change = (event) => {
    const target = event.target.closest?.("[data-analytics-control]");
    const scope = target && scopeOf(target);
    if (!scope) return;
    const field = target.dataset.analyticsControl;
    if (!["examCategory", "dimension", "metric", "sourceId", "from", "to", "page"].includes(field)) return;
    const filters = filtersFor(scope);
    filters[field] = field === "page" ? Number(target.value) : target.value;
    if (field !== "page") filters.page = "latest";
    if (field === "examCategory") filters.sourceId = "all";
    filters.selectedAttemptId = null;
    rerender();
  };
  const keydown = (event) => {
    const target = event.target.closest?.("[data-analytics-chart]");
    if (!target || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const ids = JSON.parse(target.dataset.analyticsIds);
    if (!ids.length) return;
    event.preventDefault();
    const index = Math.max(0, ids.indexOf(target.dataset.analyticsSelected));
    const next = event.key === "Home" ? 0 : event.key === "End" ? ids.length - 1 : Math.max(0, Math.min(ids.length - 1, index + (event.key === "ArrowLeft" ? -1 : 1)));
    filtersFor(scopeOf(target)).selectedAttemptId = ids[next];
    rerender();
  };
  document?.addEventListener("click", click);
  document?.addEventListener("change", change);
  document?.addEventListener("keydown", keydown);

  return {
    statsView({ state = ctx.state(), catalog = ctx.catalog(), version, versionId } = {}) {
      const anchor = state.attempts.find((attempt) => attempt.versionId === versionId || attempt.practiceVersionId === versionId);
      const selectedVersion = version ?? catalog.find((item) => item.id === versionId);
      const paperId = versionId ? selectedVersion?.paperId ?? anchor?.paperId : undefined;
      const scope = versionId ? `paper:${paperId ?? versionId}` : "overall";
      // 报告入口成为一次性的可见来源选择，不再给类别统计附加隐藏的paper/version条件。
      const filters = filtersFor(scope, versionId ? { sourceId: paperId ?? versionId, examCategory: anchor || selectedVersion ? classifyExamCategory(anchor || selectedVersion).id : null } : {});
      const model = buildAnalytics(state.attempts, { ...filters, grouping: "category" });
      const header = `<div class="analytics-page-title"><div><h1>成长分析</h1><p>按时间查看每一套卷的整体与题型表现。</p></div>${versionId ? routeLink("stats", `整体分析${icon("arrow")}`, "analytics-button button outline") : ""}</div>`;
      const empty = `<section class="analytics-empty card"><h2>还没有可分析的练习记录</h2><p>完成练习后，这里会展示每次成绩。</p>${routeLink(selectedVersion?.status === "published" ? `practice/${encodeURIComponent(selectedVersion.id)}` : "home", "去练习", "analytics-button button primary")}</section>`;
      return `<div class="analytics-page" data-analytics-scope="${esc(scope)}">${routeLink("me", `${icon("left")}返回我的记录`, "analytics-back back-link")}${header}${model.categories.some(category => category.count) ? trendContent(scope, model, filters) : trendControls(scope, filters, model, false) + empty}${excludedRecords(model)}</div>`;
    },
    afterRender() {
      if (!document) return;
      const attempts = ctx.state().attempts;
      for (const mount of document.querySelectorAll('[data-feature="analytics-entry"]')) {
        const count = attempts.filter((attempt) => analyzeAttempt(attempt)).length;
        mount.innerHTML = routeLink("stats", `<span>${icon("chart")}<b>成长分析</b><small>${count ? `${count} 次练习，查看整体与题型趋势` : "完成练习后，查看整体与题型趋势"}</small></span>${icon("right")}`, "analytics-entry");
      }
      for (const mount of document.querySelectorAll('[data-feature="analytics-comparison"]')) {
        const selected = ctx.attempt();
        const attempt = selected?.isSample ? selected : attempts.find((item) => item.id === selected?.id) ?? selected;
        if (!attempt) { mount.innerHTML = ""; continue; }
        const scope = `report:${attempt.id}`;
        const filters = filtersFor(scope);
        const rule = describeScoringRule(attempt);
        const model = buildAnalytics(attempts, { ...filters, paperId: attempt.paperId, versionId: attempt.paperId ? undefined : attempt.versionId, grouping: "compatible", ruleSignature: rule.signature, asOf: attempt.createdAt });
        const comparison = comparisonCard(attempt, attempts);
        const trend = !attempt.isSample && rule.valid && model.selected && model.points.length >= 3 ? trendContent(scope, model, filters, true) : "";
        mount.innerHTML = comparison || trend ? `<div class="analytics-report" data-analytics-scope="${esc(scope)}">${comparison}${trend}</div>` : "";
      }
    },
    destroy() {
      document?.removeEventListener("click", click);
      document?.removeEventListener("change", change);
      document?.removeEventListener("keydown", keydown);
      preferences.clear();
    },
  };
}
