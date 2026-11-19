// 本机存储与身份：只保存公开练习数据，不保存参考答案。
const KEYS = {
  guest: "rr:guest",
  name: "rr:name",
  avatar: "rr:avatar",
  history: "rr:history",
  draft: id => `rr:draft:${id}`,
  marks: id => `rr:marks:${id}`,
  position: "rr:position",
  marksIndex: "rr:marks:index",
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

function name() {
  return wx.getStorageSync(KEYS.name) || "卷友";
}

function setName(value) {
  const text = String(value || "").trim().slice(0, 12) || "卷友";
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
    // 题型得分率随快照保存，成长分析不需要再次联网。
    subjects: (attempt.report.breakdown || []).map(type => ({
      name: type.name, centsEarned: type.centsEarned, maxCents: type.maxCents,
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
  const index = wx.getStorageSync("rr:drafts") || {};
  return index && typeof index === "object" ? index : {};
}

function setDraftEntry(versionId, entry) {
  const index = draftIndex();
  if (entry) index[versionId] = { ...entry, updatedAt: Date.now() };
  else delete index[versionId];
  wx.setStorageSync("rr:drafts", index);
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

module.exports = {
  uuid, guestId, name, setName, avatarId, setAvatarId, history, saveHistory, upsertAttempt, getAttempt,
  saveDraft, loadDraft, dropDraft, position, setPosition, pendingId, clearPendingId, KEYS,
  draftIndex, setDraftEntry, bestAttempt,
};
