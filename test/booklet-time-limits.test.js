import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createApi } from "../server/api.mjs";
import { PAPERS } from "../src/data/papers.js";
import { IMPORTED_PAPERS } from "../src/data/imported-papers.js";

const evidence = JSON.parse(await readFile(new URL("../data/booklet-time-limits.json", import.meta.url), "utf8"));

test("all 62 published booklet limits retain their verified source evidence", () => {
  const papers = [...PAPERS, ...IMPORTED_PAPERS];
  assert.equal(papers.length, 62);
  assert.equal(evidence.entries.length, papers.length);
  for (const paper of papers) {
    const source = evidence.entries.find(entry => entry.paperId === paper.id);
    assert.ok(source, paper.id);
    assert.equal(paper.timeLimitMinutes, source.minutes);
    assert.equal(paper.timeLimitMinutes, 120);
    assert.equal(paper.timeLimitKind, "publisher");
    assert.deepEqual(paper.timeLimitSource, { file: source.file, sha256: source.sha256, pdfPage: source.pdfPage });
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok([2, 3].includes(source.pdfPage));
  }
});

async function catalogServer(directory) {
  const api = await createApi({ dataDirectory: pathToFileURL(directory + "/") });
  const server = createServer((request, response) => api(request, response, new URL(request.url, "http://localhost").pathname));
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  return { read: async () => (await fetch(`http://127.0.0.1:${server.address().port}/api/catalog`)).json(), close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}

test("catalog exposes real paper limits and keeps explicit settings and corrected answers on restart", async t => {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-booklet-limits-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let service = await catalogServer(directory);
  try {
    const catalog = await service.read();
    assert.equal(catalog.versions.length, 62);
    for (const version of catalog.versions) {
      assert.equal(version.timeLimitMinutes, 120);
      assert.equal(version.timeLimitKind, "publisher");
      assert.ok(!JSON.stringify(version.questions).includes("correctAnswer"));
    }
  } finally { await service.close(); }
  const file = join(directory, "catalog.json"), saved = JSON.parse(await readFile(file, "utf8"));
  const prior = saved.versions[0];
  prior.timeLimitMinutes = 90;
  prior.status = "offline";
  prior.questions[0].correctAnswer = "D";
  await writeFile(file, JSON.stringify(saved));
  service = await catalogServer(directory);
  try {
    const version = (await service.read()).versions.find(item => item.id === prior.id);
    assert.equal(version.timeLimitMinutes, 90);
    assert.equal(version.status, "offline");
    const current = JSON.parse(await readFile(file, "utf8"));
    assert.equal(current.versions.find(item => item.id === prior.id).questions[0].correctAnswer, "D");
  } finally { await service.close(); }
});
