import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createPositionsService, positionId, validatePositionsDataset, includeSubmittedAttempt, initializeDefaultParticipation } from "../server/positions.mjs";
import { gradeVersion } from "../src/model.js";

const firstGuest = "guest-first-12345", secondGuest = "guest-second-12345", thirdGuest = "guest-third-12345";
const version = { id: "test-paper:v1", status: "published", questions: [
  { number: 1, typeId: "logic", type: "判断", correctAnswer: "A", cents: 100 },
  { number: 2, typeId: "logic", type: "判断", correctAnswer: "B", cents: 100 },
  { number: 3, typeId: "data", type: "资料", correctAnswer: "C", cents: 100 },
  { number: 4, typeId: "data", type: "资料", correctAnswer: "D", cents: 100 },
] };
const revised = { ...version, id: "test-paper:v2" };

function dataset({ year = 2027, region = "全国", exam = "guokao", count = 3, id = `${exam}-${year}-${region}` } = {}) {
  const source = { id: id.replace("全国", "national").replace("广东", "gd"), label: "测试目录", year, region, exam,
    publisher: "测试来源", sourcePage: "https://example.gov.cn/source", downloadUrl: "https://example.gov.cn/jobs.xlsx",
    retrievedAt: "2026-11-14", fileName: "test.xlsx", sha256: "a".repeat(64), count };
  const positions = Array.from({ length: count }, (_, i) => {
    const p = { year, region, exam, code: String(i + 1).padStart(6, "0"), departmentCode: "0001", department: "测试部门",
      unit: "测试单位", title: `岗位 ${i + 1}`, location: i ? "广州" : "北京", education: "本科", major: "不限", recruits: 1,
      sourceId: source.id, sourceSheet: "岗位表", sourceRow: i + 2 };
    return { ...p, id: positionId(p) };
  });
  return { schemaVersion: 1, source, positions };
}

async function fileStore(directory) {
  let store;
  try { store = JSON.parse(await readFile(join(directory, "catalog.json"), "utf8")); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    store = { versions: [version, revised], receipts: {}, audit: [], features: { discussions: { sentinel: true } } };
  }
  let queue = Promise.resolve();
  return { readCatalog: () => store, mutateCatalog(callback) {
    const operation = queue.catch(() => {}).then(async () => {
      const before = structuredClone(store);
      try {
        const result = callback(store);
        await writeFile(join(directory, "catalog.tmp"), JSON.stringify(store));
        await rename(join(directory, "catalog.tmp"), join(directory, "catalog.json"));
        return result;
      } catch (error) { store = before; throw error; }
    });
    queue = operation;
    return operation;
  } };
}

async function fixture(t, { datasets = [dataset()], pythonExecutable } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-positions-test-"));
  let persistence = await fileStore(directory);
  let service = await createPositionsService({ ...persistence, datasets, dataDirectory: pathToFileURL(directory + "/"), pythonExecutable });
  const server = createServer(async (request, response) => {
    const parsed = new URL(request.url, "http://localhost");
    const send = (status, body) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(body));
    };
    try {
      let body = "";
      for await (const chunk of request) body += chunk;
      const handled = await service({ request, response, pathname: parsed.pathname, method: request.method,
        input: body ? JSON.parse(body) : {}, query: parsed.searchParams, send });
      if (!handled) send(404, { error: "not found" });
    } catch (error) { send(error.statusCode || 400, { error: error.message }); }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}/api/positions/`;
  return {
    directory,
    get store() { return persistence.readCatalog(); },
    mutate: (callback) => persistence.mutateCatalog(callback),
    async restart() {
      persistence = await fileStore(directory);
      service = await createPositionsService({ ...persistence, datasets, dataDirectory: pathToFileURL(directory + "/"), pythonExecutable });
    },
    async request(path, input) {
      const response = await fetch(base + path, input ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) } : {});
      return { status: response.status, data: await response.json() };
    },
    async receipt(id, aid, answers, { paper = version, time = 1000, isSample = false } = {}) {
      return persistence.mutateCatalog((store) => {
        const result = { id: aid, versionId: paper.id, createdAt: time, isSample, answers, report: gradeVersion(paper, answers) };
        store.receipts[`${id}:${aid}`] = result;
        includeSubmittedAttempt(store, { guestId: id, attempt: result });
        return result;
      });
    },
  };
}

const boardPath = (extra = {}) => "leaderboard?" + new URLSearchParams({ versionId: version.id, guestId: firstGuest, ...extra });

test("bundled official catalog has 19426 positions, provenance, zero-prefixed department codes and bounded search", async (t) => {
  const app = await fixture(t, { datasets: undefined });
  const service = await createPositionsService({ readCatalog: () => app.store, mutateCatalog: app.mutate });
  let response;
  await service({ pathname: "/api/positions/catalog", method: "GET", query: new URLSearchParams("q=002000&pageSize=2"), send: (status, data) => { response = { status, data }; } });
  assert.equal(response.status, 200);
  assert.equal(response.data.items.length, 2);
  assert.equal(response.data.items[0].departmentCode, "002000");
  assert.equal(response.data.sources[0].year, 2027);
  assert.equal(response.data.sources[0].count, 19426);
  assert.equal(response.data.sources[0].origin, "bundled-official");
  assert.match(response.data.sources[0].downloadUrl, /xinhuanet.com.*\.zip$/);
  assert.equal(response.data.sources[0].retrievedAt, "2026-11-14");
  const raw = JSON.parse(await readFile(new URL("../data/positions/guokao-2027.json", import.meta.url), "utf8"));
  assert.equal(new Set(raw.positions.map((p) => p.id)).size, 19426);
  assert.equal(raw.positions.reduce((sum, p) => sum + p.recruits, 0), 35691);
});

test("selection persists across restart; browsing another job never changes selection", async (t) => {
  const data = dataset();
  const app = await fixture(t, { datasets: [data] });
  assert.equal((await app.request(`profile?guestId=${firstGuest}`)).data.positionId, null);
  const selected = await app.request("selection", { guestId: firstGuest, positionId: data.positions[0].id });
  assert.equal(selected.data.position.code, "000001");
  await app.restart();
  const other = await app.request(boardPath({ scope: "position", positionId: data.positions[1].id }));
  assert.equal(other.data.position.id, data.positions[1].id);
  assert.equal((await app.request(`profile?guestId=${firstGuest}`)).data.positionId, data.positions[0].id);
  assert.equal((await app.request(boardPath())).data.position.id, data.positions[0].id);
  assert.equal((await app.request("selection", { guestId: firstGuest, positionId: "missing" })).status, 404);
  assert.equal((await app.request(`profile?guestId=${firstGuest}`)).data.positionId, data.positions[0].id);
  assert.deepEqual(app.store.features.discussions, { sentinel: true });
  assert.equal((await app.request("selection", { guestId: firstGuest, positionId: null })).data.positionId, null);
});

test("judgment ranking chooses each person's best complete subject and never splices subtype bests", async t => {
  const app = await fixture(t);
  const paper = { ...version, questions: ["图形推理", "定义判断", "类比推理", "逻辑判断"].map((type, index) => ({
    number: index + 1, type, typeId: `split-${index}`, cents: [100, 300, 50, 150][index], correctAnswer: "A",
  })) };
  await app.mutate(store => { store.versions[0] = paper; });
  await app.receipt(firstGuest, "attempt-judgment-111", ["A", "B", "A", null], { paper, time: 1000 });
  await app.receipt(firstGuest, "attempt-judgment-222", ["B", "A", "B", null], { paper, time: 2000 });
  await app.receipt(secondGuest, "attempt-judgment-333", ["A", "B", "B", "A"], { paper, time: 3000 });
  await app.request("participation", { guestId: firstGuest, name: "甲", attemptIds: ["attempt-judgment-111", "attempt-judgment-222"] });
  await app.request("participation", { guestId: secondGuest, name: "乙", attemptIds: ["attempt-judgment-333"] });
  const result = await app.request(boardPath({ dimension: "judgment", scope: "nationwide" }));
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.rows.map(row => [row.name, row.value, row.maxCents, row.rank]), [["甲", 300, 600, 1], ["乙", 250, 600, 2]]);
  assert.equal(result.data.self.rate, .5);
  assert.equal((await app.request(boardPath({ dimension: "split-0" }))).data.dimension, "judgment");
  assert.equal(app.store.receipts[`${firstGuest}:attempt-judgment-111`].report.breakdown.length, 4);
});

test("formal receipts automatically rank nationwide; personal best differs by dimension; ties skip ranks and zero is valid", async (t) => {
  const app = await fixture(t);
  await app.receipt(firstGuest, "attempt-first-111", ["A", "B", null, null], { time: 2000 });
  await app.receipt(firstGuest, "attempt-first-222", ["A", null, "C", "D"], { time: 3000 });
  await app.receipt(secondGuest, "attempt-second-1", ["A", "B", "C", null], { time: 1000 });
  await app.receipt(thirdGuest, "attempt-third-11", [null, null, null, null], { time: 4000 });
  const unselected = await app.request(boardPath());
  assert.equal(unselected.data.count, 3);
  assert.equal(unselected.data.selectionMissing, true);
  for (const [guestId, name, attemptIds] of [
    [firstGuest, "甲", ["attempt-first-111", "attempt-first-222"]],
    [secondGuest, "乙", ["attempt-second-1"]], [thirdGuest, "零分", ["attempt-third-11"]],
  ]) assert.equal((await app.request("participation", { guestId, name, attemptIds, totalCents: 999999 })).status, 200);
  const total = (await app.request(boardPath({ scope: "nationwide" }))).data;
  assert.equal(total.count, 3);
  assert.deepEqual(total.rows.map((r) => [r.name, r.value, r.rank]), [["乙", 300, 1], ["甲", 300, 1], ["零分", 0, 3]]);
  assert.equal(total.self.value, 300);
  const logic = (await app.request(boardPath({ dimension: "logic" }))).data;
  assert.equal(logic.self.value, 200);
  assert.equal(logic.self.rank, 1);
  assert.deepEqual(logic.rows.map((r) => r.rank), [1, 1, 3]);
  const data = (await app.request(boardPath({ dimension: "data" }))).data;
  assert.equal(data.self.value, 200);
  assert.equal(data.rows.at(-1).value, 0);
  const publicJson = JSON.stringify(total);
  for (const secret of [firstGuest, "answers", "correctAnswer", "attempt-first", "report"])
    assert.equal(publicJson.includes(secret), false);
});

test("job scopes, revisions, withdrawal, restart, receipt deletion and regrading use current server state", async (t) => {
  const data = dataset();
  const app = await fixture(t, { datasets: [data] });
  for (const [id, aid] of [[firstGuest, "attempt-first-111"], [secondGuest, "attempt-second-1"]]) {
    await app.receipt(id, aid, ["A", "B", "C", "D"]);
    await app.request("selection", { guestId: id, positionId: data.positions[id === firstGuest ? 0 : 1].id });
    await app.request("participation", { guestId: id, name: id === firstGuest ? "甲" : "乙", attemptIds: [aid] });
  }
  await app.receipt(firstGuest, "attempt-revision1", ["A", "B", "C", "D"], { paper: revised });
  await app.request("participation", { guestId: firstGuest, name: "甲", versionId: revised.id, attemptIds: ["attempt-revision1"] });
  assert.equal((await app.request(boardPath())).data.count, 1);
  assert.equal((await app.request(boardPath({ scope: "nationwide" }))).data.count, 2);
  assert.equal((await app.request(boardPath({ versionId: revised.id }))).data.count, 1);
  await app.restart();
  assert.equal((await app.request(boardPath())).data.count, 1);
  await app.mutate((store) => { store.receipts[`${firstGuest}:attempt-first-111`].report = gradeVersion(version, [null, null, null, null]); });
  assert.equal((await app.request(boardPath())).data.self.value, 0);
  await app.request("selection", { guestId: firstGuest, positionId: data.positions[1].id });
  assert.equal((await app.request(boardPath())).data.count, 2);
  await app.request("participation", { guestId: firstGuest, name: "甲", versionId: revised.id, attemptIds: [] });
  assert.equal((await app.request(boardPath())).data.count, 2);
  assert.equal((await app.request(boardPath({ versionId: revised.id }))).data.count, 0);
  await app.request("withdraw", { guestId: firstGuest });
  await app.restart();
  assert.equal((await app.request(boardPath({ scope: "nationwide" }))).data.count, 1);
  assert.ok(app.store.receipts[`${firstGuest}:attempt-first-111`]);
  await app.mutate((store) => { delete store.receipts[`${secondGuest}:attempt-second-1`]; });
  assert.equal((await app.request(boardPath())).data.count, 0);
});

test("foreign, sample, missing, duplicate and mismatched-version submissions are rejected atomically", async (t) => {
  const app = await fixture(t);
  await app.receipt(firstGuest, "attempt-first-111", ["A", null, null, null]);
  await app.receipt(secondGuest, "attempt-second-1", ["A", "B", "C", "D"]);
  await app.receipt(firstGuest, "attempt-sample11", ["A", "B", "C", "D"], { isSample: true });
  const input = { guestId: firstGuest, name: "甲", attemptIds: ["attempt-first-111"] };
  assert.equal((await app.request("participation", input)).status, 200);
  for (const attemptIds of [["attempt-second-1"], ["attempt-sample11"], ["attempt-missing1"], ["attempt-first-111", "attempt-first-111"]])
    assert.notEqual((await app.request("participation", { ...input, attemptIds })).status, 200);
  assert.equal((await app.request("participation", { ...input, versionId: revised.id })).status, 403);
  assert.deepEqual((await app.request(`profile?guestId=${firstGuest}`)).data.participation.attemptIds, input.attemptIds);
  assert.equal((await app.request("selection", { guestId: "bad", positionId: null })).status, 400);
  assert.equal((await app.request(boardPath({ dimension: "missing" }))).status, 400);
  assert.equal((await app.request(boardPath({ versionId: "missing" }))).status, 404);
});

test("directory import separates years and regions, validates string codes and duplicate IDs, survives restart", async (t) => {
  const initial = dataset({ count: 27 });
  const app = await fixture(t, { datasets: [initial] });
  const nextYear = dataset({ year: 2028 });
  assert.equal((await app.request("import", { dataset: nextYear })).data.imported, 3);
  const province = dataset({ exam: "shengkao", region: "广东" });
  assert.equal((await app.request("import", { dataset: province })).status, 200);
  await app.restart();
  const years = (await app.request("catalog")).data;
  assert.deepEqual(years.facets.years, [2028, 2027]);
  assert.equal(years.total, 33);
  assert.equal(years.items.length, 20);
  assert.equal((await app.request("catalog?page=2")).data.items.length, 13);
  assert.equal((await app.request("catalog?q=北京&year=2028")).data.total, 1);
  assert.equal((await app.request("catalog?exam=shengkao&region=广东")).data.total, 3);
  assert.equal((await app.request("catalog?page=999")).data.page, 2);
  assert.equal((await app.request("catalog?pageSize=0")).status, 400);
  assert.equal((await app.request("import", { dataset: nextYear })).status, 409);
  const overlapping = structuredClone(nextYear);
  overlapping.source.id = "other-source";
  for (const p of overlapping.positions) p.sourceId = "other-source";
  assert.equal((await app.request("import", { dataset: overlapping })).status, 409);
  const invalid = structuredClone(dataset({ year: 2029 }));
  invalid.positions[0].code = 1;
  assert.equal((await app.request("import", { dataset: invalid })).status, 400);
  const duplicate = structuredClone(dataset({ year: 2029 }));
  duplicate.positions[1] = { ...duplicate.positions[0], sourceRow: 5 };
  assert.match((await app.request("import", { dataset: duplicate })).data.error, /重复岗位编码/);
  assert.equal((await app.request("catalog")).data.total, 33);
  const importedSource = (await app.request("catalog?year=2028")).data.sources.find((s) => s.year === 2028);
  assert.equal(importedSource.origin, "user-import");
  assert.equal((await app.request("catalog?q=不存在")).data.total, 0);
});

test("chunk upload is ordered and retry-safe, publishes only complete validated files, and cancellation leaves no directory", async (t) => {
  const app = await fixture(t, { datasets: [] });
  const content = Buffer.from(JSON.stringify(dataset()));
  const start = (await app.request("import/start", { guestId: firstGuest, fileName: "positions.json", size: content.length })).data;
  const chunk = { guestId: firstGuest, uploadId: start.uploadId, index: 0, chunk: content.subarray(0, 100).toString("base64") };
  assert.equal((await app.request("import/chunk", { ...chunk, guestId: secondGuest })).status, 410);
  assert.equal((await app.request("import/chunk", { ...chunk, index: 1 })).status, 409);
  assert.equal((await app.request("import/chunk", chunk)).data.bytes, 100);
  assert.equal((await app.request("import/chunk", chunk)).data.bytes, 100);
  assert.equal((await app.request("import/chunk", { ...chunk, chunk: Buffer.from("different").toString("base64") })).status, 409);
  assert.equal((await app.request("import/finish", { guestId: firstGuest, uploadId: start.uploadId })).status, 409);
  assert.equal((await app.request("catalog")).data.total, 0);
  await app.request("import/chunk", { ...chunk, index: 1, chunk: content.subarray(100).toString("base64") });
  assert.equal((await app.request("import/finish", { guestId: firstGuest, uploadId: start.uploadId })).data.imported, 3);
  await app.restart();
  assert.equal((await app.request("catalog")).data.total, 3);
  const cancel = (await app.request("import/start", { guestId: firstGuest, fileName: "cancel.json", size: 10 })).data;
  assert.equal((await app.request("import/cancel", { guestId: firstGuest, uploadId: cancel.uploadId })).status, 200);
  assert.equal((await app.request("import/chunk", { ...chunk, uploadId: cancel.uploadId })).status, 410);
  assert.equal((await app.request("import/start", { guestId: firstGuest, fileName: "large.xls", size: 21 * 1024 * 1024 })).status, 400);
});

test("empty catalog and malformed source inputs return recoverable states", async (t) => {
  const app = await fixture(t, { datasets: [] });
  const empty = (await app.request("catalog")).data;
  assert.deepEqual(empty.items, []);
  assert.equal(empty.pages, 1);
  assert.equal((await app.request(boardPath())).data.count, 0);
  assert.equal((await app.request("import", { dataset: { schemaVersion: 1, positions: [] } })).status, 400);
  const bad = dataset();
  bad.source.sourcePage = "javascript:alert(1)";
  assert.throws(() => validatePositionsDataset(bad), /地址无效/);
  const reserved = dataset();
  reserved.source.id = "__proto__";
  assert.throws(() => validatePositionsDataset(reserved), /来源 ID 无效/);
});

test("a real failed disk write rolls back selection and public participation, then accepts retry", async (t) => {
  const data = dataset();
  const app = await fixture(t, { datasets: [data] });
  await app.receipt(firstGuest, "attempt-first-111", ["A", "B", null, null]);
  await app.request("selection", { guestId: firstGuest, positionId: data.positions[0].id });
  await mkdir(join(app.directory, "catalog.tmp"));
  assert.notEqual((await app.request("selection", { guestId: firstGuest, positionId: data.positions[1].id })).status, 200);
  assert.equal((await app.request(`profile?guestId=${firstGuest}`)).data.positionId, data.positions[0].id);
  assert.notEqual((await app.request("participation", { guestId: firstGuest, name: "甲", attemptIds: ["attempt-first-111"] })).status, 200);
  assert.equal((await app.request(boardPath())).data.count, 1);
  await rm(join(app.directory, "catalog.tmp"), { recursive: true });
  assert.equal((await app.request("participation", { guestId: firstGuest, name: "甲", attemptIds: ["attempt-first-111"] })).status, 200);
  await app.restart();
  assert.equal((await app.request(boardPath())).data.count, 1);
  assert.equal((await app.request(`profile?guestId=${firstGuest}`)).data.positionId, data.positions[0].id);
});


test("one-time default migration includes real receipts, preserves opt-out and ignores design samples", () => {
  const receipt = (id, extra = {}) => ({ id, versionId: version.id, createdAt: 1, answers: ["A", null, null, null], report: gradeVersion(version, ["A", null, null, null]), ...extra });
  const selectedOnly = "migration-selected-01", optedOut = "migration-withdraw-02", fresh = "migration-default-03";
  const first = receipt("migration-attempt-001"), second = receipt("migration-attempt-002"), third = receipt("migration-attempt-003");
  const store = { versions: [version], receipts: { [`${selectedOnly}:${first.id}`]: first, [`${optedOut}:${second.id}`]: second,
    [`${fresh}:${third.id}`]: third, [`${fresh}:migration-sample-000`]: receipt("migration-sample-000", { isSample: true }) },
    features: { positions: { members: { [selectedOnly]: { positionId: "existing-job" }, [optedOut]: { name: "原昵称", attemptIds: [] } }, catalogs: {} } } };
  assert.equal(initializeDefaultParticipation(store), true);
  assert.deepEqual(store.features.positions.members[selectedOnly].attemptIds, [first.id]);
  assert.equal(store.features.positions.members[selectedOnly].positionId, "existing-job");
  assert.deepEqual(store.features.positions.members[fresh].attemptIds, [third.id]);
  assert.match(store.features.positions.members[fresh].name, /^卷友\d{4}$/);
  assert.deepEqual(store.features.positions.members[optedOut].attemptIds, []);
  assert.equal(store.features.positions.members[optedOut].participationOptOut, true);
  assert.equal(initializeDefaultParticipation(store), false);
  assert.equal(includeSubmittedAttempt(store, { guestId: optedOut, attempt: receipt("migration-retry-0001") }), false);
  assert.equal(includeSubmittedAttempt(store, { guestId: fresh, attempt: third }), false);
  assert.equal(includeSubmittedAttempt(store, { guestId: fresh, attempt: receipt("migration-later-0001"), name: "当前昵称" }), true);
  assert.equal(store.features.positions.members[fresh].name, "当前昵称");
});
