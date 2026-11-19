import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { once } from "node:events";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { createApi } from "../server/api.mjs";
import { createIOSServiceClient } from "../docs/ui-exploration/ios-v3/service-client.js";
import { migrateWechatDrafts } from "../docs/ui-exploration/ios-v3/wechat-webview.js";

test("the real Mini Program bridge reuses the saved guest and accepts each session ticket once", async t => {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-wechat-"));
  const api = await createApi({ dataDirectory: pathToFileURL(directory + "/") });
  const server = createServer((req, res) => api(req, res, new URL(req.url, "http://localhost").pathname));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const base = "http://127.0.0.1:" + server.address().port;
  const post = (path, body) => fetch(base + "/api/" + path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const guestId = "rollie-local-wechat-guest";
  const catalogResponse = await fetch(base + "/api/catalog");
  assert.equal(catalogResponse.headers.get("cache-control"), "no-store");
  const version = (await catalogResponse.json()).versions[0];
  const { id: attemptId } = await (await post("submit", {
    guestId, attemptId: "rollie-test-attempt", versionId: version.id, answers: version.questions.map(() => "A"),
  })).json();
  const draft = {
    id: "rollie-test-draft", versionId: version.id, answers: version.questions.map((_, index) => index ? null : "B"),
    marks: [1], current: 2, single: true, updatedAt: 100,
  };
  const bootstrap = await post("miniprogram-web/bootstrap", { guestId, name: "卷友", drafts: [draft], marks: [[attemptId, [3]]] });
  assert.equal(bootstrap.status, 200);
  const ticketResponse = await bootstrap.json();
  assert.match(ticketResponse.ticket, /^[0-9a-f]{48}$/);
  assert.equal(JSON.stringify(ticketResponse).includes(guestId), false);
  const identity = await post("miniprogram-web/redeem", { ticket: ticketResponse.ticket });
  assert.equal(identity.headers.get("cache-control"), "no-store");
  const migration = await identity.json();
  assert.equal(migration.guestId, guestId);
  assert.equal((await post("miniprogram-web/redeem", ticketResponse)).status, 410);

  const ui = { history: [], reviewMarks: {} };
  const client = createIOSServiceClient({
    storage: { getItem: () => null, setItem() {} },
    storageName: "wechat-test",
    getUIState: () => ui,
    persistUI() {},
    launchIdentity: migration,
    fetchImpl: (path, options) => fetch(base + path, options),
  });
  assert.equal(await client.initialize(), true);
  assert.equal(client.state().attempts[0].id, attemptId);
  const restore = () => migrateWechatDrafts({
    ui,
    catalog: client.catalog(),
    attempts: client.state().attempts,
    migration,
    scopeForVersion: value => ({ institution: value.institution, paper: value.number, period: 1, versionId: value.id }),
  });
  restore();
  const saved = ui.history.find(record => record.id === draft.id);
  assert.equal(saved.current, 2);
  assert.equal(saved.entryMode, "single");
  assert.equal(saved.answers[0], "B");
  assert.deepEqual(ui.reviewMarks[attemptId], [3]);
  saved.answers[0] = "D";
  saved.updatedAt = 101;
  restore();
  assert.equal(ui.history.find(record => record.id === draft.id).answers[0], "D");

  const selectTitle = title => post("miniprogram-web/action", { sender: migration.sender, kind: "title", ...title });
  await selectTitle({ title: "成绩分享", revision: 2 });
  await selectTitle({ title: "练习估分", revision: 1 });
  const nextTitle = await post("miniprogram-web/listen", { receiver: ticketResponse.receiver });
  assert.deepEqual((await nextTitle.json()).action, { kind: "title", title: "成绩分享", revision: 2 });

  const image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+AvX8AAAAASUVORK5CYII=";
  const poster = await post("miniprogram-web/poster", { image });
  assert.equal(poster.status, 200);
  const { ticket } = await poster.json();
  const receive = post("miniprogram-web/listen", { receiver: ticketResponse.receiver });
  const delivered = await post("miniprogram-web/action", { sender: migration.sender, kind: "poster", ticket });
  assert.equal(delivered.status, 200);
  assert.deepEqual((await (await receive).json()).action, { kind: "poster", ticket });
  assert.equal((await post("miniprogram-web/action", { sender: ticketResponse.receiver, kind: "poster", ticket })).status, 410);
  const posterUrl = base + "/api/miniprogram-web/poster?ticket=" + ticket;
  const download = await fetch(posterUrl);
  assert.equal(download.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), Buffer.from(image, "base64"));
  assert.equal((await fetch(posterUrl)).status, 404);
  assert.equal((await post("miniprogram-web/poster", { image: Buffer.from("plain text").toString("base64") })).status, 400);
});
