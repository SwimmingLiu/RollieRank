import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createApi } from "../server/api.mjs";
import { createDiscussionsService } from "../server/discussions.mjs";
import { createQiniuStorage } from "../server/qiniu-oss.mjs";
import { renderDiscussionComment } from "../src/features/discussions.js";
import { pngUri } from "./discussions-fixtures.mjs";

test("Discussion images and feedback screenshots upload to Qiniu OSS instead of storing base64 in catalog.json", async () => {
  const uploads = [];
  const mockQiniuFetch = async (url, init) => {
    assert.equal(String(url), "https://up-z0.qiniup.com");
    const form = init.body;
    const key = String(form.get("key"));
    const token = String(form.get("token"));
    const file = form.get("file");
    assert.ok(token.startsWith("test-ak:"), "Qiniu upload token should use configured AK");
    assert.ok(file && file.size > 24, "uploaded image file should be non-empty");
    uploads.push({ key, mime: file.type, size: file.size });
    return new Response(JSON.stringify({ key, hash: "mock-hash" }), { status: 200 });
  };

  const oss = createQiniuStorage({
    config: {
      ak: "test-ak",
      sk: "test-sk",
      bucket: "rollie-rank",
      domain: "https://rollie-rank-oss.swimmingliu.cn",
      upHost: "https://up-z0.qiniup.com",
      avatarPrefix: "avatars/",
      discussionPrefix: "discussions/",
      feedbackPrefix: "feedback/",
    },
    fetchImpl: mockQiniuFetch,
  });

  const dir = await mkdtemp(path.join(tmpdir(), "rollierank-oss-"));
  const dataDirectory = pathToFileURL(dir + path.sep);
  const api = await createApi({
    dataDirectory,
    featureFactories: [
      (ctx) => createDiscussionsService(ctx, { oss }),
    ],
    feedbackOptions: { oss },
  });

  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (await api(req, res, pathname)) return;
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const reqJson = async (p, body) => {
    const res = await fetch(`${baseUrl}${p}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };

  try {
    const samplePng = pngUri();
    const guestId = "guest-oss-test-001";

    // 1. Feedback screenshot uploads to feedback/<id>.png on Qiniu OSS
    const fb = await reqJson("/api/feedback", {
      feedbackId: "fb-oss-check-001",
      guestId,
      category: "bug",
      content: "测试反馈截图走 OSS",
      images: [{ dataUri: samplePng, alt: "报错截图" }],
    });
    assert.equal(fb.status, 200);
    assert.match(fb.data.feedback.images[0].url, /^https:\/\/rollie-rank-oss\.swimmingliu\.cn\/feedback\/[a-f0-9]+\.png$/);
    assert.equal(fb.data.feedback.images[0].dataUri, fb.data.feedback.images[0].url);
    assert.equal(uploads.length, 1);
    assert.match(uploads[0].key, /^feedback\/[a-f0-9]+\.png$/);

    // Replay same feedbackId must NOT upload a second copy to OSS
    const fbReplay = await reqJson("/api/feedback", {
      feedbackId: "fb-oss-check-001",
      guestId,
      category: "bug",
      content: "测试反馈截图走 OSS",
      images: [{ dataUri: samplePng, alt: "报错截图" }],
    });
    assert.equal(fbReplay.status, 200);
    assert.equal(uploads.length, 1);

    // 2. Submit a real attempt, then post a discussion comment with an image
    const catalogRes = await reqJson("/api/catalog");
    const version = catalogRes.data.versions[0];
    const submit = await reqJson("/api/submit", {
      guestId,
      attemptId: "attempt-oss-001",
      versionId: version.id,
      name: "卷友OSS",
      answers: Array(version.questionCount).fill("A"),
    });
    assert.equal(submit.status, 200);

    const disc = await reqJson("/api/discussions", {
      guestId,
      attemptId: "attempt-oss-001",
      paperId: version.paperId,
      clientId: "comment-oss-001",
      nickname: "卷友OSS",
      text: "这道题的图解",
      images: [{ dataUri: samplePng, alt: "题解图" }],
    });
    assert.equal(disc.status, 201);
    assert.match(disc.data.comment.images[0].url, /^https:\/\/rollie-rank-oss\.swimmingliu\.cn\/discussions\/[a-f0-9]+\.png$/);
    assert.equal(disc.data.comment.images[0].dataUri, disc.data.comment.images[0].url);
    assert.equal(uploads.length, 2);
    assert.match(uploads[1].key, /^discussions\/[a-f0-9]+\.png$/);

    // 3. Verify catalog.json on disk contains ZERO base64 image blobs
    const rawCatalog = await readFile(path.join(dir, "catalog.json"), "utf8");
    assert.doesNotMatch(rawCatalog, /data:image\/(?:png|jpeg);base64,/);

    // 4. Verify web renderDiscussionComment renders OSS https:// URL cleanly
    const html = renderDiscussionComment(disc.data.comment);
    assert.ok(html.includes(disc.data.comment.images[0].url), "Web discussion renderer should accept OSS https:// image URLs");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
