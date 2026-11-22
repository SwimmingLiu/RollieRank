import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createApi } from "../server/api.mjs";
import { commentInput, createDiscussionHost, scope } from "./discussions-fixtures.mjs";

async function apiHost(directory) {
  directory ??= await mkdtemp(join(tmpdir(), "rollierank-comment-interactions-"));
  const api = await createApi({ dataDirectory: pathToFileURL(directory + "/") });
  const server = createServer((request, response) => api(request, response, new URL(request.url, "http://localhost").pathname));
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  return { directory,
    async request(path, body) {
      const response = await fetch(base + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
      return { status: response.status, body: await response.json() };
    },
    async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); },
  };
}
const query = (path, target, extra = {}) => path + "?" + new URLSearchParams({ ...target, ...extra });
const post = (target, clientId, text, parentId = null) => ({ ...target, nickname: target.guestId.endsWith("a") ? "晚风" : target.guestId.endsWith("b") ? "山间" : "小舟", clientId, text, parentId, images: [], links: [] });
async function threeReaders(host) {
  const versions = (await host.request("catalog")).body.versions.filter(item => item.status === "published");
  const readers = [];
  for (const suffix of ["a", "b", "c"]) {
    const guestId = "guest-comments-reader-" + suffix, attemptId = "attempt-comments-reader-" + suffix;
    const receipt = (await host.request("submit", { guestId, attemptId, versionId: versions[0].id, answers: Array(versions[0].questionCount).fill("A") })).body;
    readers.push({ guestId, attemptId, paperId: receipt.paperId });
  }
  const otherId = "attempt-comments-other-paper";
  const other = (await host.request("submit", { guestId: readers[1].guestId, attemptId: otherId, versionId: versions[1].id, answers: Array(versions[1].questionCount).fill("A") })).body;
  return { readers, other: { guestId: readers[1].guestId, attemptId: otherId, paperId: other.paperId } };
}
function privateFieldsAbsent(value) {
  const serialized = JSON.stringify(value);
  for (const field of ["guestId", "clientId", "bodyHash", "likedBy", "likerIds", '"liked":']) assert.equal(serialized.includes(field === "likedBy" ? '"likedBy":' : field), false, field);
}

test("real A/B/C receipt-bound likes are boolean, concurrent-safe and persist without publishing liker identities", async t => {
  let host = await apiHost(); const directory = host.directory;
  t.after(async () => { await host.close(); await rm(directory, { recursive: true, force: true }); });
  const { readers: [a, b, c], other } = await threeReaders(host);
  const root = (await host.request("discussions", post(a, "comment-root-likes-123", "这题还有更快的解法吗？"))).body.comment;
  const like = (target, liked) => host.request("discussions/like", { ...target, commentId: root.id, liked });
  const responses = await Promise.all([...Array.from({ length: 8 }, () => like(b, true)), ...Array.from({ length: 8 }, () => like(c, true))]);
  assert.ok(responses.every(response => response.status === 200));
  const forA = (await host.request(query("discussions", a))).body.comments[0];
  assert.equal(forA.likeCount, 2); assert.equal(forA.likedByMe, false); privateFieldsAbsent(forA);
  assert.equal((await host.request(query("discussions", b))).body.comments[0].likedByMe, true);
  assert.equal((await like({ ...b, attemptId: a.attemptId }, true)).status, 403);
  assert.equal((await like(other, true)).status, 404);
  assert.equal((await host.request("discussions/like", { ...b, commentId: root.id, liked: 1 })).status, 400);
  await host.close(); host = await apiHost(directory);
  const persisted = (await host.request(query("discussions", b))).body.comments[0];
  assert.equal(persisted.likeCount, 2); assert.equal(persisted.likedByMe, true);
  const removed = await Promise.all(Array.from({ length: 10 }, () => like(b, false)));
  assert.ok(removed.every(result => result.body.comment.likeCount === 1 && result.body.comment.likedByMe === false));
  const stored = JSON.parse(await readFile(join(directory, "catalog.json"), "utf8"));
  assert.deepEqual(stored.features.discussions.comments[0].likedBy, [c.guestId]);
});

test("replies to roots and replies share a flat thread, true counts and idempotent replay", async t => {
  const host = await apiHost(); t.after(async () => { await host.close(); await rm(host.directory, { recursive: true, force: true }); });
  const { readers: [a, b, c], other } = await threeReaders(host);
  const root = (await host.request("discussions", post(a, "comment-thread-root-123", "资料分析怎么安排？"))).body.comment;
  const replyBody = post(b, "comment-thread-reply-123", "我会留 25 分钟。", root.id);
  const [first, second] = await Promise.all([host.request("discussions", replyBody), host.request("discussions", replyBody)]);
  assert.deepEqual([first.status, second.status].sort(), [200, 201]);
  assert.equal(first.body.comment.id, second.body.comment.id); assert.equal(second.body.rootComment.replyCount, 1);
  const reply = first.body.comment;
  const nested = (await host.request("discussions", post(c, "comment-thread-nested-123", "谢谢，我也试试。", reply.id))).body.comment;
  assert.equal(nested.parentId, reply.id); assert.equal(nested.rootId, root.id); assert.deepEqual(nested.replyTo, { id: reply.id, name: reply.author.name });
  assert.equal(reply.rootId, root.id); assert.deepEqual(reply.replyTo, { id: root.id, name: root.author.name });
  const roots = (await host.request(query("discussions", a))).body;
  assert.equal(roots.total, 3); assert.equal(roots.rootTotal, 1); assert.equal(roots.comments.length, 1); assert.equal(roots.comments[0].replyCount, 2);
  const replies = (await host.request(query("discussions/replies", a, { rootId: root.id }))).body;
  assert.deepEqual(replies.comments.map(item => item.id), [reply.id, nested.id]); assert.equal(replies.total, 2); privateFieldsAbsent(replies);
  assert.equal((await host.request("discussions/like", { ...a, commentId: nested.id, liked: true })).body.comment.likeCount, 1);
  assert.equal((await host.request(query("discussions/replies", other, { rootId: root.id }))).status, 404);
  assert.equal((await host.request("discussions", post(other, "comment-cross-paper-123", "不能跨卷回复", root.id))).status, 404);
  assert.equal((await host.request("discussions", { ...replyBody, parentId: nested.id })).status, 409);
  assert.equal((await host.request(query("discussions", a))).body.total, 3);
});

test("reply pagination covers every reply once and rejects unrelated thread cursors", async t => {
  const host = await apiHost(); t.after(async () => { await host.close(); await rm(host.directory, { recursive: true, force: true }); });
  const { readers: [a, b] } = await threeReaders(host);
  const root = (await host.request("discussions", post(a, "pagination-root-123", "一起交流"))).body.comment;
  for (let index = 0; index < 23; index++) assert.equal((await host.request("discussions", post(b, `pagination-reply-${index}-123`, `回复 ${index}`, root.id))).status, 201);
  const first = (await host.request(query("discussions/replies", a, { rootId: root.id }))).body;
  const second = (await host.request(query("discussions/replies", a, { rootId: root.id, before: first.nextCursor }))).body;
  assert.equal(first.comments.length, 20); assert.equal(second.comments.length, 3); assert.equal(second.nextCursor, null);
  assert.equal(first.total, 23); assert.equal(new Set([...first.comments, ...second.comments].map(item => item.id)).size, 23);
  assert.equal(first.comments[0].text, "回复 0"); assert.equal(second.comments.at(-1).text, "回复 22");
  const otherRoot = (await host.request("discussions", post(a, "pagination-second-root-123", "另一话题"))).body.comment;
  assert.equal((await host.request(query("discussions/replies", a, { rootId: otherRoot.id, before: first.nextCursor }))).status, 400);
  assert.equal((await host.request(query("discussions/replies", a, { rootId: first.comments[0].id }))).status, 400);
  assert.equal((await host.request(query("discussions", a))).body.total, 25);
});

test("failed writes roll back likes and replies so retry keeps one real interaction", async t => {
  const host = await createDiscussionHost(); t.after(() => host.close());
  const root = (await host.request(commentInput())).body.comment;
  const request = async (path, body) => { const response = await fetch(host.base + "/api/" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() }; };
  const likeBody = { ...scope, commentId: root.id, liked: true }, replyBody = commentInput({ clientId: "retry-thread-reply-123", parentId: root.id });
  host.setFailWrite(true);
  assert.equal((await request("discussions/like", likeBody)).status, 400); assert.equal((await host.request(replyBody)).status, 400);
  assert.equal((await host.request()).body.comments[0].likeCount, 0); assert.equal((await host.request()).body.total, 1);
  host.setFailWrite(false);
  assert.equal((await request("discussions/like", likeBody)).body.comment.likeCount, 1);
  assert.equal((await host.request(replyBody)).status, 201); assert.equal((await host.request(replyBody)).status, 200);
  const list = (await host.request()).body; assert.equal(list.total, 2); assert.equal(list.comments[0].replyCount, 1);
});
