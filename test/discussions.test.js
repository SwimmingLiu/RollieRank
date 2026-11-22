import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { createDiscussionsService } from "../server/discussions.mjs";
import { encodeDiscussionWav, normalizeDiscussionLink } from "../src/features/discussions.js";
import { createDiscussionHost, scope, otherScope, guestScope, revisionScope, commentInput, pngBytes, pngUri, wavUri, pngChunk } from "./discussions-fixtures.mjs";

test("discussion API persists combined content across service restart and isolates paper scope", async (t) => {
  const host = await createDiscussionHost();
  t.after(() => rm(host.directory, { recursive: true, force: true }));
  const before = structuredClone(host.catalog);
  const content = commentInput({ text: '<img src=x onerror="alert(1)">\n资料分析的时间分配', images: [{ dataUri: pngUri({ ancillary: true }), alt: "我的题号标记" }],
    audio: { dataUri: wavUri(), name: "我的解题思路" }, links: ["https://example.com/question?q=1&view=all"] });
  const posted = await host.request(content);
  assert.equal(posted.status, 201);
  assert.equal(posted.body.comment.paperId, scope.paperId);
  assert.equal(posted.body.comment.author.name, content.nickname);
  assert.equal(posted.body.comment.audio.duration, .25);
  assert.equal(posted.body.comment.images[0].width, 2);
  assert.equal(Buffer.from(posted.body.comment.images[0].dataUri.split(",")[1], "base64").includes(Buffer.from("<script>")), false, "ancillary metadata is stripped");
  for (const privateField of ["guestId", "clientId", "bodyHash"]) assert.equal(privateField in posted.body.comment, false);
  assert.deepEqual(host.catalog.receipts, before.receipts);
  assert.deepEqual(host.catalog.audit, before.audit);
  assert.deepEqual(host.catalog.features.positions, before.features.positions);
  assert.deepEqual(host.catalog.features.corrections, before.features.corrections);
  assert.equal((await host.request(null, otherScope)).body.total, 0);
  assert.deepEqual((await host.request(null, guestScope)).body.comments, [posted.body.comment]);
  const snapshot = JSON.parse(await readFile(join(host.directory, "catalog.json"), "utf8"));
  assert.equal(snapshot.features.discussions.comments.length, 1);
  await host.close({ remove: false });
  const restored = await createDiscussionHost({ directory: host.directory });
  t.after(() => restored.close({ remove: false }));
  assert.deepEqual((await restored.request()).body.comments, [posted.body.comment]);
  const revised = await restored.request(commentInput({ ...revisionScope, clientId: "comment-revision-123", text: "同一试卷的新版本" }));
  assert.equal(revised.status, 201);
  assert.equal(revised.body.comment.versionLabel, "2.0");
  assert.equal((await restored.request()).body.total, 2);
});

test("discussion retries are idempotent under concurrency and after response loss", async (t) => {
  const host = await createDiscussionHost(); t.after(() => host.close());
  const [first, second] = await Promise.all([host.request(commentInput()), host.request(commentInput())]);
  assert.deepEqual([first.status, second.status].sort(), [200, 201]);
  assert.equal(first.body.comment.id, second.body.comment.id);
  assert.equal((await host.request()).body.total, 1);
  assert.equal((await host.request(commentInput({ text: "同标识但内容不同" }))).status, 409);
  assert.equal((await host.request(commentInput({ ...otherScope }))).status, 409);
  assert.equal((await host.request()).body.total, 1);
});

test("only a real receipt for the claimed local identity and paper can read or post", async (t) => {
  const host = await createDiscussionHost(); t.after(() => host.close());
  const denied = [
    { ...scope, guestId: guestScope.guestId }, { ...scope, attemptId: otherScope.attemptId },
    { ...scope, paperId: "sample-preview" }, { ...scope, paperId: "__proto__" },
    { ...scope, attemptId: "sample-preview:v1" }, { ...scope, guestId: {} },
  ];
  for (const target of denied) {
    assert.equal((await host.request(commentInput(target))).status, 403);
    assert.equal((await host.request(null, target)).status, 403);
  }
  host.catalog.receipts[`${scope.guestId}:${scope.attemptId}`].isSample = true;
  assert.equal((await host.request(commentInput())).status, 403);
  assert.equal((await host.request()).status, 403);
  assert.equal(host.catalog.features.discussions, undefined);
});

test("failed persistence rolls back comment and permits the same client token to retry", async (t) => {
  const host = await createDiscussionHost(); t.after(() => host.close());
  host.setFailWrite(true);
  assert.equal((await host.request(commentInput())).status, 400);
  assert.equal((await host.request()).body.total, 0);
  host.setFailWrite(false);
  assert.equal((await host.request(commentInput())).status, 201);
  assert.equal((await host.request()).body.total, 1);
});

test("text, nickname, URL and collection limits reject bad input before mutation", async (t) => {
  const host = await createDiscussionHost(); t.after(() => host.close());
  const invalid = [
    { nickname: "" }, { nickname: "考".repeat(17) }, { nickname: "a\nb" }, { nickname: "a\u202eb" },
    { text: "a".repeat(2001) }, { text: {} }, { text: "\u0000" }, { text: "  " }, { clientId: "bad" },
    { links: ["javascript:alert(1)"] }, { links: ["data:text/html,<script>alert(1)</script>"] },
    { links: ["https://user:password@example.com"] }, { links: ["//example.com"] }, { links: ["https://example.com/\njavascript:alert(1)"] },
    { links: ["file:///etc/passwd"] }, { links: ["https://example.com/" + "a".repeat(2048)] },
    { links: ["https://a.example", "https://b.example", "https://c.example", "https://d.example"] },
    { links: {} }, { images: [null] }, { images: [1, 2, 3, 4] }, { audio: [] }, { images: [{ dataUri: pngUri(), alt: "a".repeat(121) }] },
  ];
  for (const input of invalid) {
    const result = await host.request(commentInput(input));
    assert.equal(result.status, 400, JSON.stringify(input).slice(0, 120));
  }
  assert.equal((await host.request()).body.total, 0);
  const onlyLink = await host.request(commentInput({ text: "", links: ["https://example.com", "https://example.com/"] }));
  assert.equal(onlyLink.status, 201);
  assert.deepEqual(onlyLink.body.comment.links, ["https://example.com/"]);
});

test("strict media validation rejects forged MIME, malformed Base64, corruption and decompression excess", async (t) => {
  const host = await createDiscussionHost(); t.after(() => host.close());
  const corruptCrc = pngBytes(); corruptCrc[corruptCrc.length - 1] ^= 1;
  const hugeHeader = Buffer.alloc(13); hugeHeader.writeUInt32BE(5000, 0); hugeHeader.writeUInt32BE(1, 4); hugeHeader[8] = 8; hugeHeader[9] = 6;
  const oversizedDimensions = Buffer.concat([pngBytes().subarray(0, 8), pngChunk("IHDR", hugeHeader), pngChunk("IDAT", deflateSync(Buffer.alloc(1))), pngChunk("IEND", Buffer.alloc(0))]);
  const invalidImages = [
    "data:image/svg+xml;base64," + Buffer.from('<svg onload="alert(1)"/>').toString("base64"),
    "data:image/png;base64," + Buffer.from('<script>alert(1)</script>').toString("base64"),
    "data:image/png;base64,AB==", pngUri() + "\n", pngUri().replace("base64,", "base64, "),
    `data:image/png;base64,${corruptCrc.toString("base64")}`,
    `data:image/png;base64,${oversizedDimensions.toString("base64")}`,
    pngUri({ decoded: Buffer.alloc(100000) }), pngUri({ decoded: Buffer.alloc(1) }),
    pngUri({ decoded: Buffer.from([5, ...Array(17).fill(0)]) }),
    pngUri({ compressed: Buffer.from("broken deflate") }),
    `data:image/png;base64,${Buffer.concat([pngBytes(), Buffer.from("trailing html")]).toString("base64")}`,
    "data:image/png;base64," + Buffer.alloc(1024 * 1024 + 1).toString("base64"),
  ];
  for (const dataUri of invalidImages) assert.ok([400, 413].includes((await host.request(commentInput({ images: [{ dataUri }] }))).status));
  const invalidAudio = ["data:audio/mpeg;base64,AA==", "data:audio/wav;base64," + Buffer.from("not audio").toString("base64"), wavUri(60.1), wavUri().replace("base64,", "base64,\n")];
  for (const dataUri of invalidAudio) assert.ok([400, 413].includes((await host.request(commentInput({ audio: { dataUri } }))).status));
  assert.equal((await host.request()).body.total, 0);
  assert.equal((await host.request(commentInput({ text: "", audio: { dataUri: wavUri(60) } }))).status, 201);
});

test("pagination covers every comment once and rejects cursors from another paper", async (t) => {
  const host = await createDiscussionHost(); t.after(() => host.close());
  for (let index = 0; index < 23; index++) assert.equal((await host.request(commentInput({ clientId: `comment-pagination-${index}`, text: `讨论 ${index}` }))).status, 201);
  const first = (await host.request()).body;
  assert.equal(first.comments.length, 20); assert.equal(first.total, 23); assert.ok(first.nextCursor);
  const second = (await host.request(null, scope, first.nextCursor)).body;
  assert.equal(second.comments.length, 3); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.comments, ...second.comments].map((comment) => comment.id)).size, 23);
  assert.equal((await host.request(null, otherScope, first.nextCursor)).status, 400);
});

test("service respects handler routing and leaves unrelated feature namespaces untouched", async () => {
  const service = createDiscussionsService({ readCatalog() { throw new Error("unexpected read"); }, mutateCatalog() { throw new Error("unexpected mutation"); } });
  assert.equal(await service({ pathname: "/api/elsewhere", method: "POST" }), false);
  let response;
  assert.equal(await service({ pathname: "/api/discussions", method: "DELETE", send(status, body) { response = { status, body }; } }), true);
  assert.equal(response.status, 405);
});

test("browser audio normalization bounds the recorded tail and produces server-readable mono PCM", async (t) => {
  const host = await createDiscussionHost(); t.after(() => host.close());
  const length = 44100;
  const channels = [Float32Array.from({ length }, () => 2), Float32Array.from({ length }, () => 1)];
  const stereo = { duration: 1, length, sampleRate: 44100, numberOfChannels: 2, getChannelData: (index) => channels[index] };
  const encoded = Buffer.from(await encodeDiscussionWav(stereo).arrayBuffer());
  const result = await host.request(commentInput({ audio: { dataUri: `data:audio/wav;base64,${encoded.toString("base64")}` } }));
  assert.equal(result.status, 201);
  assert.equal(result.body.comment.audio.duration, 1);
  assert.equal(result.body.comment.audio.bytes, 32044);
  assert.equal(encoded.readInt16LE(44), 32767, "out-of-range sample amplitudes are clipped");
  const tail = { duration: 60.04, length: 960640, sampleRate: 16000, numberOfChannels: 1, getChannelData: () => new Float32Array(960640) };
  assert.throws(() => encodeDiscussionWav(tail), /60 秒/);
  const trimmed = Buffer.from(await encodeDiscussionWav(tail, { trimToLimit: true }).arrayBuffer());
  const bounded = await host.request(commentInput({ clientId: "comment-record-tail-123", audio: { dataUri: `data:audio/wav;base64,${trimmed.toString("base64")}` } }));
  assert.equal(bounded.status, 201);
  assert.equal(bounded.body.comment.audio.duration, 60);
  assert.throws(() => normalizeDiscussionLink("https://example.com/\tfoo"));
});
