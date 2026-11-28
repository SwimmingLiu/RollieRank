import { createPositionsFeature } from "../../../../src/features/positions.js";
import { score } from "../../../../src/ui.js";
import { createIOSPositionDialog } from "./position-dialog.js";
import { resolveSubjectDimension, subjectDimensions } from "../../../../src/subjects.js";

const rootClass = "ios-feature-host ios-positions-region ios-positions-sheet";
const noStanding = () => ({ rank: null, count: 0 });
const validStanding = (data) => Number.isInteger(data?.count) && data.count >= 0 &&
  (data.self === null || (Number.isInteger(data.self?.rank) && data.self.rank > 0));

export function createIOSPositionsFeature(ctx) {
  let picker;
  const core = createPositionsFeature({ ...ctx,
    openPositionPicker: mode => picker.openPicker(mode),
    openPositionSubmitPrompt: options => picker.openPrompt(options),
    openModal(title, body, actions = "", className = "") {
      ctx.openModal(title, `<div class="${rootClass}">${body}</div>`,
        actions ? `<div class="${rootClass} ios-positions-sheet-actions">${actions}</div>` : "", `${className} ios-positions-modal`);
    },
  });
  picker = createIOSPositionDialog(ctx, core);
  let summary = { key: null, data: noStanding() };
  let summaryGeneration = 0;
  let active = true;
  const versionKey = () => `${ctx.state().guestId}:${ctx.version()?.id || ""}`;
  const isSample = () => ["report", "share", "details"].includes(ctx.route()?.page) && ctx.attempt()?.isSample === true;
  function standing() {
    return !isSample() && summary.key === versionKey() ? { ...summary.data } : noStanding();
  }
  async function refreshStanding() {
    const generation = ++summaryGeneration;
    const version = ctx.version();
    const key = versionKey();
    summary = { key, data: noStanding() };
    if (!version || isSample()) return;
    try {
      const query = new URLSearchParams({ guestId: ctx.state().guestId, versionId: version.id,
        dimension: "total", scope: "selected", pageSize: "1" });
      const response = await ctx.api(`positions/leaderboard?${query}`);
      if (!validStanding(response)) throw new Error("榜单响应格式无效。");
      if (!active || generation !== summaryGeneration || versionKey() !== key || isSample()) return;
      summary = { key, data: { rank: response.self?.rank ?? null, count: response.count } };
    } catch {
      if (generation === summaryGeneration && versionKey() === key) summary = { key, data: noStanding() };
    }
  }

  function rankView() {
    return '<div class="ios-feature-host ios-positions-region ios-positions-rank"><div id="ios-positions-rank-ui" data-ios-positions-rank></div></div>';
  }
  function mountRank() {
    const host = globalThis.document?.querySelector("[data-ios-positions-rank]");
    if (!host) return;
    const ui = globalThis.window?.RollieUI;
    if (!ui?.mountRank) {
      host.innerHTML = '<p class="ios-positions-status" role="alert">排名组件未能加载，请刷新页面。</p>';
      return;
    }
    const version = ctx.version();
    if (!version) {
      host.innerHTML = '<p class="ios-positions-status" role="status">请选择一套已发布的试卷。</p>';
      return;
    }
    const snapshot = core.snapshot();
    const data = snapshot.board.data;
    const currentDimension = resolveSubjectDimension(version.questions, ctx.dimension() || "total");
    const matches = data?.versionId === version.id && data.dimension === currentDimension;
    const board = matches ? data : null;
    // 所有榜单标签来自共享板块，保留自定义题型且只显示一项判断推理。
    const dimensions = [{ value: "total", label: "总分" }, ...subjectDimensions(version.questions).map(type => ({ value: type.id, label: type.name }))];
    const dimension = dimensions.find(item => item.value === currentDimension) ?? dimensions[0];
    const convert = (row, index) => ({ key: `${row.rank}:${row.createdAt}:${index}`, place: row.rank, name: row.name,
      ...(row.avatarUrl ? { avatarSrc: row.avatarUrl } : {}),
      score: currentDimension === "total" ? row.value / 100 : row.rate * 100,
      detail: currentDimension === "total" ? "" : `${score(row.value)} / ${score(row.maxCents)} 分`, isMe: row.isMe,
      publicId: row.publicId, surpassedPercent: row.surpassedPercent });
    const rows = (board?.rows || []).map(convert);
    const firstPage = !board || board.page === 1;
    const position = snapshot.scope === "position" ? snapshot.browsingPosition : snapshot.profile?.position;
    const positionLabel = position ? `${position.year} ${position.exam === "guokao" ? "国考" : "省考"} · ${position.department} · ${position.title}` : "尚未选岗";
    const publisher = version.institution || "";
    const year = version.year ?? [version.project, version.title].join(" ").match(/20\d{2}/)?.[0] ?? "";
    // 二期地市与副省有相同套号；保留真实半年、期次和卷类，避免榜单身份混淆。
    const collection = version.period
      ? [version.project?.match(/(?:上|下)半年/)?.[0], version.period].filter(Boolean).join(" · ")
      : version.project || "";
    // 共用卷保留两个类别，使用对应的短称给单行身份留空间，不按题量推断卷型。
    const variant = (version.variant || "").replace(/地市级\s*\/\s*行政执法类/, "地市/执法");
    ui.mountRank(host, {
      identityLabel: `${publisher} · ${version.title}`,
      publisherLogoSrc: ui.publisherIcon?.(publisher) || "",
      // 可见身份与无障碍名称都依据当前真实卷，卷类不再只藏在完整标题中。
      context: { publisher: ui.publisherName?.(publisher) || publisher, year, collection, variant, paper: `${String(version.number).padStart(2, "0")}套` },
      dimension: dimension.value, dimensions,
      people: firstPage ? rows.slice(0, 3) : [], rows: firstPage ? rows.slice(3) : rows,
      myRank: board?.self?.rank ?? null, participants: board?.count ?? 0,
      myScore: board?.self ? convert(board.self, 0).score : null,
      mySurpassedPercent: board?.self?.surpassedPercent ?? null,
      // 公开详情沿用当前榜单范围，服务端重新检查该成员的上榜授权。
      onPerson(publicId) {
        globalThis.document.dispatchEvent(new CustomEvent("rollierank:public-result", { detail: { publicId, versionId: version.id, scope: snapshot.scope, positionId: position?.id || null } }));
      },
      scoreUnit: currentDimension === "total" ? "分" : "%",
      scope: { value: snapshot.scope, label: snapshot.scope === "nationwide" ? "全国" : positionLabel, missingSelection: board?.selectionMissing === true,
        position: position ? { year: position.year, exam: position.exam, department: position.department, title: position.title } : null },
      paging: { page: board?.page ?? 1, pages: board?.pages ?? 1 },
      loadState: snapshot.board.error ? { kind: "error", message: snapshot.board.error } : !matches ? { kind: "loading" } : { kind: "ready" },
      onDimensionChange(id) {
        if (!dimensions.some((item) => item.value === id)) return;
        ctx.setDimension(id);
        ctx.render();
      },
      onBack() {
        const attempt = ctx.attempt();
        ctx.navigate(attempt && !attempt.isSample ? `report/${encodeURIComponent(attempt.id)}` : "me");
      },
    });
  }
  function afterRender() {
    for (const name of ["positions-profile", "positions-admin"]) globalThis.document?.querySelector(`[data-feature="${name}"]`)?.classList.add("ios-positions-region");
    core.afterRender();
    mountRank();
  }
  async function onRoute() {
    await core.onRoute();
    if (["rank", "report", "share", "details"].includes(ctx.route()?.page)) {
      await refreshStanding();
      if (active) ctx.render();
    }
  }
  async function afterSubmit(attempt) {
    summary = { key: null, data: noStanding() };
    await core.afterSubmit(attempt);
    await refreshStanding();
  }
  async function withdraw() {
    await core.withdraw();
    await refreshStanding();
    if (active) ctx.render();
  }
  return { afterRender, onRoute, beforeSubmit: core.beforeSubmit, afterSubmit, rankView, mountRank, standing,
    openPicker: core.openPicker, withdraw, snapshot: core.snapshot,
    destroy() { active = false; summaryGeneration++; picker.destroy(); core.destroy(); },
  };
}
