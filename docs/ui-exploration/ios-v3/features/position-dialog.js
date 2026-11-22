const levels = ["source", "category", "department", "unit", "position"];
const fields = ["sourceId", "categoryId", "departmentId", "unitId"];
const levelField = Object.fromEntries(levels.slice(0, 4).map((level, index) => [level, fields[index]]));

export function parsePositionHierarchy(data) {
  if (!data || !levels.includes(data.level) || !Array.isArray(data.options) || !Array.isArray(data.breadcrumbs) ||
    !Number.isInteger(data.page) || !Number.isInteger(data.pages) || !Number.isInteger(data.total))
    throw new Error("岗位目录暂时无法读取，请重试。");
  if (!data.options.every(option => option && typeof option.id === "string" && typeof option.label === "string" &&
    (data.level !== "position" || typeof option.positionId === "string" && typeof option.code === "string" && option.position?.id === option.positionId)))
    throw new Error("岗位目录格式已更新，请重新读取。");
  if (!data.breadcrumbs.every(crumb => crumb && levels.includes(crumb.level) && typeof crumb.id === "string" && typeof crumb.label === "string"))
    throw new Error("岗位路径无法确认，请重新选择。");
  return data;
}

export function createIOSPositionDialog(ctx, core) {
  let dialog = null, sequence = 0, searchTimer, cancelMount;
  const sourceCount = () => core.snapshot().catalog?.sources?.length ?? 0;
  const profile = () => core.snapshot().profile;
  const visible = current => dialog === current && current.host?.isConnected;
  const subscription = ctx.onModalClose?.(({ reason }) => {
    cancelMount?.();
    if (!dialog) return;
    clearTimeout(searchTimer);
    dialog = null; sequence++;
    if (reason === "dismiss") core.cancelSubmissionPrompt();
  });
  const queryFrom = data => Object.fromEntries(data.breadcrumbs.filter(crumb => crumb.level !== "position").map(crumb => [levelField[crumb.level], crumb.id]));
  const contextLabel = source => source ? `${source.year} ${source.exam === "guokao" ? "国考" : "省考"}${source.region && source.region !== "全国" ? " · " + source.region : ""}` : "";

  // BottomSheet 的 portal 会晚于 openModal 返回；等本次节点出现，并在关闭或替换时取消等待。
  function waitForHost(selector) {
    cancelMount?.();
    const present = document.querySelector(selector);
    if (present) return Promise.resolve(present);
    return new Promise(resolve => {
      const observer = new MutationObserver(() => {
        const host = document.querySelector(selector);
        if (!host) return;
        observer.disconnect(); cancelMount = null; resolve(host);
      });
      cancelMount = () => { observer.disconnect(); cancelMount = null; resolve(null); };
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  function paint(current) {
    if (!visible(current)) return;
    const data = current.data;
    const ui = globalThis.window?.RollieUI;
    if (current.detail) {
      const item = current.detail, position = item.position;
      const source = data?.source;
      ui.mountPositionDetail(current.host, { title: position.title, code: position.code,
        fields: [["招录部门", position.department], ["用人单位", position.unit], ["工作地点", position.location], ["招录人数", position.recruits === null ? "" : String(position.recruits) + "人"], ["学历", position.education], ["专业", position.major]].filter(([, value]) => value).map(([label, value]) => ({ label, value })),
        source: /^https?:\/\//.test(source?.sourcePage || "") ? { label: "查看原始职位表", url: source.sourcePage } : null,
        selected: profile()?.positionId === position.id, saving: current.load.kind === "saving",
        onBack: () => { current.detail = null; paint(current); }, onSelect: () => { void pick(current, item.id); } });
      return;
    }
    if (!ui?.mountPositionPicker) throw new Error("岗位选择器未能加载，请刷新页面。");
    ui.mountPositionPicker(current.host, {
      level: data?.level ?? "source", exam: current.exam, context: contextLabel(data?.source), canSwitchSource: true,
      breadcrumbs: (data?.breadcrumbs ?? []).filter(crumb => crumb.level !== "source" && crumb.level !== "position" && !crumb.automatic),
      choices: current.options.map(option => data?.level === "position"
        ? { kind: "position", id: option.id, label: option.label, positionId: option.positionId, code: option.code }
        : { kind: "branch", id: option.id, label: option.automatic ? data?.level === "category" ? "直接选择招录部门" : "查看未分单位的岗位" : option.label }),
      selectedId: profile()?.positionId ?? null, query: current.q, searchable: current.searchable,
      hasMore: Boolean(data && data.page < data.pages), load: current.load,
      onQuery: value => {
        current.q = value;
        clearTimeout(searchTimer);
        current.request++;
        current.load = { kind: "loading" }; paint(current);
        searchTimer = setTimeout(() => { if (visible(current)) void load(current); }, 250);
      },
      onSearch: () => { clearTimeout(searchTimer); void load(current); },
      onPick: id => { void pick(current, id); }, onBack: level => { void back(current, level); },
      onInfo: id => { const item = current.options.find(option => option.id === id); if (item?.position) { current.detail = item; paint(current); } },
      onMore: () => { void load(current, true); }, onRetry: () => { void load(current); },
      onExam: exam => { if (current.load.kind !== "saving") { current.exam = exam; current.query = {}; current.q = ""; current.options = []; void load(current); } },
    });
  }

  async function load(current, more = false, automaticDepth = 0) {
    if (!visible(current) || current.load.kind === "saving") return;
    const request = ++current.request;
    const requestedPage = more ? (current.data?.page ?? 1) + 1 : 1;
    current.load = { kind: "loading" }; paint(current);
    try {
      const query = new URLSearchParams({ ...current.query, q: current.q, pageSize: "100" });
      if (more || !current.query.positionId) query.set("page", String(requestedPage));
      const data = parsePositionHierarchy(await ctx.api("positions/hierarchy?" + query));
      if (!visible(current) || request !== current.request) return;
      if (data.level === "source") current.sourceCount = data.total;
      const oldLevel = current.data?.level;
      current.data = data; current.query = queryFrom(data);
      if (data.source) current.exam = data.source.exam;
      // 来源由完整目录元数据筛选，首层不因只有一份国考表而跳过考试选择。
      if (data.level === "source") {
        // 维护者可能在另一页面刚导入省考表，打开来源层时读取最新目录，避免沿用旧国考缓存。
        const catalog = await ctx.api("positions/catalog?pageSize=1");
        if (!visible(current) || request !== current.request) return;
        const sources = catalog.sources;
        if (!Array.isArray(sources)) throw new Error("招考目录暂未就绪，请重试。");
        const matching = sources.filter(source => source.exam === current.exam && (!current.q || `${source.year} ${source.region} ${source.label}`.includes(current.q)));
        current.options = matching.map(source => ({ id: source.id, label: `${source.year}年 · ${source.region}` }));
        current.data = { ...data, total: matching.length, page: 1, pages: 1, autoAdvance: false };
        current.searchable = matching.length > 10 || Boolean(current.q);
        current.load = { kind: "ready" }; paint(current); return;
      }
      current.searchable = oldLevel === data.level ? current.searchable || data.total > 10 || Boolean(current.q) : data.total > 10;
      if (data.autoAdvance && data.options.length === 1 && automaticDepth < 4) {
        current.query[levelField[data.level]] = data.options[0].id; current.q = "";
        current.load = { kind: "ready" };
        await load(current, false, automaticDepth + 1); return;
      }
      current.options = more ? [...current.options, ...data.options.filter(option => !current.options.some(prior => prior.id === option.id))] : data.options;
      current.load = { kind: "ready" }; paint(current);
    } catch (error) {
      if (!visible(current) || request !== current.request) return;
      current.load = { kind: "error", message: error.message }; paint(current);
    }
  }

  async function pick(current, id) {
    if (!visible(current) || current.load.kind !== "ready") return;
    const option = current.options.find(item => item.id === id);
    if (!option) return;
    if (current.data.level === "position") {
      current.load = { kind: "saving", id }; paint(current);
      if (current.mode === "browse") { core.browsePosition(option.position); return; }
      const saved = await core.selectPosition(option.positionId);
      if (visible(current) && !saved) { current.load = { kind: "error", message: "岗位未保存，请重试。" }; paint(current); }
      return;
    }
    current.query[levelField[current.data.level]] = option.id;
    current.q = ""; current.options = []; current.searchable = false;
    await load(current);
  }
  async function back(current, level) {
    if (!visible(current) || current.load.kind === "saving") return;
    clearTimeout(searchTimer);
    const depth = levels.indexOf(level);
    current.query = Object.fromEntries(fields.filter((field, index) => index < depth && current.query[field]).map(field => [field, current.query[field]]));
    current.q = ""; current.options = []; current.searchable = false;
    await load(current);
  }

  async function openPicker(mode = "select") {
    clearTimeout(searchTimer);
    const id = ++sequence;
    ctx.openModal(mode === "browse" ? "查看岗位榜" : "报考岗位", `<div data-ios-position-picker="${id}"></div>`, "", "ios-position-native-modal");
    const current = { kind: "picker", mode, exam: profile()?.position?.exam ?? "guokao", host: null, query: profile()?.positionId ? { positionId: profile().positionId } : {},
      data: null, options: [], q: "", sourceCount: sourceCount(), searchable: false, load: { kind: "ready" }, request: 0 };
    dialog = current;
    current.host = await waitForHost(`[data-ios-position-picker="${id}"]`);
    if (visible(current)) await load(current);
  }
  async function openPrompt({ failed }) {
    const id = ++sequence;
    // 用途只出现在标题，不再用一行小字重复解释。
    ctx.openModal(failed ? "岗位暂不可用" : "选岗查看同岗排名", `<div data-ios-position-prompt="${id}"></div>`, "", "ios-position-native-modal");
    const current = { kind: "prompt", host: null };
    dialog = current;
    current.host = await waitForHost(`[data-ios-position-prompt="${id}"]`);
    if (!visible(current)) return;
    const ui = globalThis.window?.RollieUI;
    if (!ui?.mountPositionSubmitPrompt) throw new Error("提交提示未能加载，请刷新页面。");
    ui.mountPositionSubmitPrompt(current.host);
  }
  return { openPicker, openPrompt, destroy() { clearTimeout(searchTimer); cancelMount?.(); sequence++; dialog = null; subscription?.(); } };
}
