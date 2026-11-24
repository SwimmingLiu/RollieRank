import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { CHOICES, gradeVersion, parseQuestionCsv, publicVersion, roundedScoreRatio, validateQuestions } from "../src/model.js";
import { createWechatModeration, normalizeKeywords } from "./wechat-moderation.mjs";
import { createFeedbackService } from "./feedback.mjs";
import { createQiniuStorage, readQiniuConfig } from "./qiniu-oss.mjs";

const SESSION_COOKIE = "rr_admin_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const IP_LOCK_THRESHOLD = 5;
const IP_HARD_LOCK_THRESHOLD = 10;
const ACCOUNT_LOCK_THRESHOLD = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const IP_LOCK_MS = 15 * 60 * 1000;
const IP_HARD_LOCK_MS = 60 * 60 * 1000;
const ACCOUNT_LOCK_MS = 30 * 60 * 1000;
const VALID_POINT_TYPES = new Set(["reward", "activity", "correction", "comment", "deduct", "manual"]);
const VALID_MODES = new Set(["auto", "manual"]);
const VALID_COMMENT_FILTERS = new Set(["all", "queue", "pending", "flagged", "approved", "rejected"]);

const fail = (statusCode, message, retryAfterSeconds) => {
  throw Object.assign(new Error(message), { statusCode, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) });
};

function resolveClientIp(request) {
  const remote = request?.socket?.remoteAddress || "127.0.0.1";
  const isLoopback = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
  if (isLoopback) {
    const realIp = request?.headers?.["x-real-ip"];
    if (typeof realIp === "string" && realIp.trim()) return realIp.trim();
    const forwarded = request?.headers?.["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      return forwarded.split(",")[0].trim();
    }
  }
  return remote;
}

function sleep(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function parseCookies(header) {
  const result = {};
  if (typeof header !== "string" || !header) return result;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;

export function resolveAdminBasePath(env = process.env) {
  const raw = String(env.ROLLIERANK_ADMIN_PATH || "").trim().replace(/^\/+|\/+$/g, "");
  if (!raw || !/^[a-zA-Z0-9_-]{2,64}(?:\/[a-zA-Z0-9_-]{1,32})*$/.test(raw)) {
    return "/admin";
  }
  return `/${raw}`;
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyStoredPassword(password, record) {
  if (!record?.salt || !record?.passwordHash || typeof password !== "string") return false;
  const derived = scryptSync(password, record.salt, 64);
  const expected = Buffer.from(record.passwordHash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

function envAdminCredentials(env = process.env) {
  const password = (env.ROLLIERANK_ADMIN_PASSWORD || "").trim();
  if (!password) return null;
  const username = (env.ROLLIERANK_ADMIN_USER || "admin").trim() || "admin";
  return { username, password };
}

function readAdminAuth(store, env = process.env) {
  const saved = store?.features?.adminAuth;
  if (saved?.username && saved?.passwordHash && saved?.salt) {
    return { source: "db", username: saved.username, record: saved };
  }
  const fromEnv = envAdminCredentials(env);
  if (fromEnv) {
    return { source: "env", username: fromEnv.username, password: fromEnv.password };
  }
  return null;
}

function validatePasswordStrength(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    fail(400, "密码长度须为 8–128 位。");
  }
}

function appendAudit(store, action, target, operator = "admin") {
  store.audit ??= [];
  store.audit.unshift({
    id: randomUUID(),
    action,
    target,
    operator,
    createdAt: Date.now(),
  });
}

function commentStatus(comment) {
  const status = comment?.moderation?.status;
  return ["approved", "pending", "flagged", "rejected"].includes(status) ? status : "approved";
}

function isInReviewQueue(comment) {
  const status = commentStatus(comment);
  return status === "pending" || status === "flagged" || (Array.isArray(comment.reports) && comment.reports.length > 0 && status !== "rejected");
}

function paperTitleMap(store) {
  const titles = new Map();
  for (const version of store.versions ?? []) {
    if (version?.paperId && version?.title && !titles.has(version.paperId)) {
      titles.set(version.paperId, version.title);
    }
  }
  return titles;
}

function positionLabelMap(store) {
  const map = new Map();
  const dirs = store.features?.positions?.directories ?? [];
  for (const dir of dirs) {
    for (const pos of dir?.positions ?? []) {
      if (pos?.id) {
        map.set(pos.id, [pos.department, pos.title].filter(Boolean).join(" · ") || pos.code || pos.id);
      }
    }
  }
  return map;
}

function readPointsStore(store) {
  const points = store.features?.points ?? {};
  return {
    balances: points.balances ?? {},
    ledger: Array.isArray(points.ledger) ? points.ledger : [],
    rules: {
      submitAttempt: Number.isInteger(points.rules?.submitAttempt) ? points.rules.submitAttempt : 5,
      approvedCorrection: Number.isInteger(points.rules?.approvedCorrection) ? points.rules.approvedCorrection : 20,
      featuredComment: Number.isInteger(points.rules?.featuredComment) ? points.rules.featuredComment : 10,
    },
  };
}

function writablePointsStore(store) {
  store.features ??= {};
  const points = (store.features.points ??= {});
  points.balances ??= {};
  points.ledger ??= [];
  points.rules ??= { submitAttempt: 5, approvedCorrection: 20, featuredComment: 10 };
  return points;
}

function readDiscussionSettings(store) {
  const raw = store.features?.discussions?.settings;
  return {
    mode: VALID_MODES.has(raw?.mode) ? raw.mode : "auto",
    blockedKeywords: normalizeKeywords(raw?.blockedKeywords),
  };
}

function collectUsers(store) {
  const users = new Map();
  const positionLabels = positionLabelMap(store);
  const points = readPointsStore(store);
  const userStates = store.features?.users ?? {};

  const ensure = (id) => {
    if (!id || typeof id !== "string") return null;
    let record = users.get(id);
    if (!record) {
      const state = userStates[id] ?? {};
      record = {
        userId: id,
        nickname: state.nickname || "",
        positionId: null,
        positionLabel: "",
        attemptCount: 0,
        bestScoreCents: null,
        totalScoreCents: 0,
        scoredCount: 0,
        commentCount: 0,
        pointsBalance: Number(points.balances[id] ?? 0) || 0,
        muted: Boolean(state.muted),
        muteReason: state.muteReason || "",
        mutedAt: state.mutedAt || null,
        firstSeenAt: state.createdAt || null,
        lastActiveAt: state.updatedAt || null,
        sources: new Set(),
      };
      users.set(id, record);
    }
    return record;
  };

  const touch = (record, ts) => {
    if (!Number.isFinite(ts) || ts <= 0) return;
    if (!record.firstSeenAt || ts < record.firstSeenAt) record.firstSeenAt = ts;
    if (!record.lastActiveAt || ts > record.lastActiveAt) record.lastActiveAt = ts;
  };

  // 1. 从真实答卷回执聚合
  for (const [key, receipt] of Object.entries(store.receipts ?? {})) {
    if (!receipt || receipt.isSample) continue;
    const sep = key.indexOf(":");
    const guestId = sep > 0 ? key.slice(0, sep) : "";
    const record = ensure(guestId);
    if (!record) continue;
    record.sources.add("practice");
    record.attemptCount += 1;
    const cents = receipt.report?.totalCents;
    if (Number.isFinite(cents)) {
      record.totalScoreCents += cents;
      record.scoredCount += 1;
      if (record.bestScoreCents === null || cents > record.bestScoreCents) {
        record.bestScoreCents = cents;
      }
    }
    touch(record, receipt.createdAt);
  }

  // 2. 从选岗与榜单成员聚合
  for (const [guestId, member] of Object.entries(store.features?.positions?.members ?? {})) {
    const record = ensure(guestId);
    if (!record) continue;
    record.sources.add("rank");
    if (member?.name && !record.nickname) record.nickname = member.name;
    if (member?.positionId) {
      record.positionId = member.positionId;
      record.positionLabel = positionLabels.get(member.positionId) || member.positionId;
    }
    touch(record, member?.updatedAt);
  }

  // 3. 从评论记录聚合
  for (const comment of store.features?.discussions?.comments ?? []) {
    const record = ensure(comment?.guestId);
    if (!record) continue;
    record.sources.add("discussion");
    record.commentCount += 1;
    if (comment.author?.name) record.nickname = comment.author.name;
    touch(record, comment.createdAt);
  }

  // 4. 从积分账户与显式用户记录聚合
  for (const userId of new Set([...Object.keys(points.balances), ...Object.keys(userStates)])) {
    const record = ensure(userId);
    if (record) record.sources.add("points");
  }

  return [...users.values()]
    .map((item) => ({
      userId: item.userId,
      nickname: item.nickname || `卷友 ${item.userId.slice(-4)}`,
      positionId: item.positionId,
      positionLabel: item.positionLabel,
      attemptCount: item.attemptCount,
      bestScoreCents: item.bestScoreCents,
      avgScoreCents: item.scoredCount ? Math.round(item.totalScoreCents / item.scoredCount) : null,
      commentCount: item.commentCount,
      pointsBalance: item.pointsBalance,
      muted: item.muted,
      muteReason: item.muteReason,
      mutedAt: item.mutedAt,
      firstSeenAt: item.firstSeenAt,
      lastActiveAt: item.lastActiveAt,
      sources: [...item.sources],
    }))
    .sort((a, b) => (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0));
}

function applyPointsDelta(store, { userId, delta, type, reason, operator, nickname }) {
  const points = writablePointsStore(store);
  const current = Number(points.balances[userId] ?? 0) || 0;
  const next = current + delta;
  if (next < 0) fail(400, `用户 ${nickname || userId} 当前积分 ${current}，不足以扣减 ${Math.abs(delta)}。`);
  points.balances[userId] = next;
  const entry = {
    id: randomUUID(),
    userId,
    nickname: nickname || `卷友 ${userId.slice(-4)}`,
    delta,
    balanceAfter: next,
    type,
    reason,
    operator,
    createdAt: Date.now(),
  };
  points.ledger.unshift(entry);
  if (points.ledger.length > 5000) points.ledger.length = 5000;
  return entry;
}

export function createAdminConsoleService({
  readCatalog,
  mutateCatalog,
  moderation = createWechatModeration(),
  env = process.env,
  localCliBypass = false,
  failDelayMs = 350,
  toolCredits,
  feedbackService,
}) {
  const feedbackSvc = feedbackService ?? createFeedbackService({ readCatalog, mutateCatalog }, { env });
  const sessions = new Map();
  const ipFailures = new Map();
  const accountFailures = new Map();

  function pruneSessions() {
    const now = Date.now();
    for (const [token, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(token);
    }
  }

  function currentSession(request) {
    pruneSessions();
    const header = request?.headers?.authorization ?? "";
    const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    const cookies = parseCookies(request?.headers?.cookie ?? "");
    const token = bearer || cookies[SESSION_COOKIE] || "";
    if (!token) return null;
    const session = sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return null;
    }
    return { token, ...session };
  }

  function requireSession(request) {
    if (localCliBypass) return { token: "cli", username: "cli", createdAt: Date.now() };
    const session = currentSession(request);
    if (!session) fail(401, "请先登录运营后台。");
    return session;
  }

  const adminBasePath = resolveAdminBasePath(env);
  const customAdminPath = adminBasePath !== "/admin";
  const apiPrefix = `${adminBasePath}/api/`;

  function setSessionCookie(request, response, token, maxAgeSeconds) {
    const forwardedProto = String(request?.headers?.["x-forwarded-proto"] || "").toLowerCase();
    const isHttps = forwardedProto === "https" || env.ROLLIERANK_COOKIE_SECURE === "1";
    const secure = isHttps ? "; Secure" : "";
    const cookiePath = customAdminPath ? `${adminBasePath}/` : "/";
    const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=${cookiePath}; Max-Age=${maxAgeSeconds}${secure}`;
    response.setHeader("Set-Cookie", cookie);
  }

  function setSecurityHeaders(response) {
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Robots-Tag", "noindex, nofollow");
  }

  function checkRateLimit(bucket, key, label) {
    const now = Date.now();
    const entry = bucket.get(key);
    if (!entry) return;
    if (entry.lockedUntil && entry.lockedUntil > now) {
      const waitSec = Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000));
      const waitMin = Math.max(1, Math.ceil(waitSec / 60));
      fail(429, `${label}尝试失败次数过多，请在 ${waitMin} 分钟后再试。`, waitSec);
    }
    if (now - entry.windowStart > LOGIN_WINDOW_MS) {
      bucket.delete(key);
    }
  }

  function recordFailure(bucket, key, threshold, lockMs, hardThreshold = Infinity, hardLockMs = lockMs) {
    const now = Date.now();
    const entry = bucket.get(key);
    let next;
    if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
      next = { count: 1, windowStart: now, lockedUntil: 0 };
    } else {
      next = { ...entry, count: entry.count + 1 };
    }
    if (next.count >= hardThreshold) {
      next.lockedUntil = now + hardLockMs;
    } else if (next.count >= threshold) {
      next.lockedUntil = now + lockMs;
    }
    bucket.set(key, next);
    return next;
  }

  function checkAuthRateLimits(ip, account) {
    checkRateLimit(ipFailures, ip, "当前网络");
    if (account) checkRateLimit(accountFailures, account.toLowerCase(), "该账号");
  }

  async function penalizeFailure(ip, account) {
    const ipState = recordFailure(ipFailures, ip, IP_LOCK_THRESHOLD, IP_LOCK_MS, IP_HARD_LOCK_THRESHOLD, IP_HARD_LOCK_MS);
    const accState = account ? recordFailure(accountFailures, account.toLowerCase(), ACCOUNT_LOCK_THRESHOLD, ACCOUNT_LOCK_MS) : null;
    const step = Math.max(ipState.count, accState?.count ?? 0);
    await sleep(Math.min(1200, step * failDelayMs));
    return { ipLocked: ipState.lockedUntil > Date.now(), ipCount: ipState.count };
  }

  return async function handle({ request, response, pathname, method, input, query, send }) {
    // 公开的个人积分查询（供前台/小程序查询本人积分）
    if (pathname === "/api/points/me") {
      if (method !== "GET") { send(405, { error: "此接口仅支持 GET。" }); return true; }
      const guestId = query.get("guestId") || "";
      if (!/^[\w-]{10,80}$/.test(guestId)) fail(400, "身份凭证无效。");
      const store = await readCatalog();
      const points = readPointsStore(store);
      const balance = Number(points.balances[guestId] ?? 0) || 0;
      const records = points.ledger
        .filter((item) => item.userId === guestId)
        .slice(0, 50)
        .map(({ id, delta, balanceAfter, type, reason, createdAt }) => ({
          id, delta, balanceAfter, type, reason, createdAt,
        }));
      send(200, { balance, records, rules: points.rules });
      return true;
    }

    let sub = "";
    if (pathname.startsWith(apiPrefix)) {
      sub = pathname.slice(apiPrefix.length);
    } else if (!customAdminPath && pathname.startsWith("/api/console/")) {
      sub = pathname.slice("/api/console/".length);
    } else {
      return false;
    }
    setSecurityHeaders(response);

    // 1. 会话检查
    if (sub === "session") {
      if (method !== "GET") { send(405, { error: "仅支持 GET。" }); return true; }
      const session = currentSession(request);
      const store = await readCatalog();
      const auth = readAdminAuth(store, env);
      send(200, {
        authenticated: Boolean(session),
        needsSetup: !auth,
        authSource: auth?.source ?? null,
        user: session ? { username: session.username, role: "超级管理员", loginAt: session.createdAt } : null,
        wechatSecEnabled: moderation.isEnabled(),
        mediaCallbackReady: moderation.isMediaCallbackReady(),
      });
      return true;
    }

    // 1.5 首次初始化管理员账号与密码（持久化加盐哈希到数据库，仅允许未初始化时执行一次）
    if (sub === "setup") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      const clientIp = resolveClientIp(request);
      checkAuthRateLimits(clientIp, "__setup__");
      const username = typeof input.username === "string" ? input.username.trim() : "";
      const password = typeof input.password === "string" ? input.password : "";
      const confirmPassword = input.confirmPassword !== undefined ? String(input.confirmPassword) : password;
      if (!USERNAME_RE.test(username)) fail(400, "管理员账号须为 3–32 位字母、数字、点、下划线或连字符。");
      validatePasswordStrength(password);
      if (password !== confirmPassword) fail(400, "两次输入的密码不一致。");

      const now = Date.now();
      await mutateCatalog((store) => {
        if (readAdminAuth(store, env)) {
          fail(409, "管理员密码已设置，请直接登录。");
        }
        const { salt, hash } = hashPassword(password);
        store.features ??= {};
        store.features.adminAuth = {
          username,
          passwordHash: hash,
          salt,
          createdAt: now,
          updatedAt: now,
        };
        appendAudit(store, "初始化管理员账号", `账号 ${username}`, username);
      });

      ipFailures.delete(clientIp);
      accountFailures.delete("__setup__");
      const token = randomBytes(32).toString("hex");
      sessions.set(token, { username, createdAt: now, expiresAt: now + SESSION_TTL_MS });
      setSessionCookie(request, response, token, Math.floor(SESSION_TTL_MS / 1000));
      send(200, {
        authenticated: true,
        needsSetup: false,
        token,
        user: { username, role: "超级管理员", loginAt: now },
      });
      return true;
    }

    // 2. 管理员登录
    if (sub === "login") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      const clientIp = resolveClientIp(request);
      const username = typeof input.username === "string" ? input.username.trim() : "";
      const password = typeof input.password === "string" ? input.password : "";
      checkAuthRateLimits(clientIp, username);
      const store = await readCatalog();
      const auth = readAdminAuth(store, env);
      if (!auth) fail(409, "尚未设置管理员密码，请先完成首次初始化。");
      const userMatches = safeEqual(username, auth.username);
      const passMatches = auth.source === "db"
        ? verifyStoredPassword(password, auth.record)
        : safeEqual(password, auth.password);
      if (!userMatches || !passMatches) {
        const penalty = await penalizeFailure(clientIp, username || auth.username);
        if (penalty.ipLocked) {
          await mutateCatalog((current) => {
            appendAudit(current, "防爆破锁定", `IP ${clientIp} 连续失败 ${penalty.ipCount} 次`, "system");
          }).catch(() => {});
        }
        fail(401, "管理员账号或密码错误。");
      }
      ipFailures.delete(clientIp);
      accountFailures.delete(username.toLowerCase());
      const token = randomBytes(32).toString("hex");
      const now = Date.now();
      sessions.set(token, { username: auth.username, createdAt: now, expiresAt: now + SESSION_TTL_MS });
      setSessionCookie(request, response, token, Math.floor(SESSION_TTL_MS / 1000));
      await mutateCatalog((current) => {
        appendAudit(current, "管理员登录", `账号 ${auth.username}（${clientIp}）`, auth.username);
      });
      send(200, {
        authenticated: true,
        needsSetup: false,
        token,
        user: { username: auth.username, role: "超级管理员", loginAt: now },
      });
      return true;
    }

    // 3. 管理员登出
    if (sub === "logout") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      const session = currentSession(request);
      if (session) sessions.delete(session.token);
      setSessionCookie(request, response, "", 0);
      send(200, { ok: true });
      return true;
    }

    // 以下接口均要求已登录
    const session = requireSession(request);
    if (sub.startsWith("tool-credits") && await toolCredits?.handleAdmin({ sub, method, input, query, send, session })) return true;

    // 3.5 修改管理员密码（校验旧密码后写入数据库加盐哈希，并撤销其他旧会话）
    if (sub === "password") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      const currentPassword = typeof input.currentPassword === "string" ? input.currentPassword : "";
      const newPassword = typeof input.newPassword === "string" ? input.newPassword : "";
      const confirmPassword = input.confirmPassword !== undefined ? String(input.confirmPassword) : newPassword;
      validatePasswordStrength(newPassword);
      if (newPassword !== confirmPassword) fail(400, "两次输入的新密码不一致。");

      await mutateCatalog((store) => {
        const auth = readAdminAuth(store, env);
        if (!auth) fail(409, "尚未初始化管理员账号。");
        const validCurrent = auth.source === "db"
          ? verifyStoredPassword(currentPassword, auth.record)
          : safeEqual(currentPassword, auth.password);
        if (!validCurrent) fail(401, "当前密码不正确。");
        const { salt, hash } = hashPassword(newPassword);
        const now = Date.now();
        store.features ??= {};
        store.features.adminAuth = {
          username: auth.username,
          passwordHash: hash,
          salt,
          createdAt: store.features.adminAuth?.createdAt ?? now,
          updatedAt: now,
        };
        appendAudit(store, "修改管理员密码", `账号 ${auth.username}`, session.username);
      });

      for (const [tokenKey] of sessions) {
        if (tokenKey !== session.token) sessions.delete(tokenKey);
      }
      send(200, { ok: true });
      return true;
    }

    // 4. 运营总览 Dashboard
    if (sub === "overview") {
      if (method !== "GET") { send(405, { error: "仅支持 GET。" }); return true; }
      const store = await readCatalog();
      const users = collectUsers(store);
      const receipts = Object.values(store.receipts ?? {}).filter((r) => r && !r.isSample);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayTs = startOfToday.getTime();
      const todayAttempts = receipts.filter((r) => (r.createdAt ?? 0) >= todayTs).length;
      const comments = store.features?.discussions?.comments ?? [];
      const queueComments = comments.filter(isInReviewQueue);
      const blockedCount = (store.features?.discussions?.blockedLog ?? []).length;
      const feedbacks = store.features?.corrections?.feedbacks ?? [];
      const pendingFeedbacks = feedbacks.filter((fb) => fb.items?.some((item) => item.status === "pending"));
      const points = readPointsStore(store);
      const totalPointsBalance = Object.values(points.balances).reduce((sum, v) => sum + (Number(v) || 0), 0);
      const totalPointsIssued = points.ledger.filter((l) => l.delta > 0).reduce((sum, l) => sum + l.delta, 0);
      const publishedVersions = (store.versions ?? []).filter((v) => v.status === "published").length;

      // 热门套卷排行
      const paperStats = new Map();
      for (const receipt of receipts) {
        const key = receipt.paperTitle || receipt.paperId || receipt.versionId;
        const row = paperStats.get(key) ?? { title: key, institution: receipt.institution || "", attempts: 0, totalCents: 0 };
        row.attempts += 1;
        row.totalCents += receipt.report?.totalCents ?? 0;
        paperStats.set(key, row);
      }
      const topPapers = [...paperStats.values()]
        .sort((a, b) => b.attempts - a.attempts)
        .slice(0, 6)
        .map((row) => ({
          title: row.title,
          institution: row.institution,
          attempts: row.attempts,
          avgCents: row.attempts ? Math.round(row.totalCents / row.attempts) : 0,
        }));

      const titles = paperTitleMap(store);
      const userFeedbackSummary = feedbackSvc.summarize(store);
      const userFeedbackNotify = feedbackSvc.buildNotifyView(store);
      send(200, {
        metrics: {
          totalUsers: users.length,
          mutedUsers: users.filter((u) => u.muted).length,
          totalAttempts: receipts.length,
          todayAttempts,
          publishedVersions,
          totalVersions: (store.versions ?? []).length,
          totalComments: comments.length,
          pendingComments: queueComments.length,
          blockedComments: blockedCount,
          pendingCorrections: pendingFeedbacks.length,
          totalFeedbacks: userFeedbackSummary.total,
          pendingFeedbacks: userFeedbackSummary.pending,
          totalPointsBalance,
          totalPointsIssued,
        },
        feedbackNotify: {
          enabled: userFeedbackNotify.enabled,
          wechatReady: userFeedbackNotify.wechatReady,
          templateConfigured: userFeedbackNotify.templateConfigured,
          subscriberCount: userFeedbackNotify.subscriberCount,
          totalQuota: userFeedbackNotify.totalQuota,
        },
        security: {
          wechatSecEnabled: moderation.isEnabled(),
          mediaCallbackReady: moderation.isMediaCallbackReady(),
          callbackTokenConfigured: moderation.isCallbackTokenConfigured(),
          commentMode: readDiscussionSettings(store).mode,
          keywordCount: readDiscussionSettings(store).blockedKeywords.length,
        },
        topPapers,
        recentQueue: queueComments.slice(0, 5).map((c) => ({
          id: c.id,
          author: c.author?.name || "卷友",
          paperTitle: titles.get(c.paperId) || c.paperId,
          text: (c.text || "").slice(0, 80),
          status: commentStatus(c),
          reason: c.moderation?.reason || "",
          createdAt: c.createdAt,
        })),
        recentAudit: (store.audit ?? []).slice(0, 10),
      });
      return true;
    }

    // 5. 用户列表
    if (sub === "users") {
      if (method !== "GET") { send(405, { error: "仅支持 GET。" }); return true; }
      const store = await readCatalog();
      const q = (query.get("q") || "").trim().toLocaleLowerCase("zh-CN");
      const status = query.get("status") || "all";
      const page = Math.max(1, Number.parseInt(query.get("page") || "1", 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.get("pageSize") || "20", 10) || 20));
      const all = collectUsers(store);
      const filtered = all.filter((u) => {
        if (status === "muted" && !u.muted) return false;
        if (status === "active" && u.muted) return false;
        if (status === "with-points" && u.pointsBalance <= 0) return false;
        if (q) {
          const hay = [u.nickname, u.userId, u.positionLabel].join(" ").toLocaleLowerCase("zh-CN");
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
      const current = Math.min(page, pages);
      send(200, {
        summary: {
          total: all.length,
          muted: all.filter((u) => u.muted).length,
          withPoints: all.filter((u) => u.pointsBalance > 0).length,
          totalPoints: all.reduce((sum, u) => sum + u.pointsBalance, 0),
        },
        users: filtered.slice((current - 1) * pageSize, current * pageSize),
        total: filtered.length,
        page: current,
        pageSize,
        pages,
      });
      return true;
    }

    // 6. 用户详情
    if (sub === "users/detail") {
      if (method !== "GET") { send(405, { error: "仅支持 GET。" }); return true; }
      const userId = query.get("userId") || "";
      if (!userId) fail(400, "缺少用户标识。");
      const store = await readCatalog();
      const user = collectUsers(store).find((u) => u.userId === userId);
      if (!user) fail(404, "找不到该用户。");
      const attempts = Object.entries(store.receipts ?? {})
        .filter(([key, r]) => key.startsWith(`${userId}:`) && r && !r.isSample)
        .map(([, r]) => ({
          id: r.id,
          paperTitle: r.paperTitle,
          institution: r.institution,
          totalCents: r.report?.totalCents ?? 0,
          maxCents: r.report?.maxCents ?? 10000,
          correct: r.report?.correct ?? 0,
          wrong: r.report?.wrong ?? 0,
          blank: r.report?.blank ?? 0,
          createdAt: r.createdAt,
        }))
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .slice(0, 20);
      const titles = paperTitleMap(store);
      const comments = (store.features?.discussions?.comments ?? [])
        .filter((c) => c.guestId === userId)
        .slice(0, 20)
        .map((c) => ({
          id: c.id,
          paperTitle: titles.get(c.paperId) || c.paperId,
          text: c.text,
          status: commentStatus(c),
          imageCount: (c.images ?? []).length,
          createdAt: c.createdAt,
        }));
      const ledger = readPointsStore(store).ledger
        .filter((l) => l.userId === userId)
        .slice(0, 30);
      send(200, { user, attempts, comments, ledger });
      return true;
    }

    // 7. 用户禁言 / 解禁
    if (sub === "users/mute") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      const userId = typeof input.userId === "string" ? input.userId.trim() : "";
      if (!userId || userId.length > 100) fail(400, "用户标识无效。");
      const muted = Boolean(input.muted);
      const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 200) : "";
      const result = await mutateCatalog((store) => {
        store.features ??= {};
        store.features.users ??= {};
        const prev = store.features.users[userId] ?? {};
        store.features.users[userId] = {
          ...prev,
          muted,
          muteReason: muted ? reason : "",
          mutedAt: muted ? Date.now() : null,
          updatedAt: Date.now(),
        };
        appendAudit(
          store,
          muted ? "禁言用户" : "解除用户禁言",
          `${userId}${reason ? `（${reason}）` : ""}`,
          session.username,
        );
        return store.features.users[userId];
      });
      send(200, { ok: true, state: result });
      return true;
    }

    // 8. 积分管理总览与流水
    if (sub === "points") {
      if (method !== "GET") { send(405, { error: "仅支持 GET。" }); return true; }
      const store = await readCatalog();
      const points = readPointsStore(store);
      const q = (query.get("q") || "").trim().toLocaleLowerCase("zh-CN");
      const type = query.get("type") || "all";
      const page = Math.max(1, Number.parseInt(query.get("page") || "1", 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.get("pageSize") || "25", 10) || 25));
      const filtered = points.ledger.filter((entry) => {
        if (type !== "all" && entry.type !== type) return false;
        if (q) {
          const hay = [entry.nickname, entry.userId, entry.reason, entry.operator].join(" ").toLocaleLowerCase("zh-CN");
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
      const current = Math.min(page, pages);
      const totalIssued = points.ledger.filter((l) => l.delta > 0).reduce((sum, l) => sum + l.delta, 0);
      const totalDeducted = points.ledger.filter((l) => l.delta < 0).reduce((sum, l) => sum + Math.abs(l.delta), 0);
      const totalBalance = Object.values(points.balances).reduce((sum, v) => sum + (Number(v) || 0), 0);
      const holders = Object.values(points.balances).filter((v) => Number(v) > 0).length;
      send(200, {
        summary: { totalIssued, totalDeducted, totalBalance, holders, ledgerCount: points.ledger.length },
        rules: points.rules,
        ledger: filtered.slice((current - 1) * pageSize, current * pageSize),
        total: filtered.length,
        page: current,
        pageSize,
        pages,
      });
      return true;
    }

    // 9. 发放 / 扣减用户积分（支持单人与批量）
    if (sub === "points/grant") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      const rawIds = Array.isArray(input.userIds) ? input.userIds : (input.userId ? [input.userId] : []);
      const userIds = [...new Set(rawIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
      if (!userIds.length || userIds.length > 200) fail(400, "请选择 1–200 名目标用户。");
      const delta = Number(input.delta);
      if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100000) {
        fail(400, "积分变动须为非零整数（范围 -100000 至 100000）。");
      }
      const type = VALID_POINT_TYPES.has(input.type) ? input.type : (delta > 0 ? "reward" : "deduct");
      const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 200) : "";
      if (!reason) fail(400, "请填写积分变动原因。");

      const result = await mutateCatalog((store) => {
        const userMap = new Map(collectUsers(store).map((u) => [u.userId, u]));
        const entries = [];
        for (const uid of userIds) {
          const user = userMap.get(uid);
          const entry = applyPointsDelta(store, {
            userId: uid,
            delta,
            type,
            reason,
            operator: session.username,
            nickname: user?.nickname || `卷友 ${uid.slice(-4)}`,
          });
          entries.push(entry);
        }
        appendAudit(
          store,
          delta > 0 ? "发放用户积分" : "扣减用户积分",
          `${userIds.length} 人 · ${delta > 0 ? "+" : ""}${delta} 积分（${reason}）`,
          session.username,
        );
        return { entries };
      });
      send(200, { ok: true, count: result.entries.length, entries: result.entries });
      return true;
    }

    // 10. 更新积分规则
    if (sub === "points/rules") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      const submitAttempt = Number(input.submitAttempt);
      const approvedCorrection = Number(input.approvedCorrection);
      const featuredComment = Number(input.featuredComment);
      for (const [label, value] of [["交卷奖励", submitAttempt], ["纠错采纳奖励", approvedCorrection], ["精选评论奖励", featuredComment]]) {
        if (!Number.isInteger(value) || value < 0 || value > 10000) fail(400, `${label}应为 0–10000 的整数。`);
      }
      const rules = await mutateCatalog((store) => {
        const points = writablePointsStore(store);
        points.rules = { submitAttempt, approvedCorrection, featuredComment };
        appendAudit(
          store,
          "更新积分规则",
          `交卷 +${submitAttempt} / 纠错 +${approvedCorrection} / 评论 +${featuredComment}`,
          session.username,
        );
        return points.rules;
      });
      send(200, { ok: true, rules });
      return true;
    }

    // 11. 评论审查列表
    if (sub === "comments") {
      if (method !== "GET") { send(405, { error: "仅支持 GET。" }); return true; }
      const store = await readCatalog();
      const titles = paperTitleMap(store);
      const filter = VALID_COMMENT_FILTERS.has(query.get("status")) ? query.get("status") : "queue";
      const q = (query.get("q") || "").trim().toLocaleLowerCase("zh-CN");
      const page = Math.max(1, Number.parseInt(query.get("page") || "1", 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.get("pageSize") || "20", 10) || 20));
      const all = store.features?.discussions?.comments ?? [];
      const userStates = store.features?.users ?? {};
      const filtered = all.filter((comment) => {
        const status = commentStatus(comment);
        if (filter === "queue" && !isInReviewQueue(comment)) return false;
        if (filter !== "all" && filter !== "queue" && status !== filter) return false;
        if (q) {
          const hay = [
            comment.text,
            comment.author?.name,
            comment.guestId,
            titles.get(comment.paperId),
            comment.moderation?.reason,
            ...(comment.links ?? []),
          ].filter(Boolean).join(" ").toLocaleLowerCase("zh-CN");
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
      const current = Math.min(page, pages);
      const slice = filtered.slice((current - 1) * pageSize, current * pageSize).map((c) => ({
        id: c.id,
        userId: c.guestId,
        userMuted: Boolean(userStates[c.guestId]?.muted),
        paperId: c.paperId,
        paperTitle: titles.get(c.paperId) ?? c.paperId,
        parentId: c.parentId ?? null,
        replyTo: c.replyTo ?? null,
        author: c.author,
        text: c.text ?? "",
        links: c.links ?? [],
        images: (c.images ?? []).map((img) => ({
          ...img,
          dataUri: img.url || img.dataUri || "",
        })),
        audio: c.audio ?? null,
        likeCount: Array.isArray(c.likedBy) ? new Set(c.likedBy).size : 0,
        createdAt: c.createdAt,
        moderation: {
          status: commentStatus(c),
          source: c.moderation?.source ?? "auto",
          reason: c.moderation?.reason ?? "",
          labels: Array.isArray(c.moderation?.labels) ? c.moderation.labels : [],
          traces: Array.isArray(c.moderation?.traces) ? c.moderation.traces : [],
          reviewedAt: c.moderation?.reviewedAt ?? null,
        },
        reportCount: Array.isArray(c.reports) ? c.reports.length : 0,
        reports: Array.isArray(c.reports) ? c.reports.map(({ reason, createdAt }) => ({ reason, createdAt })) : [],
      }));
      send(200, {
        summary: {
          total: all.length,
          queue: all.filter(isInReviewQueue).length,
          approved: all.filter((c) => commentStatus(c) === "approved").length,
          rejected: all.filter((c) => commentStatus(c) === "rejected").length,
          blocked: (store.features?.discussions?.blockedLog ?? []).length,
          wechatSecEnabled: moderation.isEnabled(),
          mediaCallbackReady: moderation.isMediaCallbackReady(),
        },
        settings: readDiscussionSettings(store),
        comments: slice,
        blockedLog: structuredClone((store.features?.discussions?.blockedLog ?? []).slice(0, 30)),
        total: filtered.length,
        page: current,
        pageSize,
        pages,
      });
      return true;
    }

    // 12. 评论审查处理（通过 / 屏蔽 / 删除，可选附带奖励积分或禁言）
    if (sub === "comments/review") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      const action = input.action;
      if (!["approve", "reject", "delete"].includes(action)) fail(400, "无效的评论操作。");
      const rawIds = Array.isArray(input.commentIds) ? input.commentIds : (input.commentId ? [input.commentId] : []);
      const ids = [...new Set(rawIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
      if (!ids.length || ids.length > 100) fail(400, "请选择要处理的评论。");
      const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 300) : "";
      const rewardPoints = Number.isInteger(input.rewardPoints) && input.rewardPoints > 0 && input.rewardPoints <= 1000 ? input.rewardPoints : 0;
      const muteAuthor = Boolean(input.muteAuthor);

      const idSet = new Set(ids);
      let keysToDelete = [];
      const outcome = await mutateCatalog((store) => {
        store.features ??= {};
        const section = (store.features.discussions ??= { comments: [] });
        section.comments ??= [];
        const targets = section.comments.filter((c) => idSet.has(c.id));
        if (!targets.length) fail(404, "找不到目标评论。");
        const now = Date.now();
        if (action === "delete" || action === "reject") {
          if (action === "reject" && muteAuthor) {
            for (const comment of targets) {
              if (!comment.guestId) continue;
              store.features.users ??= {};
              store.features.users[comment.guestId] = {
                ...(store.features.users[comment.guestId] ?? {}),
                muted: true,
                muteReason: reason || "发布违规评论",
                mutedAt: now,
                updatedAt: now,
              };
            }
          }
          const removedRoots = new Set(targets.filter((c) => !c.parentId).map((c) => c.id));
          const removed = section.comments.filter((c) => idSet.has(c.id) || removedRoots.has(c.rootId ?? c.id));
          keysToDelete = removed.flatMap((c) => (c.images ?? []).map((img) => img?.key).filter(Boolean));
          section.comments = section.comments.filter((c) => !idSet.has(c.id) && !removedRoots.has(c.rootId ?? c.id));
          appendAudit(
            store,
            action === "reject" ? "拒绝并清除评论" : "删除评论",
            `${targets.length} 条${muteAuthor ? " · 已禁言作者" : ""}${reason ? `（${reason}）` : ""}`,
            session.username,
          );
          return { processed: targets.length };
        }
        for (const comment of targets) {
          const prev = comment.moderation ?? {};
          comment.moderation = {
            ...prev,
            status: "approved",
            source: "manual",
            reason: reason || "管理员审核通过",
            labels: Array.isArray(prev.labels) ? prev.labels : [],
            traces: Array.isArray(prev.traces) ? prev.traces : [],
            reviewedAt: now,
            requireManualApproval: false,
          };
          if (Array.isArray(comment.reports)) comment.reports = [];
          if (rewardPoints > 0 && comment.guestId) {
            applyPointsDelta(store, {
              userId: comment.guestId,
              delta: rewardPoints,
              type: "comment",
              reason: reason || "优质评论奖励",
              operator: session.username,
              nickname: comment.author?.name,
            });
          }
        }
        appendAudit(
          store,
          "评论审核通过",
          `${targets.length} 条${rewardPoints ? ` · 奖励 +${rewardPoints} 积分` : ""}`,
          session.username,
        );
        return { processed: targets.length };
      });
      if (keysToDelete.length) {
        const oss = createQiniuStorage({ config: readQiniuConfig(env) });
        await Promise.allSettled(keysToDelete.map((key) => oss.deleteObject(key)));
      }
      send(200, { ok: true, ...outcome });
      return true;
    }

    // 13. 评论审核策略设置
    if (sub === "comments/settings") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      if (input.mode !== undefined && !VALID_MODES.has(input.mode)) fail(400, "审核模式无效。");
      const settings = await mutateCatalog((store) => {
        store.features ??= {};
        const section = (store.features.discussions ??= { comments: [] });
        const cur = readDiscussionSettings(store);
        const next = {
          mode: input.mode ?? cur.mode,
          blockedKeywords: input.blockedKeywords !== undefined ? normalizeKeywords(input.blockedKeywords) : cur.blockedKeywords,
        };
        section.settings = next;
        appendAudit(
          store,
          "更新评论审核策略",
          `${next.mode === "manual" ? "先审后发" : "自动机审"} · 敏感词 ${next.blockedKeywords.length} 个`,
          session.username,
        );
        return next;
      });
      send(200, { ok: true, settings });
      return true;
    }

    // 14. 答案纠错工单列表
    if (sub === "corrections") {
      if (method !== "GET") { send(405, { error: "仅支持 GET。" }); return true; }
      const store = await readCatalog();
      const data = store.features?.corrections ?? { feedbacks: [], reviews: [], revisions: [] };
      const receipts = Object.values(store.receipts ?? {}).filter((r) => r && !r.isSample);
      const versionCounts = new Map();
      for (const r of receipts) {
        versionCounts.set(r.versionId, (versionCounts.get(r.versionId) ?? 0) + 1);
      }
      const feedbacks = data.feedbacks.map((fb) => {
        const version = (store.versions ?? []).find((v) => v.id === fb.versionId);
        const status = fb.items.every((i) => i.status === "pending") ? "pending"
          : fb.items.some((i) => i.status === "pending") ? "partial"
            : fb.items.every((i) => i.status === "approved") ? "approved"
              : fb.items.every((i) => i.status === "rejected") ? "rejected" : "mixed";
        return {
          ...fb,
          status,
          currentRevision: version?.answerRevision ?? 0,
          affectedAttempts: versionCounts.get(fb.versionId) ?? 0,
        };
      });
      send(200, {
        feedbacks,
        pendingCount: feedbacks.filter((fb) => fb.items.some((i) => i.status === "pending")).length,
        rules: readPointsStore(store).rules,
      });
      return true;
    }

    // 15. 答案纠错审批（自动重算受影响答卷 + 可选发放纠错积分奖励）
    if (sub === "corrections/review") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      const feedbackId = typeof input.feedbackId === "string" ? input.feedbackId.trim() : "";
      const decision = input.decision;
      const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 2000) : "";
      const questionNumbers = Array.isArray(input.questionNumbers)
        ? [...new Set(input.questionNumbers.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 300))].sort((a, b) => a - b)
        : [];
      const rewardPoints = Number.isInteger(input.rewardPoints) && input.rewardPoints > 0 && input.rewardPoints <= 1000 ? input.rewardPoints : 0;
      if (!feedbackId || !["approve", "reject"].includes(decision) || !questionNumbers.length || !reason) {
        fail(400, "请完整填写要处理的题号、结论和审核理由。");
      }
      const result = await mutateCatalog((store) => {
        const data = store.features?.corrections;
        const feedback = data?.feedbacks?.find((f) => f.id === feedbackId);
        if (!feedback) fail(404, "找不到这份答案反馈。");
        const version = store.versions.find((v) => v.id === feedback.versionId);
        if (!version) fail(404, "找不到对应套卷版本。");
        const items = questionNumbers.map((num) => {
          const item = feedback.items.find((i) => i.question === num);
          if (!item || item.status !== "pending") fail(409, `第 ${num} 题已处理或不存在。`);
          return item;
        });
        const now = Date.now();
        const reviewId = randomUUID();
        const fromRevision = version.answerRevision ?? 0;
        let toRevision = fromRevision;
        let recalculated = 0;
        if (decision === "approve") {
          for (const item of items) {
            if (!CHOICES.includes(item.suggestedAnswer)) fail(400, `第 ${item.question} 题答案无效。`);
            version.questions[item.question - 1].correctAnswer = item.suggestedAnswer;
          }
          toRevision = fromRevision + 1;
          version.answerRevision = toRevision;
          const attemptChanges = [];
          for (const [receiptKey, receipt] of Object.entries(store.receipts ?? {})) {
            if (!receipt || receipt.isSample || receipt.versionId !== version.id) continue;
            const before = receipt.report;
            const after = gradeVersion(version, receipt.answers);
            receipt.report = after;
            receipt.answerRevision = toRevision;
            recalculated += 1;
            attemptChanges.push({
              receiptKey,
              attemptId: receipt.id,
              before: { totalCents: before.totalCents, maxCents: before.maxCents, correct: before.correct, wrong: before.wrong, blank: before.blank },
              after: { totalCents: after.totalCents, maxCents: after.maxCents, correct: after.correct, wrong: after.wrong, blank: after.blank },
              deltaCents: after.totalCents - before.totalCents,
            });
          }
          data.revisions ??= [];
          data.revisions.unshift({
            id: randomUUID(),
            reviewId,
            feedbackId,
            versionId: version.id,
            paperTitle: version.title,
            versionLabel: version.versionLabel,
            fromRevision,
            toRevision,
            reason,
            createdAt: now,
            changes: items.map((i) => ({ question: i.question, beforeAnswer: i.originalAnswer, afterAnswer: i.suggestedAnswer })),
            attemptChanges,
          });
          if (rewardPoints > 0 && feedback.guestId) {
            applyPointsDelta(store, {
              userId: feedback.guestId,
              delta: rewardPoints,
              type: "correction",
              reason: `纠错采纳奖励（${version.title} 第 ${questionNumbers.join("、")} 题）`,
              operator: session.username,
            });
          }
        }
        for (const item of items) {
          item.status = decision === "approve" ? "approved" : "rejected";
          item.reason = reason;
          item.reviewedAt = now;
          item.reviewId = reviewId;
          if (decision === "approve") item.answerRevision = toRevision;
        }
        data.reviews ??= [];
        data.reviews.unshift({
          id: reviewId, feedbackId, versionId: version.id, decision,
          questionNumbers, reason, createdAt: now, fromRevision, toRevision,
        });
        appendAudit(
          store,
          decision === "approve" ? "通过答案纠错并重算" : "拒绝答案纠错",
          `${version.title} · 第 ${questionNumbers.join("、")} 题${recalculated ? `（重算 ${recalculated} 份答卷）` : ""}`,
          session.username,
        );
        return { recalculated, toRevision };
      });
      send(200, { ok: true, ...result });
      return true;
    }

    // 16. 套卷管理列表
    if (sub === "catalog") {
      if (method !== "GET") { send(405, { error: "仅支持 GET。" }); return true; }
      const store = await readCatalog();
      const q = (query.get("q") || "").trim().toLocaleLowerCase("zh-CN");
      const institution = query.get("institution") || "all";
      const status = query.get("status") || "all";
      const counts = new Map();
      for (const r of Object.values(store.receipts ?? {})) {
        if (!r || r.isSample) continue;
        counts.set(r.versionId, (counts.get(r.versionId) ?? 0) + 1);
      }
      const all = (store.versions ?? []).map((v) => ({
        ...publicVersion(v),
        attemptCount: counts.get(v.id) ?? 0,
        answerRevision: v.answerRevision ?? 0,
      }));
      const institutions = [...new Set(all.map((v) => v.institution).filter(Boolean))];
      const filtered = all.filter((v) => {
        if (institution !== "all" && v.institution !== institution) return false;
        if (status !== "all" && v.status !== status) return false;
        if (q) {
          const hay = [v.title, v.institution, v.project, v.period, v.variant].join(" ").toLocaleLowerCase("zh-CN");
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      send(200, { versions: filtered, institutions, total: filtered.length });
      return true;
    }

    // 17. 套卷上下线
    if (sub === "catalog/status") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      const versionId = typeof input.versionId === "string" ? input.versionId : "";
      const nextStatus = input.status;
      if (!["published", "offline"].includes(nextStatus)) fail(400, "状态无效。");
      const updated = await mutateCatalog((store) => {
        const version = store.versions.find((v) => v.id === versionId);
        if (!version) fail(404, "找不到该套卷版本。");
        validateQuestions(version.questions);
        if (nextStatus === "published") {
          const allRight = gradeVersion(version, version.questions.map((q) => q.correctAnswer));
          const allBlank = gradeVersion(version, version.questions.map(() => null));
          const mixedRaw = version.questions.reduce((n, q, idx) => n + (idx % 2 ? 0 : q.cents), 0);
          const rawMax = version.questions.reduce((n, q) => n + q.cents, 0);
          const mixed = gradeVersion(version, version.questions.map((q, idx) => (idx % 2 ? null : q.correctAnswer)));
          if (allRight.totalCents !== allRight.maxCents || allBlank.totalCents !== 0 || mixed.totalCents !== roundedScoreRatio(mixedRaw, rawMax, allRight.maxCents)) {
            fail(400, "整卷试算校验未通过，无法发布。");
          }
        }
        version.status = nextStatus;
        appendAudit(store, nextStatus === "published" ? "发布套卷" : "下线套卷", `${version.title} · v${version.versionLabel}`, session.username);
        return publicVersion(version);
      });
      send(200, { ok: true, version: updated });
      return true;
    }

    // 18. 导入新套卷（CSV）
    if (sub === "catalog/import") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      const questions = parseQuestionCsv(input.csv);
      for (const field of ["title", "institution", "project", "period", "variant"]) {
        if (typeof input[field] !== "string" || !input[field].trim() || input[field].length > 100) {
          fail(400, "请填写完整的套卷名称、机构、项目、期数和卷别。");
        }
      }
      const created = await mutateCatalog((store) => {
        const paperId = `custom-${randomUUID()}`;
        const version = {
          id: `${paperId}:v1.0`,
          paperId,
          number: store.versions.length + 1,
          title: input.title.trim(),
          institution: input.institution.trim(),
          project: input.project.trim(),
          period: input.period.trim(),
          variant: input.variant.trim(),
          versionLabel: "1.0",
          status: input.publishNow ? "published" : "draft",
          createdAt: Date.now(),
          questions,
        };
        store.versions.push(version);
        appendAudit(store, input.publishNow ? "导入并发布套卷" : "导入套卷草稿", `${version.title} · ${questions.length} 题`, session.username);
        return publicVersion(version);
      });
      send(200, { ok: true, version: created });
      return true;
    }

    // 19. 用户意见反馈与微信提醒
    if (sub === "feedback") {
      if (method !== "GET") { send(405, { error: "仅支持 GET。" }); return true; }
      const store = await readCatalog();
      const status = query.get("status") || "all";
      const q = query.get("q") || "";
      const page = Math.max(1, Number.parseInt(query.get("page") || "1", 10) || 1);
      const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.get("pageSize") || "30", 10) || 30));
      send(200, feedbackSvc.listForAdmin(store, { status, q, page, pageSize }));
      return true;
    }

    if (sub === "feedback/update") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      const feedback = await feedbackSvc.updateFeedback({
        feedbackId: input.feedbackId,
        status: input.status,
        replyText: input.replyText,
        operator: session.username,
      });
      send(200, { ok: true, feedback });
      return true;
    }

    if (sub === "feedback/delete") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      const result = await feedbackSvc.deleteFeedback({
        feedbackId: input.feedbackId,
        operator: session.username,
      });
      send(200, result);
      return true;
    }

    if (sub === "feedback/notify-settings") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      const notify = await feedbackSvc.updateNotifySettings(input, session.username);
      send(200, { ok: true, notify });
      return true;
    }

    if (sub === "feedback/subscribers/remove") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      const notify = await feedbackSvc.removeSubscriber({
        subscriberId: input.subscriberId,
        operator: session.username,
      });
      send(200, { ok: true, notify });
      return true;
    }

    if (sub === "feedback/notify-test") {
      if (method !== "POST") { send(405, { error: "仅支持 POST。" }); return true; }
      const result = await feedbackSvc.sendTestNotification({
        subscriberId: typeof input.subscriberId === "string" ? input.subscriberId : "",
      });
      send(200, { ok: result.sent > 0, ...result, notify: feedbackSvc.buildNotifyView(await readCatalog()) });
      return true;
    }

    // 20. 操作日志
    if (sub === "audit") {
      if (method !== "GET") { send(405, { error: "仅支持 GET。" }); return true; }
      const store = await readCatalog();
      const q = (query.get("q") || "").trim().toLocaleLowerCase("zh-CN");
      const all = store.audit ?? [];
      const filtered = q
        ? all.filter((row) => [row.action, row.target, row.operator].filter(Boolean).join(" ").toLocaleLowerCase("zh-CN").includes(q))
        : all;
      send(200, { items: filtered.slice(0, 100), total: filtered.length });
      return true;
    }

    send(404, { error: "后台接口不存在。" });
    return true;
  };
}
