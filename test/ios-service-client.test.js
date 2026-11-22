import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createApi } from "../server/api.mjs";
import { createIOSServiceClient, versionForScope, scopeForVersion } from "../docs/ui-exploration/ios-v3/service-client.js";

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "ios-client-"));
  const api = await createApi({ dataDirectory: pathToFileURL(directory + "/") });
  const server = createServer((req, res) => api(req, res, new URL(req.url, "http://localhost").pathname));
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); server.close(); await rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { fetchImpl: (url, init) => fetch(base + url, init) };
}
const memory = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) }; };

test("iOS identities resolve every supplied collection without inventing missing preview periods", async t => {
  const { fetchImpl } = await fixture(t);
  const versions = (await (await fetchImpl("/api/catalog")).json()).versions;
  for (const version of versions) assert.equal(versionForScope(versions, scopeForVersion(version)).id, version.id);
  assert.equal(versionForScope(versions, { institution: "四海", period: 1, paper: 1 }).questionCount, 130);
  assert.equal(versionForScope(versions, { institution: "四海", period: 102, paper: 1 }).questionCount, 135);
  assert.equal(versionForScope(versions, { institution: "超格", period: 2, paper: 1 }), undefined);
});

test("the actual iOS store submits to the real scorer, restores identity and keeps legacy records separate", async t => {
  const { fetchImpl } = await fixture(t); const storage = memory();
  const legacy = { id: "legacy-demo", institution: "四海", period: 1, paper: 1, answers: Array(130).fill("B"), complete: true };
  const ui = { ...legacy, activeAttemptId: crypto.randomUUID(), answers: Array(130).fill("A"), history: [legacy] };
  const options = { storage, storageName: "ios-test", getUIState: () => ui, persistUI() {}, fetchImpl };
  const client = createIOSServiceClient(options); assert.equal(await client.initialize(), true);
  const guestId = client.state().guestId;
  assert.equal(client.forRecord(legacy), undefined);
  const first = await client.submit(); const retry = await client.submit(); assert.equal(retry.id, first.id);
  assert.equal(first.report.rows.length, 130); assert.equal(first.isSample, false);
  ui.activeAttemptId = first.id; client.mergeHistory(); assert.equal(ui.history.length, 2);
  assert.equal(ui.history.find(record => record.id === legacy.id), legacy);
  assert.equal(client.scoreForRecord({ id: first.id }).cents, first.report.totalCents);
  const restored = createIOSServiceClient(options); await restored.initialize();
  assert.equal(restored.state().guestId, guestId); assert.equal(restored.currentAttempt().id, first.id);
  assert.equal(restored.state().attempts.length, 1);
});

test("135-question iOS papers use real counts and network failures preserve draft and receipt retry identity", async t => {
  const { fetchImpl } = await fixture(t); const storage = memory();
  const ui = { institution: "四海", period: 102, paper: 1, activeAttemptId: "legacy|province", answers: Array(135).fill("A"), history: [] };
  let offline = false;
  const client = createIOSServiceClient({ storage, storageName: "ios-province", getUIState: () => ui, persistUI() {},
    fetchImpl: (url, init) => { if (offline && url === "/api/submit") throw new Error("offline"); return fetchImpl(url, init); } });
  await client.initialize(); const draft = client.prepareDraft(); offline = true;
  await assert.rejects(client.submit(), /录入内容仍在本机/); assert.equal(ui.answers.length, 135);
  offline = false; const result = await client.submit(); assert.equal(result.id, draft.id);
  assert.equal(result.report.rows.length, 135); assert.equal(client.state().attempts.length, 1);
  ui.answers = Array(130).fill("A"); ui.activeAttemptId = crypto.randomUUID();
  await assert.rejects(client.submit(), /135 题/);
});
