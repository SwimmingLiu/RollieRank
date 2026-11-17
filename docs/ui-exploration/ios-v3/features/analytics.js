import { analyzeAttempt, analyticsDateBounds, analyticsTypeKey, buildAnalytics, buildTrendGeometry, classifyExamCategory, compareAttempts, paginateTrend, selectPreviousAttempt } from "../../../../src/analytics.js";
import { esc } from "../../../../src/ui.js";

const PAGE_SIZE = 8;
const numeric = (value) => Number.isFinite(value) ? value : null;
const preferences = () => ({ examCategory: null, dimension: "total", metric: "rate", sourceId: "all", from: "", to: "", page: "latest", selectedId: null });
const shortDate = (value, withYear = false) => new Intl.DateTimeFormat("zh-CN", { ...(withYear ? { year: "2-digit" } : {}), month: "2-digit", day: "2-digit" }).format(new Date(value));
const format = (value, metric) => !Number.isFinite(value) ? "—" : metric === "totalCents" ? String(Number((value / 100).toFixed(2))) : `${Number((value * 100).toFixed(1))}%`;
const metricLabels = { totalCents: "得分", rate: "得分率", accuracy: "正确率" };
const isoDate = (value) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };

function chartModel(points, metric, compact = false) {
  const geometry = buildTrendGeometry(points, { width: 320, height: compact ? 112 : 190, metric });
  return {
    width: geometry.width, height: geometry.height,
    ticks: geometry.ticks.filter((_, i) => compact ? i === 0 || i === 4 : i % 2 === 0).map((tick) => ({ y: tick.y, label: format(tick.value, metric) })),
    lines: geometry.segments.filter((segment) => segment.length > 1).map((segment) => segment.map((point) => `${point.x},${point.y}`).join(" ")),
    nodes: geometry.coordinates.map((point) => ({ id: point.attempt.id, ordinal: point.ordinal, x: point.x, y: point.y, date: shortDate(point.attempt.createdAt, !compact), value: format(point.value, metric), title: point.attempt.paperTitle, institution: point.attempt.institution })),
  };
}

// 报告只保留可比记录的紧凑摘要；首刷、样例和无法确定先后的同时间记录不生成额外曲线。
export function buildIOSReportAnalysis(current, attempts) {
  const entry = analyzeAttempt(current);
  if (!entry || !attempts.some((attempt) => attempt.id === current.id && !attempt.isSample)) return null;
  const previous = selectPreviousAttempt(current, attempts);
  const comparison = compareAttempts(current, previous);
  if (!comparison) return null;
  // 对比保留所有真实板块及卷内顺序，不能只挑变化最大的三项。
  const typeOrder = [...new Set(current.report.rows.map(analyticsTypeKey))];
  const history = buildAnalytics(attempts.filter((attempt) => attempt.id === current.id || attempt.createdAt < current.createdAt), { paperId: current.paperId, versionId: current.paperId ? undefined : current.versionId, grouping: "compatible", ruleSignature: entry.rule.signature, asOf: current.createdAt, metric: "totalCents" });
  return {
    previousId: previous.id, currentId: current.id, previousScore: comparison.metrics[0].before, currentScore: comparison.metrics[0].after, delta: comparison.metrics[0].delta,
    rates: comparison.metrics.slice(1).map((metric) => ({ key: metric.key, label: metricLabels[metric.key], before: metric.before, after: metric.after, delta: metric.delta })),
    types: typeOrder.flatMap((key) => {
      const type = comparison.types.find((item) => item.key === key);
      return type ? [{ key: type.key, name: type.name, before: numeric(type.before.rate), after: numeric(type.after.rate), delta: numeric(type.metrics[1].delta) }] : [];
    }),
    count: history.points.length,
    chart: history.points.length >= 3 ? chartModel(history.points.slice(-8), "totalCents", true) : null,
    statsPath: `stats/${encodeURIComponent(current.versionId)}`,
  };
}

export function buildIOSStatsAnalysis(attempts, options = {}, filters = preferences()) {
  // 单一卷型筛选纳入该类全部有效成绩；来源权重只计算各自指标，不再成为隐藏筛选。
  // 报告入口的卷身份只决定初始可见来源，类别和“全部套卷”始终读取完整历史。
  const model = buildAnalytics(attempts, { ...filters, grouping: "category" });
  const category = model.category;
  const page = paginateTrend(model.points, filters.page, PAGE_SIZE);
  const selected = page.points.find((point) => point.attempt.id === filters.selectedId) ?? page.points.at(-1);
  const valid = model.points.filter((point) => point.value !== null);
  const latest = valid.at(-1);
  return {
    title: options.title || "成长分析", dimension: filters.dimension, metric: filters.metric,
    dimensionLabel: model.types.find((type) => type.key === filters.dimension)?.name ?? (filters.dimension === "total" ? "行测整体" : "所选题型"), metricLabel: metricLabels[filters.metric],
    dimensions: [{ id: "total", label: "行测整体" }, ...model.types.map((type) => ({ id: type.key, label: type.name }))],
    categories: model.categories.map(item => ({ id: item.id, label: item.label, detail: `${item.count} 次练习` })),
    categoryId: category?.id ?? "", categoryLabel: category?.label ?? "选择考试类别",
    sources: [{ id: "all", label: "全部套卷" }, ...model.sources.map((source) => ({ id: source.id, label: source.title || source.id, detail: source.institution || "" }))],
    sourceId: filters.sourceId, sourceLabel: filters.sourceId === "all" ? "全部套卷" : model.sources.find((source) => source.id === filters.sourceId)?.title ?? "所选套卷",
    from: filters.from, to: filters.to, boundsValid: model.bounds.valid, total: model.points.length, rejectedCount: model.rejected.length,
    calendarAnchor: isoDate(model.points.at(-1)?.attempt.createdAt ?? Date.now()),
    latestRatio: latest ? filters.metric === "totalCents" ? latest.value / latest.metrics.maxCents : latest.value : null,
    latest: valid.length ? format(valid.at(-1).value, filters.metric) : "—", average: valid.length ? format(valid.reduce((sum, point) => sum + point.value, 0) / valid.length, filters.metric) : "—",
    chart: chartModel(page.points, filters.metric), selectedId: selected?.attempt.id ?? "",
    rows: page.points.map((point) => ({ id: point.attempt.id, ordinal: point.ordinal, date: shortDate(point.attempt.createdAt, true), title: point.attempt.paperTitle, institution: point.attempt.institution, score: point.metrics ? `${format(point.metrics.totalCents, "totalCents")} / ${format(point.metrics.maxCents, "totalCents")}` : "—", value: format(point.value, filters.metric), accuracy: format(point.metrics?.accuracy, "accuracy"), missing: point.missingReason })),
    page: page.page, pageCount: page.pageCount, start: page.start + 1, end: page.end,
  };
}

// 原生组件取代根应用整页 HTML；筛选仅更新本模块，避免报告重新挂载完整筛选与历史表。
export function createIOSAnalyticsFeature(ctx) {
  const document = ctx.document ?? globalThis.document;
  const scopes = new Map(), filters = new Map(), mounts = new Map();
  const attempts = () => ctx.state().attempts.filter((attempt) => attempt && !attempt.isSample);
  const ui = () => document?.defaultView?.RollieUI ?? globalThis.window?.RollieUI;
  const getFilters = (scope) => {
    if (!filters.has(scope)) {
      const entry = scopes.get(scope);
      filters.set(scope, { ...preferences(), sourceId: entry?.initialSourceId ?? "all", examCategory: entry?.initialCategory ?? null });
    }
    return filters.get(scope);
  };
  function paintStats(host, scope) {
    if (!ui()?.mountAnalyticsStats) return;
    const preference = getFilters(scope);
    const update = (patch) => {
      Object.assign(preference, patch);
      // 切换卷型明确清除入口卷，不让旧来源将另一个卷型隐形筛空。
      if (Object.hasOwn(patch, "examCategory")) preference.sourceId = "all";
      if (!Object.hasOwn(patch, "page") && !Object.hasOwn(patch, "selectedId")) preference.page = "latest";
      if (!Object.hasOwn(patch, "selectedId")) preference.selectedId = null;
      paintStats(host, scope);
    };
    mounts.set(host, ui().mountAnalyticsStats(host, { model: buildIOSStatsAnalysis(attempts(), scopes.get(scope), preference), onChange: update, onDates(from, to) { if (!analyticsDateBounds(from, to).valid) return false; update({ from, to }); return true; }, onReport: (id) => ctx.navigate(`report/${encodeURIComponent(id)}`) }));
  }
  const click = (event) => {
    const link = event.target.closest?.("[data-ios-analytics-entry]");
    if (!link || event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); ctx.navigate("stats");
  };
  document?.addEventListener("click", click);
  return {
    statsView(options = {}) {
      const version = options.version ?? ctx.catalog().find((item) => item.id === options.versionId);
      const anchor = attempts().find((attempt) => attempt.versionId === options.versionId);
      const paperId = options.versionId ? version?.paperId ?? anchor?.paperId : undefined;
      const scope = options.versionId ? `paper:${paperId ?? options.versionId}` : "overall";
      // 只在此入口首次创建偏好时选择来源，之后的“全部套卷”和卷型切换不再重施入口范围。
      scopes.set(scope, { title: "成长分析", initialSourceId: options.versionId ? paperId ?? options.versionId : "all", initialCategory: options.versionId && (anchor || version) ? classifyExamCategory(anchor || version).id : null });
      return `<div class="ios-feature-host ios-analytics" data-ios-analytics-stats="${esc(scope)}"></div>`;
    },
    afterRender() {
      for (const [host, dispose] of mounts) if (!host.isConnected) { dispose(); mounts.delete(host); }
      for (const host of document?.querySelectorAll("[data-ios-analytics-stats]") ?? []) paintStats(host, host.dataset.iosAnalyticsStats);
      for (const host of document?.querySelectorAll('[data-feature="analytics-comparison"]') ?? []) {
        const selected = ctx.attempt();
        const current = selected?.isSample ? null : attempts().find((attempt) => attempt.id === selected?.id);
        const model = current ? buildIOSReportAnalysis(current, attempts()) : null;
        host.classList.add("ios-analytics"); host.hidden = !model;
        if (!model) { mounts.get(host)?.(); mounts.delete(host); host.replaceChildren(); continue; }
        if (ui()?.mountAnalyticsReport) mounts.set(host, ui().mountAnalyticsReport(host, { model, onOpen: () => ctx.navigate(model.statsPath), onPrevious: () => ctx.navigate(`report/${encodeURIComponent(model.previousId)}`) }));
      }
      for (const host of document?.querySelectorAll('[data-feature="analytics-entry"]') ?? []) host.innerHTML = '<a href="#/stats" class="ios-analysis-entry" data-ios-analytics-entry><span>成长分析</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 20V4m0 16h16M8 15l4-5 4 2 4-7"/></svg></a>';
    },
    destroy() { document?.removeEventListener("click", click); for (const dispose of mounts.values()) dispose(); mounts.clear(); scopes.clear(); filters.clear(); },
  };
}
