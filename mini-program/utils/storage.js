// 本机存储与身份：只保存公开练习数据，不保存参考答案。
const { storageKey } = require("../config.js");

const KEYS = {
  guest: storageKey("rr:guest"),
  name: storageKey("rr:name"),
  avatar: storageKey("rr:avatar"),
  avatarUrl: storageKey("rr:avatar-url"),
  history: storageKey("rr:history"),
  draft: id => storageKey(`rr:draft:${id}`),
  marks: id => storageKey(`rr:marks:${id}`),
  position: storageKey("rr:position"),
  marksIndex: storageKey("rr:marks:index"),
  drafts: storageKey("rr:drafts"),
  creditToken: storageKey("rr:credit-token"),
  creditAccount: storageKey("rr:credit-account"),
  creditUid: storageKey("rr:credit-uid"),
  creditRecharge: id => storageKey(`rr:credit-recharge:${id}`),
  inviteClaim: storageKey("rr:invite-claim"),
};

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function guestId() {
  let id = wx.getStorageSync(KEYS.guest);
  if (!id || !/^[\w-]{10,80}$/.test(id)) {
    id = uuid();
    wx.setStorageSync(KEYS.guest, id);
  }
  return id;
}

function defaultNickname(id = guestId()) {
  const raw = String(id || "").trim();
  if (!raw) return "卷友";
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const code = 1000 + ((hash >>> 0) % 9000);
  return `卷友${code}`;
}

function isDefaultNickname(value) {
  const text = String(value || "").trim();
  return !text || text === "卷友" || /^卷友\d{4}$/.test(text);
}

function name() {
  const saved = String(wx.getStorageSync(KEYS.name) || "").trim();
  return !isDefaultNickname(saved) ? saved : defaultNickname(guestId());
}

function hasCustomName() {
  const saved = String(wx.getStorageSync(KEYS.name) || "").trim();
  return !isDefaultNickname(saved);
}

function setName(value) {
  const raw = String(value || "").trim().slice(0, 12);
  const text = !isDefaultNickname(raw) ? raw : defaultNickname(guestId());
  wx.setStorageSync(KEYS.name, text);
  return text;
}

function avatarId() {
  const id = wx.getStorageSync(KEYS.avatar);
  return typeof id === "string" && /^[a-f0-9]{48}$/.test(id) ? id : "";
}

function setAvatarId(id) {
  wx.setStorageSync(KEYS.avatar, id);
}

function avatarUrl() {
  const url = wx.getStorageSync(KEYS.avatarUrl);
  return typeof url === "string" && /^https?:\/\//i.test(url) ? url : "";
}

function setAvatarUrl(url) {
  const clean = typeof url === "string" && /^https?:\/\//i.test(url) ? url : "";
  wx.setStorageSync(KEYS.avatarUrl, clean);
  return clean;
}

function hasWechatProfile() {
  return Boolean(hasCustomName() || avatarId() || avatarUrl());
}

function history() {
  const list = wx.getStorageSync(KEYS.history);
  return Array.isArray(list) ? list : [];
}

function saveHistory(list) {
  wx.setStorageSync(KEYS.history, list.slice(0, 200));
}

function recordOf(attempt) {
  return {
    id: attempt.id,
    versionId: attempt.versionId,
    paperId: attempt.paperId,
    title: attempt.paperTitle,
    institution: attempt.institution,
    period: attempt.period,
    variant: attempt.variant,
    project: attempt.project,
    questionCount: attempt.answers.length,
    totalCents: attempt.report.totalCents,
    maxCents: attempt.report.maxCents,
    correct: attempt.report.correct,
    wrong: attempt.report.wrong,
    blank: attempt.report.blank,
    rate: attempt.report.rate,
    createdAt: attempt.createdAt,
    timing: attempt.timing || null,
    // 题型得分率与题数随快照保存，成长分析与离线报告不需要再次联网。
    subjects: (attempt.report.breakdown || []).map(type => ({
      name: type.name,
      centsEarned: type.centsEarned,
      maxCents: type.maxCents,
      count: type.count,
      correct: type.correct,
    })),
  };
}

function upsertAttempt(attempt) {
  const list = history();
  const index = list.findIndex(item => item.id === attempt.id);
  const record = recordOf(attempt);
  if (index >= 0) list[index] = record;
  else list.unshift(record);
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  saveHistory(list);
  return record;
}

function getAttempt(id) {
  return history().find(item => item.id === id) || null;
}

function saveDraft(versionId, draft) {
  wx.setStorageSync(KEYS.draft(versionId), { ...draft, updatedAt: Date.now() });
}

function loadDraft(versionId) {
  const value = wx.getStorageSync(KEYS.draft(versionId));
  return value && typeof value === "object" ? value : null;
}

function dropDraft(versionId) {
  wx.removeStorageSync(KEYS.draft(versionId));
}

function position() {
  const value = wx.getStorageSync(KEYS.position);
  return value && typeof value === "object" ? value : null;
}

function setPosition(value) {
  if (value) wx.setStorageSync(KEYS.position, value);
  else wx.removeStorageSync(KEYS.position);
}

// 当前录入中的草稿索引，供套卷卡直接续录。
function draftIndex() {
  const index = wx.getStorageSync(KEYS.drafts) || {};
  return index && typeof index === "object" ? index : {};
}

function setDraftEntry(versionId, entry) {
  const index = draftIndex();
  if (entry) index[versionId] = { ...entry, updatedAt: Date.now() };
  else delete index[versionId];
  wx.setStorageSync(KEYS.drafts, index);
}

function bestAttempt(versionId) {
  return history()
    .filter(record => record.versionId === versionId)
    .sort((a, b) => (b.maxCents ? b.totalCents / b.maxCents : 0) - (a.maxCents ? a.totalCents / a.maxCents : 0))[0] || null;
}

function pendingId(key) {
  const index = wx.getStorageSync(KEYS.marksIndex) || {};
  if (index[key]) return index[key];
  index[key] = uuid();
  wx.setStorageSync(KEYS.marksIndex, index);
  return index[key];
}

function clearPendingId(versionId, attemptId) {
  const index = wx.getStorageSync(KEYS.marksIndex) || {};
  if (index[versionId] !== attemptId) return;
  delete index[versionId];
  wx.setStorageSync(KEYS.marksIndex, index);
}

function toolCreditToken() {
  const token = wx.getStorageSync(KEYS.creditToken);
  return typeof token === "string" && /^[a-f0-9]{64}$/i.test(token) ? token : "";
}

function setToolCreditToken(token) {
  if (typeof token === "string" && /^[a-f0-9]{64}$/i.test(token)) {
    wx.setStorageSync(KEYS.creditToken, token);
  } else {
    wx.removeStorageSync(KEYS.creditToken);
  }
}

function toolCreditAccountId() {
  const id = wx.getStorageSync(KEYS.creditAccount);
  return typeof id === "string" && /^[\w-]{10,80}$/.test(id) ? id : "";
}

function setToolCreditAccountId(id) {
  if (typeof id === "string" && /^[\w-]{10,80}$/.test(id)) {
    wx.setStorageSync(KEYS.creditAccount, id);
  } else {
    wx.removeStorageSync(KEYS.creditAccount);
  }
}

function toolCreditUid() {
  const uid = Number(wx.getStorageSync(KEYS.creditUid));
  return Number.isInteger(uid) && uid >= 10000 ? uid : 0;
}

function setToolCreditUid(uid) {
  const num = Number(uid);
  if (Number.isInteger(num) && num >= 10000) {
    wx.setStorageSync(KEYS.creditUid, num);
  } else {
    wx.removeStorageSync(KEYS.creditUid);
  }
}

function clearToolCreditSession() {
  wx.removeStorageSync(KEYS.creditToken);
  wx.removeStorageSync(KEYS.creditAccount);
  wx.removeStorageSync(KEYS.creditUid);
}

function toolCreditRecharge(id) {
  if (!id) return null;
  const saved = wx.getStorageSync(KEYS.creditRecharge(id));
  return saved?.requestId ? saved : null;
}

function setToolCreditRecharge(id, order) {
  if (!id) return;
  if (order) wx.setStorageSync(KEYS.creditRecharge(id), order);
  else wx.removeStorageSync(KEYS.creditRecharge(id));
}

function inviteClaim() {
  const claim = wx.getStorageSync(KEYS.inviteClaim);
  return typeof claim === "string" && /^[a-f0-9]{48}$/i.test(claim) ? claim : "";
}

function setInviteClaim(claim) {
  if (typeof claim === "string" && /^[a-f0-9]{48}$/i.test(claim)) {
    wx.setStorageSync(KEYS.inviteClaim, claim);
  } else {
    wx.removeStorageSync(KEYS.inviteClaim);
  }
}

module.exports = {
  uuid, guestId, defaultNickname, isDefaultNickname, name, hasCustomName, setName, avatarId, setAvatarId, avatarUrl, setAvatarUrl, hasWechatProfile,
  history, saveHistory, upsertAttempt, getAttempt,
  saveDraft, loadDraft, dropDraft, position, setPosition, pendingId, clearPendingId, KEYS,
  draftIndex, setDraftEntry, bestAttempt,
  toolCreditToken, setToolCreditToken, toolCreditAccountId, setToolCreditAccountId, toolCreditUid, setToolCreditUid, clearToolCreditSession,
  toolCreditRecharge, setToolCreditRecharge,
  inviteClaim, setInviteClaim,
};
