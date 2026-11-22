import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createApi } from "../server/api.mjs";
import { gradeVersion } from "../src/model.js";
import { initialState, loadState, recordAttempt, saveState, syncAttemptSnapshots, STATE_KEY } from "../src/prototype-state.js";

async function fixture(t, featureFactories = []) {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-features-"));
  const dataDirectory = pathToFileURL(directory + "/");
  const servers = [];
  const start = async () => {
    const api = await createApi({ dataDirectory, featureFactories });
    const server = createServer((req, res) => api(req, res, new URL(req.url, "http://localhost").pathname));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    servers.push(server);
    return async (path, input) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`,
        input === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      return { status: response.status, body: await response.json() };
    };
  };
  t.after(async () => {
    for (const server of servers) { server.closeAllConnections(); server.close(); }
    await rm(directory, { recursive: true, force: true });
  });
  return { directory, start, request: await start() };
}

test("feature transactions persist together, roll back together and retain HTTP errors", async (t) => {
  const factory = ({ readCatalog, mutateCatalog }) => async ({ pathname, method, input, query, send }) => {
    if (pathname !== "/api/runtime-test") return false;
    if (method === "GET") send(200, { value: readCatalog().features.runtimeTest ?? null, query: query.get("query") });
    else {
      if (input.forbidden) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
      await mutateCatalog((store) => {
        store.features.runtimeTest = input.value;
        store.audit.unshift({ action: input.value });
      });
      send(200, { saved: true });
    }
    return true;
  };
  const { directory, start, request } = await fixture(t, [factory]);
  assert.equal((await request("runtime-test", { value: "已保存的反馈" })).status, 200);
  const restarted = await start();
  assert.deepEqual((await restarted("runtime-test?query=文字")).body, { value: "已保存的反馈", query: "文字" });
  assert.equal((await request("runtime-test", { forbidden: true })).status, 403);
  await mkdir(join(directory, "catalog.tmp"));
  assert.equal((await request("runtime-test", { value: "不应保留的修改" })).status, 400);
  assert.equal((await request("runtime-test")).body.value, "已保存的反馈");
  assert.equal((await request("admin")).body.audit.some((row) => row.action === "不应保留的修改"), false);
  await rm(join(directory, "catalog.tmp"), { recursive: true });
  assert.equal((await request("runtime-test", { value: "重试成功" })).status, 200);
});

test("receipt sync isolates guests and refreshes a corrected snapshot without losing local choices", async (t) => {
  const factory = ({ mutateCatalog }) => async ({ pathname, send }) => {
    if (pathname !== "/api/runtime-correct") return false;
    await mutateCatalog(({ versions, receipts }) => {
      const receipt = Object.values(receipts)[0];
      const version = versions.find((item) => item.id === receipt.versionId);
      version.questions[0].correctAnswer = receipt.answers[0];
      receipt.report = gradeVersion(version, receipt.answers);
      receipt.answerRevision = 1;
    });
    send(200, { saved: true });
    return true;
  };
  const { request } = await fixture(t, [factory]);
  const version = (await request("catalog")).body.versions[0];
  const local = initialState();
  local.profile = { id: local.guestId, name: "认真练习" };
  const receipt = (await request("submit", { guestId: local.guestId, versionId: version.id,
    attemptId: "feature-attempt-001", answers: version.questions.map(() => "A") })).body;
  recordAttempt(local, receipt, { participate: true });
  await request("runtime-correct", {});
  assert.equal((await request("attempts/sync", { guestId: "another-guest-001" })).body.attempts.length, 0);
  assert.equal((await request("attempts/sync", { guestId: "bad" })).status, 400);
  const synced = (await request("attempts/sync", { guestId: local.guestId, attemptIds: [receipt.id] })).body;
  assert.equal(syncAttemptSnapshots(local, synced.attempts), true);
  assert.equal(local.attempts[0].answerRevision, 1);
  assert.equal(local.attempts[0].report.rows[0].status, "correct");
  assert.equal(local.attempts[0].ownerId, local.guestId);
  assert.equal(local.attempts[0].participate, true);
  assert.equal(local.attempts[0].createdAt, receipt.createdAt);
  const store = new Map();
  const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  saveState(storage, local);
  assert.ok(store.has(STATE_KEY));
  const restored = loadState(storage, [version]);
  assert.equal(restored.warning, false);
  assert.equal(restored.state.attempts[0].answerRevision, 1);
  assert.equal(restored.state.attempts[0].report.totalCents, local.attempts[0].report.totalCents);
});
