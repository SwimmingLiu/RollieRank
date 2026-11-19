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
