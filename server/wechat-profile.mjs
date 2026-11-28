import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { createQiniuAvatarStorage, readQiniuConfig } from "./qiniu-oss.mjs";
import { createWechatModeration, matchKeywords, normalizeKeywords } from "./wechat-moderation.mjs";
import { accountIdForGuest, linkAccountGuest } from "./account-identity.mjs";

const PATH = "/api/miniprogram-profile";
const AVATAR_ID = /^[a-f0-9]{48}$/;
const GUEST_ID = /^[\w-]{10,80}$/;
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
    qiniu: readQiniuConfig(env),
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
  return { id: randomBytes(24).toString("hex"), mime, bytes, data };
}

export function defaultNickname(guestId) {
  const raw = String(guestId || "").trim();
  if (!raw) return "卷友";
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const code = 1000 + ((hash >>> 0) % 9000);
  return `卷友${code}`;
}

export function isDefaultNickname(value) {
  const text = String(value || "").trim();
  return !text || text === "卷友" || /^卷友\d{4}$/.test(text);
}

export function avatarUrlForProfile(profile) {
  if (typeof profile?.avatar?.url === "string" && /^https?:\/\//i.test(profile.avatar.url)) {
    return profile.avatar.url;
  }
  if (typeof profile?.avatar?.id === "string" && AVATAR_ID.test(profile.avatar.id)) {
    return `${PATH}/avatar?id=${profile.avatar.id}`;
  }
  return "";
}

export function wechatProfilesByGuest(store) {
  const byGuest = new Map();
  for (const profile of Object.values(store?.features?.wechatProfiles ?? {})) {
    if (!profile || typeof profile.guestId !== "string" || !GUEST_ID.test(profile.guestId)) continue;
    const previous = byGuest.get(profile.guestId);
    if (!previous || (profile.updatedAt || 0) >= (previous.updatedAt || 0)) {
      byGuest.set(profile.guestId, profile);
    }
  }
  const byAccount = store?.features?.wechatProfilesByAccount ?? {};
  const accountGuests = store?.features?.accountGuests ?? {};
  for (const [accountId, entry] of Object.entries(accountGuests)) {
    const accountProfile = byAccount[accountId];
    if (!accountProfile || !Array.isArray(entry?.guestIds)) continue;
    for (const gid of entry.guestIds) {
      if (typeof gid !== "string" || !GUEST_ID.test(gid)) continue;
      const previous = byGuest.get(gid);
      if (!previous || (accountProfile.updatedAt || 0) >= (previous.updatedAt || 0)) {
        byGuest.set(gid, { ...previous, ...accountProfile, guestId: gid });
      }
    }
  }
  return byGuest;
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
  return {
    name: profile?.name ?? "",
    avatarId: profile?.avatar?.id ?? "",
    ...(profile?.avatar?.url ? { avatarUrl: profile.avatar.url } : {}),
    phoneLast4: profile?.phone?.last4 ?? "",
  };
}

// Device credentials protect editable profiles; phone changes also require WeChat verification.
// When an authenticated WeChat wallet session is present, profiles also persist by accountId for cross-device auto-restore.
export function createWechatProfileService({ readCatalog, mutateCatalog, moderation, billing }, {
  config = configuration(process.env), fetchImpl = globalThis.fetch, oss,
} = {}) {
  const { appId, secret, phoneKey, qiniu } = config;
  const phoneEnabled = Boolean(appId && secret && phoneKey);
  const avatarStorage = oss ?? createQiniuAvatarStorage({ config: qiniu ?? {}, fetchImpl });
  const sec = moderation ?? createWechatModeration({ fetchImpl });
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

  async function applyMediaCheckResult(payload) {
    if (!payload?.traceId || payload.suggest !== "risky") return false;
    let matched = false;
    await mutateCatalog(({ features }) => {
      for (const profile of Object.values(features.wechatProfiles ?? {})) {
        if (profile?.avatar?.traceId === payload.traceId) {
          matched = true;
          delete profile.avatar;
        }
      }
      for (const profile of Object.values(features.wechatProfilesByAccount ?? {})) {
        if (profile?.avatar?.traceId === payload.traceId) {
          matched = true;
          delete profile.avatar;
        }
      }
    });
    return matched;
  }

  async function handle({ request, pathname, method, input, query, response, send }) {
    if (!pathname.startsWith(PATH + "/")) return false;
    if (method === "GET" && pathname === PATH + "/capabilities") {
      send(200, { phoneEnabled });
    } else if (method === "POST" && pathname === PATH + "/session") {
      // Provision a random credential before writes so a lost save response can be retried.
      send(200, { token: randomBytes(24).toString("hex") });
    } else if (method === "GET" && pathname === PATH + "/sec-avatar") {
      const id = query.get("id") || "";
      const kind = query.get("kind") || "";
      const index = Number(query.get("index") ?? 0);
      const exp = query.get("exp") || "";
      const sig = query.get("sig") || "";
      if (!sec.verifyMediaUrl({ targetType: "avatar", targetId: id, kind, index, exp, sig })) {
        send(403, { error: "头像校验链接已失效。" });
        return true;
      }
      const profile = AVATAR_ID.test(id) && Object.values(readCatalog().features.wechatProfiles ?? {})
        .find(item => item.avatar?.id === id);
      if (!profile) send(404, { error: "找不到头像。" });
      else if (profile.avatar.url && !profile.avatar.data) {
        response.writeHead(302, { Location: profile.avatar.url, "Cache-Control": "private, no-store" });
        response.end();
      } else {
        const bytes = Buffer.from(profile.avatar.data, "base64");
        response.writeHead(200, {
          "Content-Type": profile.avatar.mime, "Content-Length": bytes.length,
          "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
        });
        response.end(bytes);
      }
    } else if (method === "GET" && pathname === PATH + "/avatar") {
      const id = query.get("id");
      const profile = AVATAR_ID.test(id ?? "") && Object.values(readCatalog().features.wechatProfiles ?? {})
        .find(profile => profile.avatar?.id === id);
      if (!profile) send(404, { error: "找不到头像。" });
      else if (profile.avatar.url) {
        response.writeHead(302, { Location: profile.avatar.url, "Cache-Control": "public, max-age=86400" });
        response.end();
      } else {
        const bytes = Buffer.from(profile.avatar.data, "base64");
        response.writeHead(200, {
          "Content-Type": profile.avatar.mime, "Content-Length": bytes.length,
          "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
        });
        response.end(bytes);
      }
    } else if (method === "POST" && pathname === PATH + "/profile") {
      let walletAccount = null;
      if (request && typeof billing?.requireAccount === "function") {
        try {
          walletAccount = await billing.requireAccount(request);
        } catch {
          walletAccount = null;
        }
      }
      const hasDeviceToken = typeof input.token === "string" && AVATAR_ID.test(input.token);
      if (!hasDeviceToken && !walletAccount?.id) throw failure(401, "本机资料凭证无效。");
      const accountId = walletAccount?.id || "";
      const guestId = typeof input.guestId === "string" && GUEST_ID.test(input.guestId) ? input.guestId : "";
      const initialCatalog = readCatalog();
      if (guestId) {
        const guestOwner = accountIdForGuest(initialCatalog, guestId);
        if (guestOwner && guestOwner !== accountId) {
          throw failure(403, "该本机身份已关联其他微信账号。");
        }
      }
      const tokenUserKey = hasDeviceToken ? createHash("sha256").update(input.token).digest("hex") : "";
      const tokenProfile = tokenUserKey ? initialCatalog.features.wechatProfiles?.[tokenUserKey] : null;
      const tokenOwner = tokenProfile?.accountId || accountIdForGuest(initialCatalog, tokenProfile?.guestId);
      // 若本机旧 profile-token 已归属另一微信账号，切到当前账号独立键，严禁串号覆写或复制手机号密文。
      const tokenBelongsToOther = Boolean(tokenOwner && accountId && tokenOwner !== accountId);
      const user = (hasDeviceToken && !tokenBelongsToOther) ? tokenUserKey : `account:${accountId}`;
      const effectiveHasDeviceToken = hasDeviceToken && !tokenBelongsToOther;
      const patch = {};
      let resolvedOpenId = "";
      if (input.name !== undefined) {
        const name = typeof input.name === "string" ? input.name.trim() : "";
        if (!name || name.length > 12 || /[\u0000-\u001f\u007f]/.test(name)) throw failure(400, "请输入 1 到 12 字的昵称。");
        const keywords = normalizeKeywords(readCatalog().features?.discussions?.settings?.blockedKeywords);
        if (matchKeywords(name, keywords).length) throw failure(422, "昵称包含不允许的内容，请更换。");
        if (sec.isEnabled()) {
          resolvedOpenId = await sec.resolveOpenId({ openid: input.openid, wxCode: input.wxCode, guestId: user });
          if (resolvedOpenId) {
            const check = await sec.checkText({ content: name, openid: resolvedOpenId, scene: 1, nickname: name });
            if (check.suggest === "risky") throw failure(422, "昵称未通过微信安全检测，请更换。");
          }
        }
        patch.name = name;
      }
      if (input.avatar !== undefined) {
        const parsed = avatarImage(input.avatar);
        if (avatarStorage.isEnabled()) {
          const uploaded = await avatarStorage.uploadAvatar({ id: parsed.id, bytes: parsed.bytes, mime: parsed.mime });
          patch.avatar = { id: parsed.id, mime: parsed.mime, url: uploaded.url, key: uploaded.key };
        } else {
          patch.avatar = { id: parsed.id, mime: parsed.mime, data: parsed.data };
        }
      }
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
      const catalogFeatures = readCatalog().features;
      const existingProfile = catalogFeatures.wechatProfiles?.[user];
      const accountProfile = accountId ? catalogFeatures.wechatProfilesByAccount?.[accountId] : null;
      // 仅凭 Bearer token 做只读查询时直接返回云端账号资料，避免多端交替读取重复刷盘。
      if (!effectiveHasDeviceToken && accountId && Object.keys(patch).length === 0) {
        send(200, { profile: profileView(accountProfile || existingProfile) });
        return true;
      }
      // 跨设备/清缓存自动恢复：若当前本机资料为空或云端同账号资料更新，自动同步到当前设备。
      const restored = {};
      if (accountProfile) {
        const cloudNewer = (accountProfile.updatedAt || 0) > (existingProfile?.updatedAt || 0);
        if (patch.name === undefined && accountProfile.name && (!existingProfile?.name || (cloudNewer && accountProfile.name !== existingProfile.name))) {
          restored.name = accountProfile.name;
        }
        if (patch.avatar === undefined && accountProfile.avatar && (!existingProfile?.avatar || (cloudNewer && accountProfile.avatar?.id !== existingProfile.avatar?.id))) {
          restored.avatar = accountProfile.avatar;
        }
        if (patch.phone === undefined && !existingProfile?.phone && accountProfile.phone) restored.phone = accountProfile.phone;
      }
      const mergedPatch = { ...restored, ...patch };
      const hasEffectiveProfile = Boolean(
        mergedPatch.name || mergedPatch.avatar || mergedPatch.phone ||
        existingProfile?.name || existingProfile?.avatar || existingProfile?.phone
      );
      const shouldBindGuest = Boolean(guestId && hasEffectiveProfile && existingProfile?.guestId !== guestId);
      const shouldSyncAccount = Boolean(
        accountId && hasEffectiveProfile && (
          Object.keys(patch).length ||
          !accountProfile ||
          (existingProfile?.name && !accountProfile.name) ||
          (existingProfile?.avatar && !accountProfile.avatar)
        )
      );
      if (guestId && (Object.keys(mergedPatch).length || shouldBindGuest)) {
        mergedPatch.guestId = guestId;
      }
      if (accountId && hasEffectiveProfile && existingProfile?.accountId !== accountId) {
        mergedPatch.accountId = accountId;
      }
      if (Object.keys(mergedPatch).length || shouldSyncAccount) {
        mergedPatch.updatedAt = Date.now();
      }
      const profile = (Object.keys(mergedPatch).length || shouldSyncAccount)
        ? await mutateCatalog((store) => {
          if (guestId) {
            const currentOwner = accountIdForGuest(store, guestId);
            if (currentOwner && currentOwner !== accountId) {
              throw failure(403, "该本机身份已关联其他微信账号。");
            }
          }
          const features = store.features;
          const profiles = features.wechatProfiles ??= {};
          const previousOwner = profiles[user]?.phone?.owner;
          if (mergedPatch.phone && previousOwner && previousOwner !== mergedPatch.phone.owner) {
            throw failure(403, "请使用原微信账号更新手机号。");
          }
          const effectiveGuestId = guestId || (typeof profiles[user]?.guestId === "string" ? profiles[user].guestId : "");
          const canBindGuest = Boolean(
            accountId && effectiveGuestId && (accountIdForGuest(store, effectiveGuestId) === accountId || linkAccountGuest(store, accountId, effectiveGuestId)),
          );
          const next = { ...profiles[user], ...mergedPatch };
          if (accountId && next.guestId && !canBindGuest) {
            // 未验证归属的匿名老设备不得通过资料接口自动并入当前微信账号。
            delete next.guestId;
          }
          profiles[user] = next;
          if (accountId) {
            const byAccount = features.wechatProfilesByAccount ??= {};
            byAccount[accountId] = {
              ...(byAccount[accountId] || {}),
              ...(next.name ? { name: next.name } : {}),
              ...(next.avatar ? { avatar: next.avatar } : {}),
              ...(next.phone ? { phone: next.phone } : {}),
              updatedAt: next.updatedAt,
            };
          }
          return next;
        })
        : (existingProfile || accountProfile);
      if (patch.avatar && sec.isMediaCallbackReady()) {
        resolvedOpenId ||= await sec.resolveOpenId({ openid: input.openid, wxCode: input.wxCode, guestId: user });
        if (resolvedOpenId) {
          const mediaUrl = patch.avatar.url || sec.buildMediaUrl({ targetType: "avatar", targetId: patch.avatar.id, kind: "avatar", index: 0 });
          const check = await sec.checkMediaAsync({ mediaUrl, mediaType: 2, openid: resolvedOpenId, scene: 1 });
          if (check?.traceId) {
            await mutateCatalog(({ features }) => {
              const target = features.wechatProfiles?.[user];
              if (target?.avatar?.id === patch.avatar.id) target.avatar.traceId = check.traceId;
              const accountTarget = accountId ? features.wechatProfilesByAccount?.[accountId] : null;
              if (accountTarget?.avatar?.id === patch.avatar.id) accountTarget.avatar.traceId = check.traceId;
            });
          }
        }
      }
      send(200, { profile: profileView(profile) });
    } else send(404, { error: "没有找到这个资料接口。" });
    return true;
  }

  handle.applyMediaCheckResult = applyMediaCheckResult;
  return handle;
}
