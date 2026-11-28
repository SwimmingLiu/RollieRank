// 微信账号（accountId）与设备随机身份（guestId）的映射与统一查询。
// 跨设备聚合严格要求有效的微信账号认证（authAccount.id）；未鉴权请求仅作用于本机 guestId。

const ID_PATTERN = /^[\w-]{10,80}$/;

export function validIdentity(value) {
  return typeof value === "string" && ID_PATTERN.test(value);
}

export async function resolveRequestAccount(billing, request) {
  if (!request || typeof billing?.requireAccount !== "function") return null;
  try {
    const account = await billing.requireAccount(request);
    return account && validIdentity(account.id) ? account : null;
  } catch {
    return null;
  }
}

function accountGuestMap(store) {
  return store?.features?.accountGuests ?? {};
}

// 仅用于公开榜单按人去重、公开头像展示与防跨号抢绑检查；严禁用于未鉴权请求的跨设备读写展开。
export function accountIdForGuest(store, guestId) {
  if (!validIdentity(guestId)) return null;
  const map = accountGuestMap(store);
  for (const [accountId, entry] of Object.entries(map)) {
    if (Array.isArray(entry?.guestIds) && entry.guestIds.includes(guestId)) {
      return accountId;
    }
  }
  const member = store?.features?.positions?.members?.[guestId];
  if (validIdentity(member?.accountId)) return member.accountId;
  for (const profile of Object.values(store?.features?.wechatProfiles ?? {})) {
    if (profile?.guestId === guestId && validIdentity(profile?.accountId)) {
      return profile.accountId;
    }
  }
  return null;
}

export function hasLegacyGuestActivity(store, guestId) {
  if (!validIdentity(guestId)) return false;
  const prefix = `${guestId}:`;
  for (const key of Object.keys(store?.receipts ?? {})) {
    if (key.startsWith(prefix)) return true;
  }
  const member = store?.features?.positions?.members?.[guestId];
  if (member && (member.positionId || (Array.isArray(member.attemptIds) && member.attemptIds.length > 0))) {
    return true;
  }
  for (const profile of Object.values(store?.features?.wechatProfiles ?? {})) {
    if (profile?.guestId === guestId && (profile.name || profile.avatar || profile.phone)) {
      return true;
    }
  }
  return false;
}

export function canLinkAccountGuest(store, accountId, guestId, { allowLegacyClaim = false } = {}) {
  if (!validIdentity(accountId) || !validIdentity(guestId)) return false;
  const existingOwner = accountIdForGuest(store, guestId);
  if (existingOwner) {
    if (existingOwner !== accountId) return false;
    const list = accountGuestMap(store)[accountId]?.guestIds;
    return !Array.isArray(list) || !list.includes(guestId);
  }
  if (!allowLegacyClaim && hasLegacyGuestActivity(store, guestId)) return false;
  return true;
}

export function assertGuestNotOwnedByOther(store, accountId, guestId) {
  if (!validIdentity(accountId) || !validIdentity(guestId)) return;
  const existingOwner = accountIdForGuest(store, guestId);
  if (existingOwner && existingOwner !== accountId) {
    throw Object.assign(new Error("该本机身份已关联其他微信账号，请重新登录后再试。"), { statusCode: 403 });
  }
}

export function linkAccountGuest(store, accountId, guestId, { allowLegacyClaim = false } = {}) {
  if (!canLinkAccountGuest(store, accountId, guestId, { allowLegacyClaim })) return false;
  store.features ??= {};
  const map = (store.features.accountGuests ??= {});
  const entry = map[accountId] ?? { guestIds: [], updatedAt: 0 };
  const list = Array.isArray(entry.guestIds) ? entry.guestIds : [];
  if (list.includes(guestId)) return false;
  map[accountId] = {
    ...entry,
    guestIds: [...list, guestId],
    updatedAt: Date.now(),
  };
  return true;
}

export function linkedGuestIds(store, { accountId = null, guestId = null } = {}) {
  const ids = new Set();
  if (validIdentity(guestId)) ids.add(guestId);
  if (!validIdentity(accountId)) return ids;
  const entry = accountGuestMap(store)[accountId];
  if (Array.isArray(entry?.guestIds)) {
    for (const id of entry.guestIds) {
      if (validIdentity(id)) ids.add(id);
    }
  }
  for (const [key, receipt] of Object.entries(store?.receipts ?? {})) {
    if (!receipt || receipt.isSample || receipt.accountId !== accountId) continue;
    const sep = key.indexOf(":");
    const owner = sep > 0 ? key.slice(0, sep) : "";
    if (validIdentity(owner)) ids.add(owner);
  }
  for (const [id, member] of Object.entries(store?.features?.positions?.members ?? {})) {
    if (member?.accountId === accountId && validIdentity(id)) ids.add(id);
  }
  return ids;
}

export function findReceiptForIdentity(store, { guestId = null, attemptId, accountId = null } = {}) {
  if (!validIdentity(attemptId)) return null;
  const receipts = store?.receipts ?? {};
  if (validIdentity(guestId)) {
    const directKey = `${guestId}:${attemptId}`;
    const direct = receipts[directKey];
    if (direct && !direct.isSample) {
      return { key: directKey, receipt: direct, ownerGuestId: guestId };
    }
  }
  if (!validIdentity(accountId)) return null;
  const guests = linkedGuestIds(store, { accountId, guestId });
  for (const id of guests) {
    const key = `${id}:${attemptId}`;
    const candidate = receipts[key];
    if (candidate && !candidate.isSample) {
      return { key, receipt: candidate, ownerGuestId: id };
    }
  }
  for (const [key, candidate] of Object.entries(receipts)) {
    if (!candidate || candidate.isSample) continue;
    if (candidate.id === attemptId && candidate.accountId === accountId) {
      const sep = key.indexOf(":");
      return { key, receipt: candidate, ownerGuestId: sep > 0 ? key.slice(0, sep) : "" };
    }
  }
  return null;
}

export function listReceiptsForIdentity(store, { guestId = null, accountId = null, attemptIds = null } = {}) {
  const filterIds = Array.isArray(attemptIds) ? new Set(attemptIds) : null;
  const hasAuthAccount = validIdentity(accountId);
  const guests = linkedGuestIds(store, { accountId: hasAuthAccount ? accountId : null, guestId });
  const byAttemptId = new Map();
  for (const [key, attempt] of Object.entries(store?.receipts ?? {})) {
    if (!attempt || attempt.isSample) continue;
    if (filterIds && !filterIds.has(attempt.id)) continue;
    const sep = key.indexOf(":");
    const owner = sep > 0 ? key.slice(0, sep) : "";
    const ownedByGuest = guests.has(owner);
    const ownedByAccount = Boolean(hasAuthAccount && attempt.accountId === accountId);
    if (!ownedByGuest && !ownedByAccount) continue;
    const prior = byAttemptId.get(attempt.id);
    if (!prior || (attempt.createdAt || 0) >= (prior.createdAt || 0)) {
      byAttemptId.set(attempt.id, attempt);
    }
  }
  return [...byAttemptId.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
