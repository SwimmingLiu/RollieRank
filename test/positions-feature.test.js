import test from "node:test";
import assert from "node:assert/strict";
import { createPositionsFeature } from "../src/features/positions.js";

function fixture({ selected = false, failure = false } = {}) {
  const state = { guestId: "guest-feature-1234", attempts: [], profile: null };
  let route = { page: "practice", id: "test:v1" };
  const listeners = new Map();
  const previousDocument = globalThis.document;
  const values = { "#participate-submit": { checked: false } };
  globalThis.document = {
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
    querySelector(selector) { return values[selector] ?? null; },
    querySelectorAll() { return []; },
  };
  let profile = { positionId: selected ? "pos:chosen" : null, position: selected ? { id: "pos:chosen", year: 2027, exam: "guokao", title: "岗位", department: "部门" } : null,
    participation: { name: "匿名", attemptIds: [] } };
  const calls = [], modals = [], toasts = [];
  let resumed = 0;
  const context = {
    state: () => state, route: () => route, catalog: () => [], version: () => ({ id: "test:v1", questions: [] }), dimension: () => "total",
    async api(path, input) {
      calls.push({ path, input });
      if (failure) throw new Error("服务不可用");
      if (path.startsWith("positions/profile")) return structuredClone(profile);
      if (path === "positions/participation") { profile.participation = { name: input.name, attemptIds: [...input.attemptIds] }; return structuredClone(profile); }
      if (path === "positions/withdraw") { profile.participation.attemptIds = []; return structuredClone(profile); }
      if (path.startsWith("positions/catalog")) return { items: [], facets: { years: [], exams: [], regions: [] }, sources: [] };
      if (path.startsWith("positions/leaderboard")) {
        const query = new URLSearchParams(path.split("?")[1]);
        return { versionId: query.get("versionId"), dimension: "total", scope: query.get("scope"), count: 0, rows: [], self: null };
      }
      if (path === "positions/selection") {
        profile.positionId = input.positionId;
        profile.position = input.positionId ? { id: input.positionId, year: 2027, exam: "guokao", title: "岗位", department: "部门" } : null;
        return structuredClone(profile);
      }
      throw new Error(`unexpected path ${path}`);
    },
    persist() {}, toast(message) { toasts.push(message); }, openModal(title, body, actions, className) { modals.push({ title, body, actions, className }); },
    closeModal() {}, render() {}, async submitAttempt() { resumed++; assert.equal(await feature.beforeSubmit(), true); },
  };
  const feature = createPositionsFeature(context);
  return { feature, context, state, calls, modals, toasts, values,
    setRoute(value) { route = value; }, setMembership(ids) { profile.participation.attemptIds = [...ids]; }, get resumed() { return resumed; },
    async click(name) {
      listeners.get("click")({ target: { closest() { return { dataset: { positionAction: name }, disabled: false }; } }, preventDefault() {} });
      await new Promise((resolve) => setImmediate(resolve));
    },
    cleanup() { feature.destroy(); globalThis.document = previousDocument; },
  };
}

test("first submission without a job is blocked until an explicit skip, which survives retry", async () => {
  const app = fixture();
  try {
    assert.equal(await app.feature.beforeSubmit(), false);
    assert.match(app.modals.at(-1).actions, /skip-submit/);
    assert.equal(app.modals.at(-1).title, "选岗查看同岗排名");
    assert.equal(app.modals.at(-1).body, "");
    await app.click("skip-submit");
    assert.equal(app.resumed, 1);
    assert.equal(await app.feature.beforeSubmit(), true);
    assert.equal(app.calls.filter((c) => c.path === "positions/selection").length, 0);
    app.setRoute({ page: "practice", id: "another:v1" });
    assert.equal(await app.feature.beforeSubmit(), false);
    app.setRoute({ page: "practice", id: "test:v1" });
    await app.feature.afterSubmit({ id: "attempt-real-111" });
    assert.equal(await app.feature.beforeSubmit(), false);
  } finally { app.cleanup(); }
});

test("selected job submits directly and restores the server selection into persistent state", async () => {
  const app = fixture({ selected: true });
  try {
    assert.equal(await app.feature.beforeSubmit(), true);
    assert.equal(app.modals.length, 0);
    assert.equal(app.state.positions.positionId, "pos:chosen");
  } finally { app.cleanup(); }
});

test("profile failure offers explicit skip and keeps the real submission path available", async () => {
  const app = fixture({ failure: true });
  try {
    assert.equal(await app.feature.beforeSubmit(), false);
    assert.equal(app.modals.at(-1).title, "岗位暂不可用");
    await app.click("skip-submit");
    assert.equal(app.resumed, 1);
  } finally { app.cleanup(); }
});

test("formal submission reads automatic server membership without a second publication request", async () => {
  const app = fixture();
  try {
    assert.equal(await app.feature.beforeSubmit(), false);
    await app.click("skip-submit");
    app.state.attempts.push({ id: "attempt-real-111", participate: false, report: { totalCents: 999999 } });
    app.setMembership(["attempt-real-111"]);
    await app.feature.afterSubmit({ id: "attempt-real-111", isSample: false });
    assert.equal(app.calls.some((call) => call.path === "positions/participation"), false);
    assert.equal(app.state.attempts[0].participate, true);
    await app.feature.withdraw();
    assert.equal(app.state.attempts[0].participate, false);
  } finally { app.cleanup(); }
});

test("sample submissions never request membership and cannot reopen a publication form", async () => {
  const app = fixture({ selected: true });
  try {
    await app.feature.beforeSubmit();
    const before = app.calls.length;
    await app.feature.afterSubmit({ id: "sample-11111111", isSample: true });
    assert.equal(app.calls.length, before);
    assert.equal(app.feature.openParticipation, undefined);
    await app.click("participation");
    assert.equal(app.modals.length, 0);
  } finally { app.cleanup(); }
});

test("a post-submit profile failure keeps the saved result and reports unavailable ranking", async () => {
  const app = fixture({ selected: true });
  try {
    assert.equal(await app.feature.beforeSubmit(), true);
    const original = app.context.api;
    app.context.api = (path, input) => path.startsWith("positions/profile") ? Promise.reject(new Error("同步中断")) : original(path, input);
    app.state.attempts.push({ id: "attempt-real-111", participate: true });
    await assert.rejects(app.feature.afterSubmit({ id: "attempt-real-111", isSample: false }), /同步中断/);
    assert.equal(app.state.attempts[0].participate, true);
    assert.equal(app.toasts.at(-1), "成绩已保存，排名暂未刷新。");
  } finally { app.cleanup(); }
});

test("real rank view escapes names, keeps version isolation and dimension controls without visible version or enrollment UI and provides recoverable loading", () => {
  const app = fixture();
  try {
    const version = { id: 'v1"<script>', title: "<危险>", versionLabel: "1.0", period: "一期", questions: [{ typeId: 'logic"<>', type: "<判断>" }], questionCount: 1, maxCents: 100 };
    const html = app.feature.rankView({ catalog: [version], version });
    assert.match(html, /id="rank-paper"/);
    assert.match(html, /data-action="dimension"/);
    assert.match(html, /正在读取成绩/);
    assert.equal(html.includes("<script>"), false);
    assert.equal(html.includes("<危险>"), false);
    assert.equal(html.includes("演示榜"), false);
    assert.equal(html.includes("上榜设置"), false);
    assert.equal(html.includes("停止上榜"), false);
    assert.equal(html.includes("v1.0"), false);
  } finally { app.cleanup(); }
});

test("ranking help contains only three short business rules", async () => {
  const app = fixture();
  try {
    await app.click("rules");
    const modal = app.modals.at(-1);
    assert.equal(modal.title, "榜单规则");
    assert.equal((modal.body.match(/<p>/g) || []).length, 3);
    assert.ok(modal.body.includes("交卷自动入榜，同卷取最高分。"));
    assert.equal(modal.body.includes("当前服务"), false);
    assert.equal(modal.body.includes("自愿"), false);
  } finally { app.cleanup(); }
});

// A nationwide fallback used to leave the job control selected, so check the requested scope at its owner.
test("a candidate without a job opens the nationwide board and the job action asks for a real selection", async () => {
  const app = fixture();
  try {
    app.setRoute({ page: "rank", id: "test:v1" });
    await app.feature.onRoute();
    assert.equal(app.feature.snapshot().scope, "nationwide");
    const read = app.calls.findLast(call => call.path.startsWith("positions/leaderboard"));
    assert.equal(new URLSearchParams(read.path.split("?")[1]).get("scope"), "nationwide");
    const view = app.feature.rankView({ version: app.context.version(), catalog: [] });
    assert.match(view, /data-position-action="scope-nationwide" aria-pressed="true"/);
    await app.click("scope-selected");
    assert.equal(app.feature.snapshot().scope, "nationwide");
    assert.equal(app.modals.at(-1).title, "选择我的岗位");
  } finally { app.cleanup(); }
});

// Leaving the board used to discard an intentional national or browsed-job comparison.
test("real selected jobs set the initial scope while explicit comparison scopes survive navigation", async () => {
  const app = fixture({ selected: true });
  try {
    const enterBoard = async () => {
      app.setRoute({ page: "report", id: "attempt-real-111" }); await app.feature.onRoute();
      app.setRoute({ page: "rank", id: "test:v1" }); await app.feature.onRoute();
    };
    await enterBoard();
    assert.equal(app.feature.snapshot().scope, "selected");
    await app.click("scope-nationwide"); await enterBoard();
    assert.equal(app.feature.snapshot().scope, "nationwide");
    app.feature.browsePosition({ id: "pos:other", year: 2027, exam: "guokao", department: "其他部门", title: "其他岗位" });
    await enterBoard();
    const snapshot = app.feature.snapshot();
    assert.equal(snapshot.scope, "position");
    assert.equal(snapshot.browsingPosition.id, "pos:other");
    assert.equal(snapshot.profile.positionId, "pos:chosen");
    const read = app.calls.findLast(call => call.path.startsWith("positions/leaderboard"));
    assert.equal(new URLSearchParams(read.path.split("?")[1]).get("positionId"), "pos:other");
    await app.feature.selectPosition(null); await enterBoard();
    assert.equal(app.feature.snapshot().scope, "nationwide");
    assert.equal(app.feature.snapshot().profile.positionId, null);
  } finally { app.cleanup(); }
});
