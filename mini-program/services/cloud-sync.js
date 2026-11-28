// 微信静默登录与云端数据自动恢复：跨版本更新、删小程序重进、清缓存或换设备后自动找回答卷、选岗与资料。
const api = require("./api.js");
const credits = require("./tool-credits.js");
const profile = require("./profile.js");
const storage = require("../utils/storage.js");

let sessionPromise = null;
let syncPromise = null;
let sessionVerifiedAt = 0;
let lastSyncedAt = 0;

function formatSelection(position) {
  if (!position || !position.id) return null;
  return {
    id: position.id,
    label: [position.department, position.title].filter(Boolean).join(" · "),
    exam: position.exam,
  };
}

async function ensureSession() {
  if (credits.hasSession() && sessionVerifiedAt) return true;
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    try {
      if (credits.hasSession()) {
        // 每次冷启动校验一次本地缓存会话是否过期；过期时 wallet(0) 会自动清理 token，随即静默重登。
        try {
          await credits.wallet(0);
          sessionVerifiedAt = Date.now();
          return true;
        } catch (error) {
          if (credits.hasSession() && error?.statusCode !== 401) {
            // 卷豆服务短暂不可用或弱网超时：保留本机 token，但不宣称本次已验证云端全量态，避免误清空本机已同步历史。
            return false;
          }
        }
      }
      const cap = await credits.capabilities().catch(() => ({ login: false }));
      if (!cap?.login) return false;
      const candidate = credits.legacyBindCandidate();
      try {
        await credits.login({ bindLegacy: candidate.eligible });
      } catch (error) {
        if (candidate.eligible && (error?.statusCode === 400 || error?.statusCode === 409)) {
          await credits.login({ bindLegacy: false }).catch(() => {});
        }
      }
      if (credits.hasSession()) {
        sessionVerifiedAt = Date.now();
        return true;
      }
      return false;
    } catch {
      return credits.hasSession();
    }
  })().finally(() => {
    sessionPromise = null;
  });
  return sessionPromise;
}

async function syncPosition() {
  try {
    const res = await api.request("positions/profile?guestId=" + encodeURIComponent(storage.guestId()));
    const selection = formatSelection(res?.position);
    const current = storage.position();
    if (selection) {
      if (!current || current.id !== selection.id) {
        storage.setPosition(selection);
      }
      return { ok: true, position: selection };
    }
    if (res && Object.prototype.hasOwnProperty.call(res, "position") && res.position === null) {
      const authoritative = !credits.hasSession() || res.scope === "account";
      if (authoritative && current) storage.setPosition(null);
      return { ok: authoritative, position: authoritative ? null : current };
    }
    return { ok: true, position: current };
  } catch {
    return { ok: false, position: storage.position() };
  }
}

async function syncAll({ force = false } = {}) {
  if (!force && lastSyncedAt && Date.now() - lastSyncedAt < 15000 && storage.history().length) {
    return { synced: true, cached: true, attemptCount: storage.history().length };
  }
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const signedIn = await ensureSession();
    let attemptsOk = false;
    let attempts = [];
    const [, savedProfile, posResult] = await Promise.all([
      api.sync().then(list => {
        attemptsOk = true;
        attempts = Array.isArray(list) ? list : [];
      }).catch(() => {}),
      profile.read().catch(() => null),
      syncPosition(),
    ]);
    if (attemptsOk) {
      if (signedIn && attempts.scope === "account") storage.replaceHistory(attempts);
      else for (const attempt of attempts) storage.upsertAttempt(attempt);
      lastSyncedAt = Date.now();
    }
    return {
      synced: attemptsOk,
      signedIn,
      attemptCount: attempts.length,
      profile: savedProfile,
      position: posResult.position,
    };
  })().finally(() => {
    syncPromise = null;
  });
  return syncPromise;
}

function resetCache() {
  lastSyncedAt = 0;
  sessionVerifiedAt = 0;
}

module.exports = { ensureSession, syncPosition, syncAll, resetCache };
