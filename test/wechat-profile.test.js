import assert from "node:assert/strict";
import { createDecipheriv, randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { createApi } from "../server/api.mjs";
import { createDiscussionsService } from "../server/discussions.mjs";
import { createWechatProfileService } from "../server/wechat-profile.mjs";

const pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+AvX8AAAAASUVORK5CYII=";

async function profileApi(t, options) {
  const directory = await mkdtemp(join(tmpdir(), "rollierank-private-profile-"));
  const settings = { dataDirectory: pathToFileURL(directory + "/"), featureFactories: [
    (dependencies) => createWechatProfileService(dependencies, options),
  ] };
  let api = await createApi(settings);
  const server = createServer((req, res) => api(req, res, new URL(req.url, "http://localhost").pathname));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { force: true, recursive: true });
  });
  const base = "http://127.0.0.1:" + server.address().port + "/api/miniprogram-profile/";
  function call(path, payload) {
    return fetch(base + path, payload === undefined ? undefined : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
  }
  return { call, directory, restart: async () => { api = await createApi(settings); } };
}

test("nickname and selected avatar survive reload and remain separate from the practice identifier", async t => {
  const { call, directory, restart } = await profileApi(t, { config: {} });
  assert.deepEqual(await (await call("capabilities")).json(), { phoneEnabled: false });
  const { token } = await (await call("session", {})).json();
  assert.match(token, /^[0-9a-f]{48}$/);
  assert.equal((await call("profile", { guestId: "practice-guest-id", name: "别人" })).status, 401);
  assert.equal((await call("profile", { token, avatar: Buffer.from("<svg/>").toString("base64") })).status, 400);
  assert.equal((await call("profile", { token, phoneCode: "disabled" })).status, 503);
  const writes = await Promise.all([call("profile", { token, name: "  卷卷  " }), call("profile", { token, avatar: pixel })]);
  assert.ok(writes.every(response => response.ok));
  await restart();
  const { profile } = await (await call("profile", { token })).json();
  assert.equal(profile.name, "卷卷");
  assert.equal(profile.phoneLast4, "");
  const avatar = await call("avatar?id=" + profile.avatarId);
  assert.equal(avatar.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await avatar.arrayBuffer()), Buffer.from(pixel, "base64"));
  const isolated = await (await call("profile", { token: randomBytes(24).toString("hex") })).json();
  assert.equal(isolated.profile.name, "");
  const path = join(directory, "catalog.json");
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal((await readFile(path, "utf8")).includes(token), false);
});

test("optional phone authorization verifies WeChat and persists an encrypted value with a masked response", async t => {
  const phoneKey = randomBytes(32);
  const appId = "wx-profile-test";
  const phone = "13800001234";
  const fetchImpl = async (url, options) => {
    if (url.pathname === "/sns/jscode2session") {
      return Response.json({ openid: url.searchParams.get("js_code") === "original" ? "owner-open-id" : "another-open-id" });
    }
    if (url.pathname === "/cgi-bin/stable_token") return Response.json({ access_token: "test-access-token", expires_in: 7200 });
    assert.equal(url.pathname, "/wxa/business/getuserphonenumber");
    assert.equal(JSON.parse(options.body).code, "selected-phone");
    return Response.json({ errcode: 0, phone_info: { countryCode: "86", purePhoneNumber: phone, watermark: { appid: appId } } });
  };
  const { call, directory } = await profileApi(t, { config: { appId, secret: "test-secret", phoneKey }, fetchImpl });
  assert.deepEqual(await (await call("capabilities")).json(), { phoneEnabled: true });
  const { token } = await (await call("session", {})).json();
  const response = await call("profile", { token, phoneCode: "selected-phone", code: "original" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { profile: { name: "", avatarId: "", phoneLast4: "1234" } });
  assert.equal((await call("profile", { token, phoneCode: "selected-phone", code: "another" })).status, 403);
  const content = await readFile(join(directory, "catalog.json"), "utf8");
  assert.equal(content.includes(phone), false);
  const saved = Object.values(JSON.parse(content).features.wechatProfiles)[0].phone;
  const decrypt = createDecipheriv("aes-256-gcm", phoneKey, Buffer.from(saved.iv, "base64"));
  decrypt.setAuthTag(Buffer.from(saved.tag, "base64"));
  assert.equal(decrypt.update(saved.encrypted, "base64", "utf8") + decrypt.final("utf8"), "+86" + phone);
});

test("avatars upload to Qiniu OSS instead of storing base64 in catalog.json and stay in sync with discussions", async t => {
  const uploads = [];
  const ossFetch = async (url, options) => {
    assert.equal(String(url), "https://up-z0.qiniup.com");
    assert.equal(options.method, "POST");
    const token = options.body.get("token");
    const key = options.body.get("key");
    const file = options.body.get("file");
    assert.match(token, /^test-ak:[^:]+:[^:]+$/);
    assert.match(key, /^avatars\/[a-f0-9]{48}\.png$/);
    assert.equal(file.type, "image/png");
    uploads.push({ key, size: file.size });
    return Response.json({ key, hash: "mock-hash" });
  };

  const directory = await mkdtemp(join(tmpdir(), "rollierank-oss-profile-"));
  const qiniu = {
    ak: "test-ak",
    sk: "test-sk",
    bucket: "rollie-rank",
    domain: "https://rollie-rank-oss.swimmingliu.cn",
    upHost: "https://up-z0.qiniup.com",
    avatarPrefix: "avatars/",
  };
  const api = await createApi({
    dataDirectory: pathToFileURL(directory + "/"),
    featureFactories: [
      createDiscussionsService,
      (dependencies) => createWechatProfileService(dependencies, { config: { qiniu }, fetchImpl: ossFetch }),
    ],
  });
  const server = createServer((req, res) => api(req, res, new URL(req.url, "http://localhost").pathname));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { force: true, recursive: true });
  });
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  const post = (path, body) => fetch(base + path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });

  // 1. 先交卷取得合法评论凭证，发表一条默认身份评论与一条回复
  const { versions } = await (await fetch(base + "catalog")).json();
  const version = versions.find(item => item.status === "published");
  const authorGuest = "guest-author-0001";
  const replierGuest = "guest-replier-0002";
  const submit = async (guestId, attemptId) => {
    const res = await post("submit", {
      guestId,
      attemptId,
      versionId: version.id,
      answers: Array(version.questionCount).fill("A"),
    });
    assert.equal(res.status, 200);
    return res.json();
  };
  const authorAttempt = await submit(authorGuest, "attempt-author-0001");
  const replierAttempt = await submit(replierGuest, "attempt-replier-0002");

  const firstCommentRes = await post("discussions", {
    paperId: version.paperId,
    attemptId: authorAttempt.id,
    guestId: authorGuest,
    clientId: "comment-client-0001",
    nickname: "卷友",
    text: "先用默认身份占楼",
  });
  assert.equal(firstCommentRes.status, 201);
  const firstComment = (await firstCommentRes.json()).comment;

  const replyRes = await post("discussions", {
    paperId: version.paperId,
    attemptId: replierAttempt.id,
    guestId: replierGuest,
    clientId: "comment-client-0002",
    nickname: "同桌考生",
    parentId: firstComment.id,
    text: "回复一下楼主",
  });
  assert.equal(replyRes.status, 201);

  // 2. 用户同步微信头像与微信昵称（上传七牛 OSS，并绑定 guestId）
  const { token } = await (await post("miniprogram-profile/session", {})).json();
  const saveRes = await post("miniprogram-profile/profile", {
    token,
    guestId: authorGuest,
    name: "微信小明",
    avatar: pixel,
  });
  assert.equal(saveRes.status, 200);
  const { profile } = await saveRes.json();
  assert.equal(profile.name, "微信小明");
  assert.equal(uploads.length, 1);
  assert.equal(profile.avatarUrl, `https://rollie-rank-oss.swimmingliu.cn/${uploads[0].key}`);

  // 校验 catalog.json 未落盘 base64 头像数据，且 /avatar 接口 302 跳转到 OSS
  const catalogRaw = await readFile(join(directory, "catalog.json"), "utf8");
  assert.equal(catalogRaw.includes(pixel), false);
  const redirectRes = await fetch(`${base}miniprogram-profile/avatar?id=${profile.avatarId}`, { redirect: "manual" });
  assert.equal(redirectRes.status, 302);
  assert.equal(redirectRes.headers.get("location"), profile.avatarUrl);

  // 3. 历史评论与回复目标名均实时同步为最新微信头像和微信昵称
  const listRes = await fetch(`${base}discussions?paperId=${encodeURIComponent(version.paperId)}&guestId=${authorGuest}&attemptId=${authorAttempt.id}`);
  const list = await listRes.json();
  assert.equal(list.comments[0].author.name, "微信小明");
  assert.equal(list.comments[0].author.avatarUrl, profile.avatarUrl);

  const repliesRes = await fetch(`${base}discussions/replies?paperId=${encodeURIComponent(version.paperId)}&guestId=${authorGuest}&attemptId=${authorAttempt.id}&rootId=${firstComment.id}`);
  const replies = await repliesRes.json();
  assert.equal(replies.comments[0].replyTo.name, "微信小明");

  // 4. 后续新评论自动使用最新微信昵称与微信头像
  const secondCommentRes = await post("discussions", {
    paperId: version.paperId,
    attemptId: authorAttempt.id,
    guestId: authorGuest,
    clientId: "comment-client-0003",
    nickname: "卷友",
    text: "同步后的新评论",
  });
  assert.equal(secondCommentRes.status, 201);
  const secondComment = (await secondCommentRes.json()).comment;
  assert.equal(secondComment.author.name, "微信小明");
  assert.equal(secondComment.author.avatarUrl, profile.avatarUrl);

  // 5. 未改名用户按 guestId 自动生成稳定编号昵称“卷友XXXX”，避免评论区重名
  assert.match(firstComment.author.name, /^卷友\d{4}$/);
  const anotherCommentRes = await post("discussions", {
    paperId: version.paperId,
    attemptId: replierAttempt.id,
    guestId: replierGuest,
    clientId: "comment-client-0004",
    nickname: "卷友",
    text: "另一个未改名用户的评论",
  });
  assert.equal(anotherCommentRes.status, 201);
  const anotherComment = (await anotherCommentRes.json()).comment;
  assert.match(anotherComment.author.name, /^卷友\d{4}$/);
  assert.notEqual(firstComment.author.name, anotherComment.author.name);
});
