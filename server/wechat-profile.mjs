import { createCipheriv, createHash, randomBytes } from "node:crypto";

const PATH = "/api/miniprogram-profile";
const AVATAR_ID = /^[a-f0-9]{48}$/;
const WECHAT_CODE = /^[\w-]{1,256}$/;
const MAX_AVATAR_BYTES = 256 * 1024;
const PNG = Buffer.from("89504e470d0a1a0a", "hex");
const JPEG = Buffer.from("ffd8ff", "hex");

function configuration(env) {
  const key = Buffer.from(env.ROLLIERANK_WECHAT_PHONE_KEY || "", "base64");
  return {
    appId: env.ROLLIERANK_WECHAT_APP_ID?.trim(),
    secret: env.ROLLIERANK_WECHAT_APP_SECRET?.trim(),
    phoneKey: env.ROLLIERANK_WECHAT_PHONE_ENABLED === "1" && key.length === 32 ? key : null,
  };
}

function failure(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function avatarImage(data) {
  if (typeof data !== "string" || data.length > Math.ceil(MAX_AVATAR_BYTES / 3) * 4) {
    throw failure(400, "请使用 256 KB 以内的头像。");
  }
  const bytes = Buffer.from(data, "base64");
  const mime = bytes.subarray(0, PNG.length).equals(PNG) ? "image/png"
    : bytes.subarray(0, JPEG.length).equals(JPEG) ? "image/jpeg" : null;
  if (!mime || bytes.length < 24 || bytes.length > MAX_AVATAR_BYTES || bytes.toString("base64") !== data) {
    throw failure(400, "请选择有效的 PNG 或 JPEG 头像。");
  }
  return { id: randomBytes(24).toString("hex"), mime, data };
}

function protectPhone(info, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update("+" + info.countryCode + info.purePhoneNumber, "utf8"), cipher.final()]);
  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    last4: info.purePhoneNumber.slice(-4),
  };
}

function profileView(profile) {
  return { name: profile?.name ?? "", avatarId: profile?.avatar?.id ?? "", phoneLast4: profile?.phone?.last4 ?? "" };
}

// Device credentials protect editable profiles; phone changes also require WeChat verification.
export function createWechatProfileService({ readCatalog, mutateCatalog }, {
  config = configuration(process.env), fetchImpl = globalThis.fetch,
} = {}) {
  const { appId, secret, phoneKey } = config;
  const phoneEnabled = Boolean(appId && secret && phoneKey);
  let accessToken = "";
  let accessTokenExpires = 0;
  let pendingToken;

  async function wechat(path, query, payload) {
    const url = new URL(path, "https://api.weixin.qq.com");
    if (query) url.search = new URLSearchParams(query);
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(5000),
        ...(payload ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : {}),
      });
      if (!response.ok) throw new Error();
      return await response.json();
    } catch {
      throw failure(502, "暂时连不上微信，请稍后重试。");
    }
  }

  async function getAccessToken() {
    if (Date.now() < accessTokenExpires) return accessToken;
    // Share token refresh across concurrent authorizations without storing credentials in the database.
    pendingToken ??= (async () => {
      const result = await wechat("/cgi-bin/stable_token", null, {
        grant_type: "client_credential", appid: appId, secret, force_refresh: false,
      });
      if (!result?.access_token || !Number.isFinite(result.expires_in)) {
        throw failure(502, "暂时无法使用微信手机号授权。");
      }
      accessToken = result.access_token;
      accessTokenExpires = Date.now() + Math.max(0, result.expires_in - 120) * 1000;
      return accessToken;
    })().finally(() => { pendingToken = undefined; });
    return pendingToken;
  }

  async function exchangePhone(code) {
    const result = await wechat("/wxa/business/getuserphonenumber", { access_token: await getAccessToken() }, { code });
    const info = result?.phone_info;
    if (result?.errcode !== 0 || !info || info.watermark?.appid !== appId ||
        typeof info.countryCode !== "string" || typeof info.purePhoneNumber !== "string" ||
        !/^\d{1,4}$/.test(info.countryCode) || !/^\d{4,16}$/.test(info.purePhoneNumber)) {
      throw failure(400, "微信手机号授权未完成，请重新授权。");
    }
    return protectPhone(info, phoneKey);
  }

  return async function handle({ pathname, method, input, query, response, send }) {
    if (!pathname.startsWith(PATH + "/")) return false;
    if (method === "GET" && pathname === PATH + "/capabilities") {
      send(200, { phoneEnabled });
    } else if (method === "POST" && pathname === PATH + "/session") {
      // Provision a random credential before writes so a lost save response can be retried.
      send(200, { token: randomBytes(24).toString("hex") });
    } else if (method === "GET" && pathname === PATH + "/avatar") {
      const id = query.get("id");
      const profile = AVATAR_ID.test(id ?? "") && Object.values(readCatalog().features.wechatProfiles ?? {})
        .find(profile => profile.avatar?.id === id);
      if (!profile) send(404, { error: "找不到头像。" });
      else {
        const bytes = Buffer.from(profile.avatar.data, "base64");
        response.writeHead(200, {
          "Content-Type": profile.avatar.mime, "Content-Length": bytes.length,
          "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
        });
        response.end(bytes);
      }
    } else if (method === "POST" && pathname === PATH + "/profile") {
      if (typeof input.token !== "string" || !AVATAR_ID.test(input.token)) throw failure(401, "本机资料凭证无效。");
      const user = createHash("sha256").update(input.token).digest("hex");
      const patch = {};
      if (input.name !== undefined) {
        const name = typeof input.name === "string" ? input.name.trim() : "";
        if (!name || name.length > 12 || /[\u0000-\u001f\u007f]/.test(name)) throw failure(400, "请输入 1 到 12 字的昵称。");
        patch.name = name;
      }
      if (input.avatar !== undefined) patch.avatar = avatarImage(input.avatar);
      if (input.phoneCode !== undefined) {
        if (!phoneEnabled) throw failure(503, "手机号授权暂未启用。");
        if (typeof input.phoneCode !== "string" || !WECHAT_CODE.test(input.phoneCode) ||
            typeof input.code !== "string" || !WECHAT_CODE.test(input.code)) throw failure(400, "请重新授权手机号。");
        const result = await wechat("/sns/jscode2session", { appid: appId, secret, js_code: input.code, grant_type: "authorization_code" });
        if (result?.errcode || typeof result?.openid !== "string" || !WECHAT_CODE.test(result.openid)) {
          throw failure(401, "微信登录已失效，请重试。");
        }
        const owner = createHash("sha256").update(appId + ":" + result.openid).digest("hex");
        const previousOwner = readCatalog().features.wechatProfiles?.[user]?.phone?.owner;
        if (previousOwner && previousOwner !== owner) throw failure(403, "请使用原微信账号更新手机号。");
        patch.phone = { ...await exchangePhone(input.phoneCode), owner };
      }
      const profile = Object.keys(patch).length
        ? await mutateCatalog(({ features }) => {
          const profiles = features.wechatProfiles ??= {};
          const previousOwner = profiles[user]?.phone?.owner;
          if (patch.phone && previousOwner && previousOwner !== patch.phone.owner) throw failure(403, "请使用原微信账号更新手机号。");
          return profiles[user] = { ...profiles[user], ...patch };
        })
        : readCatalog().features.wechatProfiles?.[user];
      send(200, { profile: profileView(profile) });
    } else send(404, { error: "没有找到这个资料接口。" });
    return true;
  };
}
