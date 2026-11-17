import test from "node:test";
import assert from "node:assert/strict";
import { createIOSPositionsFeature } from "../docs/ui-exploration/ios-v3/features/positions.js";
import { createPositionsFeature } from "../src/features/positions.js";
import { createFixture, guestId, otherGuest } from "./ios-positions-fixtures.mjs";

function context(app, t, { page = "rank", sample = false } = {}) {
  const previous = { document: globalThis.document, window: globalThis.window };
  const listeners = new Map(), mounted = [], calls = [];
  let route = { page, id: app.version.id }, dimension = "total", currentVersion = app.version;
  const host = { innerHTML: "" };
  globalThis.document = { querySelector: (selector) => selector === "[data-ios-positions-rank]" ? host : null,
    addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: (name) => listeners.delete(name) };
  globalThis.window = { RollieUI: { mountRank: (container, props) => mounted.push(props), publisherName: () => "花生", publisherIcon: () => "assets/publishers/sihai-peanut.svg" } };
  const state = { guestId, attempts: [], drafts: {}, profile: { name: "验收甲", id: guestId } };
  let feature;
  const ctx = { state: () => state, version: () => currentVersion, catalog: () => [currentVersion], route: () => route,
    dimension: () => dimension, setDimension: (id) => { dimension = id; }, attempt: () => sample ? { isSample: true, id: "old-sample" } : null,
    async api(path, data) { calls.push({ path, data }); return app.request(path, data); },
    persist() {}, render() { feature?.afterRender(); }, toast() {}, openModal() {}, closeModal() {}, navigate(path) { route = { page: path.split("/")[0], id: path.split("/")[1] }; },
  };
  feature = createIOSPositionsFeature(ctx);
  t.after(() => { feature.destroy(); globalThis.document = previous.document; globalThis.window = previous.window; });
  return { ctx, state, feature, calls, mounted, listeners, host,
    setRoute: (value) => { route = value; }, setVersion: (value) => { currentVersion = value; },
    async click(action) {
      const query = { target: { closest: () => ({ dataset: { positionAction: action }, disabled: false }) }, preventDefault() {} };
      const before = calls.length;
      listeners.get("click")(query);
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (calls.length > before && mounted.at(-1)?.loadState.kind === "ready") break;
      }
    },
  };
}

test("iOS rank mounts only real API rows/self/count into the original beUI contract and uses current paper type IDs", async (t) => {
  const app = await createFixture(t);
  await app.receipt();
  await app.request("positions/participation", { guestId, name: "真实甲", attemptIds: ["attempt-ios-positions-111"] });
  const client = context(app, t);
  await client.feature.onRoute();
  const props = client.mounted.at(-1);
  assert.equal(props.participants, 1);
  assert.equal(props.myRank, 1);
  assert.equal(props.myScore, 2);
  assert.equal(props.people[0].name, "真实甲");
  assert.equal(props.people[0].score, 2);
  assert.equal(props.context.publisher, "花生");
  assert.deepEqual(props.dimensions.map((d) => d.value), ["total", ...app.version.questions.map((q) => q.typeId)]);
  assert.equal(props.dimensions[1].label, "自定义判断");
  props.onDimensionChange(app.version.questions[1].typeId);
  for (let i = 0; i < 30 && (client.mounted.at(-1)?.loadState.kind !== "ready" || client.mounted.at(-1)?.scoreUnit !== "%"); i++) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(client.mounted.at(-1).scoreUnit, "%");
  assert.equal(client.mounted.at(-1).people[0]?.score, 100);
  assert.deepEqual(client.feature.standing(), { rank: 1, count: 1 });
  assert.ok(client.feature.rankView().includes("data-ios-positions-rank"));
  assert.equal(client.feature.rankView().includes("positions-board"), false);
  assert.equal(JSON.stringify(props).includes("4582"), false);
});

test("nationwide and selected scopes stay separate; standing remains the personal job total and does not use the viewed scope", async (t) => {
  const app = await createFixture(t);
  for (const [id, aid, position, name] of [[guestId, "attempt-ios-positions-111", app.positions[0], "甲"], [otherGuest, "attempt-ios-positions-222", app.positions[1], "乙"]]) {
    await app.receipt(id, aid);
    await app.request("positions/selection", { guestId: id, positionId: position.id });
    await app.request("positions/participation", { guestId: id, name, attemptIds: [aid] });
  }
  const client = context(app, t);
  await client.feature.onRoute();
  assert.equal(client.mounted.at(-1).participants, 1);
  await client.click("scope-nationwide");
  assert.equal(client.mounted.at(-1).participants, 2);
  assert.equal((await app.request(`positions/profile?guestId=${guestId}`)).positionId, app.positions[0].id);
  client.setRoute({ page: "report", id: "attempt-ios-positions-111" });
  await client.feature.onRoute();
  assert.deepEqual(client.feature.standing(), { rank: 1, count: 1 });
  const query = new URL(client.calls.at(-1).path, "http://localhost").searchParams;
  assert.equal(query.get("dimension"), "total");
  assert.equal(query.get("scope"), "selected");
});

test("empty and nonparticipating users have null ranks, and report/share routes fetch actual standing", async (t) => {
  const app = await createFixture(t);
  const client = context(app, t, { page: "report" });
  await client.feature.onRoute();
  assert.deepEqual(client.feature.standing(), { rank: null, count: 0 });
  await app.receipt(otherGuest, "attempt-ios-positions-222");
  await app.request("positions/participation", { guestId: otherGuest, name: "乙", attemptIds: ["attempt-ios-positions-222"] });
  client.setRoute({ page: "share", id: "real-receipt" });
  await client.feature.onRoute();
  assert.deepEqual(client.feature.standing(), { rank: null, count: 1 });
  client.setRoute({ page: "rank", id: app.version.id });
  await client.feature.onRoute();
  assert.equal(client.mounted.at(-1).myRank, null);
  assert.equal(client.mounted.at(-1).myScore, null);
  assert.equal(client.mounted.at(-1).participants, 1);
});

test("old samples never get a real standing, and stale requests cannot put a previous version's rank into a report", async (t) => {
  const app = await createFixture(t);
  const sample = context(app, t, { page: "report", sample: true });
  await sample.feature.onRoute();
  assert.deepEqual(sample.feature.standing(), { rank: null, count: 0 });
  assert.equal(sample.calls.some((c) => c.path.startsWith("positions/leaderboard")), false);
  sample.feature.destroy();
  const client = context(app, t, { page: "report" });
  let release;
  client.ctx.api = () => new Promise((resolve) => { release = resolve; });
  const pending = client.feature.onRoute();
  await new Promise((resolve) => setImmediate(resolve));
  client.setVersion({ ...app.version, id: "different:v1" });
  release({ count: 9, self: { rank: 2 } });
  await pending;
  assert.deepEqual(client.feature.standing(), { rank: null, count: 0 });
});

test("failed standing requests return unavailable values and withdrawal preserves private receipts", async (t) => {
  const app = await createFixture(t);
  await app.receipt();
  await app.request("positions/participation", { guestId, name: "甲", attemptIds: ["attempt-ios-positions-111"] });
  const client = context(app, t, { page: "report" });
  await client.feature.onRoute();
  assert.equal(client.feature.standing().rank, 1);
  const api = client.ctx.api;
  client.ctx.api = async () => { throw new Error("offline"); };
  await client.feature.onRoute();
  assert.deepEqual(client.feature.standing(), { rank: null, count: 0 });
  client.ctx.api = api;
  await client.feature.withdraw();
  assert.deepEqual(client.feature.standing(), { rank: null, count: 0 });
  assert.equal((await app.request("attempts/sync", { guestId })).attempts.length, 1);
});

test("the shared positions snapshot is a detached copy and keeps the old entry hooks compatible", async (t) => {
  const app = await createFixture(t);
  const client = context(app, t, { page: "me" });
  const core = createPositionsFeature(client.ctx);
  t.after(() => core.destroy());
  await core.onRoute();
  const snapshot = core.snapshot();
  snapshot.profile.positionId = "changed-outside";
  snapshot.catalog.sources[0].year = 2099;
  assert.equal(core.snapshot().profile.positionId, null);
  assert.equal(core.snapshot().catalog.sources[0].year, 2027);
  for (const hook of ["afterRender", "onRoute", "beforeSubmit", "afterSubmit", "rankView"]) assert.equal(typeof core[hook], "function");
});
