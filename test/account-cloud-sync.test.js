import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createWalletTestServer } from "./support/tool-credits-server.mjs";
import { startWalletPostgres } from "./support/wallet-postgres.mjs";

const auth = (session) => ({ Authorization: `Bearer ${session.token}` });
let postgres;

test.before(async () => {
  postgres = await startWalletPostgres();
});

test.after(() => postgres?.close());

test("reinstalling or switching devices under the same WeChat account restores attempts, position, leaderboard identity, insights, discussions, corrections, and delete", async (t) => {
  const server = await createWalletTestServer({ postgres });
  t.after(() => server.close());

  const { data: catalog } = await server.json("/api/catalog");
  const version = catalog.versions[0];
  assert.ok(version && version.questionCount > 0);
  const { data: posCatalog } = await server.json("/api/positions/catalog?pageSize=2");
  const posA = posCatalog.items[0];
  const posB = posCatalog.items[1];
  assert.ok(posA && posB);

  const guest1 = randomUUID();
  const attempt1 = randomUUID();
  const login1 = await server.json("/api/tool-credits/login", {
    code: "wallet-test-user-alpha",
    visitorId: guest1,
  });
  assert.equal(login1.status, 200);
  const session1 = login1.data;

  const answers1 = Array.from({ length: version.questionCount }, (_, i) => (i % 2 === 0 ? "A" : "B"));
  const submit1 = await server.json("/api/submit", {
    guestId: guest1,
    attemptId: attempt1,
    versionId: version.id,
    name: "刘杰",
    answers: answers1,
  }, auth(session1));
  assert.equal(submit1.status, 200);

  const select1 = await server.json("/api/positions/selection", {
    guestId: guest1,
    positionId: posA.id,
  }, auth(session1));
  assert.equal(select1.status, 200);
  assert.equal(select1.data.positionId, posA.id);

  const guest2 = randomUUID();
  const login2 = await server.json("/api/tool-credits/login", {
    code: "wallet-test-user-alpha",
    visitorId: guest2,
  });
  assert.equal(login2.status, 200);
  const session2 = login2.data;
  assert.equal(session2.accountId, session1.accountId);

  const unauthSync = await server.json("/api/attempts/sync", { guestId: guest2 });
  assert.equal(unauthSync.status, 200);
  assert.equal(unauthSync.data.attempts.length, 0);
  assert.equal(unauthSync.data.scope, "guest");

  const unauthProfile = await server.json(`/api/positions/profile?guestId=${encodeURIComponent(guest2)}`);
  assert.equal(unauthProfile.status, 200);
  assert.equal(unauthProfile.data.positionId, null);
  assert.equal(unauthProfile.data.scope, "guest");

  const unauthInsights = await server.json(
    `/api/positions/insights?versionId=${encodeURIComponent(version.id)}&attemptId=${encodeURIComponent(attempt1)}&guestId=${encodeURIComponent(guest2)}&scope=nationwide&band=all`,
  );
  assert.equal(unauthInsights.status, 403);

  const synced = await server.json("/api/attempts/sync", { guestId: guest2 }, auth(session2));
  assert.equal(synced.status, 200);
  assert.equal(synced.data.scope, "account");
  assert.equal(synced.data.attempts.length, 1);
  assert.equal(synced.data.attempts[0].id, attempt1);

  const posProfile = await server.json(`/api/positions/profile?guestId=${encodeURIComponent(guest2)}`, undefined, auth(session2));
  assert.equal(posProfile.status, 200);
  assert.equal(posProfile.data.scope, "account");
  assert.equal(posProfile.data.positionId, posA.id);
  assert.deepEqual(posProfile.data.participation.attemptIds, [attempt1]);

  const insights = await server.json(
    `/api/positions/insights?versionId=${encodeURIComponent(version.id)}&attemptId=${encodeURIComponent(attempt1)}&guestId=${encodeURIComponent(guest2)}&scope=nationwide&band=all`,
    undefined,
    auth(session2),
  );
  assert.equal(insights.status, 200);

  const discList = await server.json(
    `/api/discussions?paperId=${encodeURIComponent(version.paperId)}&guestId=${encodeURIComponent(guest2)}&attemptId=${encodeURIComponent(attempt1)}`,
    undefined,
    auth(session2),
  );
  assert.equal(discList.status, 200);

  const discPost = await server.json("/api/discussions", {
    paperId: version.paperId,
    guestId: guest2,
    attemptId: attempt1,
    clientId: randomUUID(),
    nickname: "刘杰",
    text: "清缓存重登后依然可以正常发评论。",
  }, auth(session2));
  assert.equal(discPost.status, 201);

  const feedbackId = randomUUID();
  const corrSubmit = await server.json("/api/corrections/submit", {
    guestId: guest2,
    attemptId: attempt1,
    feedbackId,
    baseRevision: 0,
    changes: [{ question: 1, suggestedAnswer: "C", evidence: "官方解析选 C。" }],
  }, auth(session2));
  assert.equal(corrSubmit.status, 200);

  const corrList = await server.json("/api/corrections/list", { guestId: guest2 }, auth(session2));
  assert.equal(corrList.status, 200);
  assert.equal(corrList.data.feedbacks.length, 1);

  const attempt2 = randomUUID();
  const submit2 = await server.json("/api/submit", {
    guestId: guest2,
    attemptId: attempt2,
    versionId: version.id,
    name: "刘杰",
    answers: Array.from({ length: version.questionCount }, () => "A"),
  }, auth(session2));
  assert.equal(submit2.status, 200);

  const board = await server.json(
    `/api/positions/leaderboard?versionId=${encodeURIComponent(version.id)}&guestId=${encodeURIComponent(guest2)}&scope=selected`,
    undefined,
    auth(session2),
  );
  assert.equal(board.status, 200);
  assert.equal(board.data.position.id, posA.id);
  assert.equal(board.data.count, 1);
  assert.equal(board.data.self.isMe, true);
  assert.equal(board.data.self.name, "刘杰");

  const clearPos = await server.json("/api/positions/selection", {
    guestId: guest2,
    positionId: null,
  }, auth(session2));
  assert.equal(clearPos.status, 200);
  assert.equal(clearPos.data.positionId, null);

  const posAfterClear1 = await server.json(`/api/positions/profile?guestId=${encodeURIComponent(guest1)}`, undefined, auth(session1));
  assert.equal(posAfterClear1.data.positionId, null);

  const posBoardAfterClear = await server.json(
    `/api/positions/leaderboard?versionId=${encodeURIComponent(version.id)}&scope=position&positionId=${encodeURIComponent(posA.id)}`,
  );
  assert.equal(posBoardAfterClear.status, 200);
  assert.equal(posBoardAfterClear.data.count, 0);

  const attemptAfterClear = randomUUID();
  const submitOldDeviceAfterClear = await server.json("/api/submit", {
    guestId: guest1,
    attemptId: attemptAfterClear,
    versionId: version.id,
    name: "刘杰",
    answers: answers1,
  }, auth(session1));
  assert.equal(submitOldDeviceAfterClear.status, 200);
  const posStillCleared = await server.json(`/api/positions/profile?guestId=${encodeURIComponent(guest2)}`, undefined, auth(session2));
  assert.equal(posStillCleared.data.positionId, null);

  const select2 = await server.json("/api/positions/selection", {
    guestId: guest2,
    positionId: posB.id,
  }, auth(session2));
  assert.equal(select2.status, 200);
  assert.equal(select2.data.positionId, posB.id);

  const guest3 = randomUUID();
  const login3 = await server.json("/api/tool-credits/login", {
    code: "wallet-test-user-alpha",
    visitorId: guest3,
  });
  const posProfile3 = await server.json(`/api/positions/profile?guestId=${encodeURIComponent(guest3)}`, undefined, auth(login3.data));
  assert.equal(posProfile3.data.positionId, posB.id);

  const withdrawRes = await server.json("/api/positions/withdraw", { guestId: guest3 }, auth(login3.data));
  assert.equal(withdrawRes.status, 200);

  const boardAfterWithdraw = await server.json(
    `/api/positions/leaderboard?versionId=${encodeURIComponent(version.id)}&guestId=${encodeURIComponent(guest3)}&scope=nationwide`,
    undefined,
    auth(login3.data),
  );
  assert.equal(boardAfterWithdraw.status, 200);
  assert.equal(boardAfterWithdraw.data.count, 0);
  assert.equal(boardAfterWithdraw.data.self, null);

  const rejoinRes = await server.json("/api/positions/participation", {
    guestId: guest3,
    name: "刘杰",
    attemptIds: [attempt1],
  }, auth(login3.data));
  assert.equal(rejoinRes.status, 200);
  assert.equal(rejoinRes.data.participation.attemptIds.includes(attempt1), true);

  const delOwn = await server.json("/api/attempts/delete", {
    guestId: guest2,
    attemptIds: [attempt1],
  }, auth(session2));
  assert.equal(delOwn.status, 200);

  const afterDel = await server.json("/api/attempts/sync", { guestId: guest2 }, auth(session2));
  assert.equal(afterDel.data.attempts.length, 2);
  assert.equal(afterDel.data.attempts.some((a) => a.id === attempt1), false);
});

test("cross-account guestId hijacking and unverified legacy claiming are blocked", async (t) => {
  const server = await createWalletTestServer({ postgres });
  t.after(() => server.close());

  const { data: catalog } = await server.json("/api/catalog");
  const version = catalog.versions[0];
  const { data: posCatalog } = await server.json("/api/positions/catalog?pageSize=1");
  const posA = posCatalog.items[0];
  const answers = Array.from({ length: version.questionCount }, () => "A");

  const victimGuest = randomUUID();
  const victimAttempt = randomUUID();
  const victimLogin = await server.json("/api/tool-credits/login", {
    code: "wallet-test-victim",
    visitorId: victimGuest,
  });
  assert.equal(victimLogin.status, 200);
  const victimSession = victimLogin.data;

  const victimSubmit = await server.json("/api/submit", {
    guestId: victimGuest,
    attemptId: victimAttempt,
    versionId: version.id,
    name: "受害者",
    answers,
  }, auth(victimSession));
  assert.equal(victimSubmit.status, 200);

  const attackerGuest = randomUUID();
  const attackerLogin = await server.json("/api/tool-credits/login", {
    code: "wallet-test-attacker",
    visitorId: attackerGuest,
  });
  assert.equal(attackerLogin.status, 200);
  const attackerSession = attackerLogin.data;

  const hijackSelection = await server.json("/api/positions/selection", {
    guestId: victimGuest,
    positionId: posA.id,
  }, auth(attackerSession));
  assert.equal(hijackSelection.status, 403);

  const hijackSubmit = await server.json("/api/submit", {
    guestId: victimGuest,
    attemptId: randomUUID(),
    versionId: version.id,
    name: "攻击者",
    answers,
  }, auth(attackerSession));
  assert.equal(hijackSubmit.status, 403);

  const hijackWithdraw = await server.json("/api/positions/withdraw", {
    guestId: victimGuest,
  }, auth(attackerSession));
  assert.equal(hijackWithdraw.status, 403);

  const attackerSync = await server.json("/api/attempts/sync", { guestId: attackerGuest }, auth(attackerSession));
  assert.equal(attackerSync.status, 200);
  assert.equal(attackerSync.data.attempts.length, 0);

  const attackerDelete = await server.json("/api/attempts/delete", {
    guestId: attackerGuest,
    attemptIds: [victimAttempt],
  }, auth(attackerSession));
  assert.equal(attackerDelete.status, 200);

  const victimStillIntact = await server.json("/api/attempts/sync", { guestId: victimGuest }, auth(victimSession));
  assert.equal(victimStillIntact.data.attempts.length, 1);
  assert.equal(victimStillIntact.data.attempts[0].id, victimAttempt);

  const preLoginGuest = randomUUID();
  const preLoginAttempt = randomUUID();
  const anonSubmit = await server.json("/api/submit", {
    guestId: preLoginGuest,
    attemptId: preLoginAttempt,
    versionId: version.id,
    name: "老用户",
    answers,
  });
  assert.equal(anonSubmit.status, 200);

  const attackerClaim = await server.json("/api/tool-credits/login", {
    code: "wallet-test-attacker",
    visitorId: preLoginGuest,
    bindLegacy: false,
  });
  assert.equal(attackerClaim.status, 200);

  const attackerSubmitOnPreLogin = await server.json("/api/submit", {
    guestId: preLoginGuest,
    attemptId: randomUUID(),
    versionId: version.id,
    name: "攻击者",
    answers,
  }, auth(attackerClaim.data));
  assert.equal(attackerSubmitOnPreLogin.status, 200);

  const attackerProfileSess = await server.json("/api/miniprogram-profile/session", {});
  const attackerProfileOnPreLogin = await server.json("/api/miniprogram-profile/profile", {
    token: attackerProfileSess.data.token,
    guestId: preLoginGuest,
    name: "企图抢绑",
  }, auth(attackerClaim.data));
  assert.equal(attackerProfileOnPreLogin.status, 200);

  const attackerAfterClaim = await server.json("/api/attempts/sync", { guestId: attackerGuest }, auth(attackerClaim.data));
  assert.equal(attackerAfterClaim.data.attempts.length, 0);

  const attackerSyncVictim = await server.json("/api/attempts/sync", { guestId: victimGuest }, auth(attackerSession));
  assert.equal(attackerSyncVictim.status, 403);

  const attackerBindVictim = await server.json("/api/tool-credits/login", {
    code: "wallet-test-attacker",
    visitorId: victimGuest,
    bindLegacy: true,
    attemptId: victimAttempt,
  });
  assert.equal(attackerBindVictim.status, 409);

  const anonProfileSession = await server.json("/api/miniprogram-profile/session", {});
  const hijackProfile = await server.json("/api/miniprogram-profile/profile", {
    token: anonProfileSession.data.token,
    guestId: victimGuest,
    name: "冒名顶替",
  });
  assert.equal(hijackProfile.status, 403);

  const realOwnerClaim = await server.json("/api/tool-credits/login", {
    code: "wallet-test-real-legacy-owner",
    visitorId: preLoginGuest,
    bindLegacy: true,
    attemptId: preLoginAttempt,
  });
  assert.equal(realOwnerClaim.status, 200);

  const realOwnerFreshDevice = randomUUID();
  const realOwnerRelogin = await server.json("/api/tool-credits/login", {
    code: "wallet-test-real-legacy-owner",
    visitorId: realOwnerFreshDevice,
  });
  const recoveredLegacy = await server.json("/api/attempts/sync", { guestId: realOwnerFreshDevice }, auth(realOwnerRelogin.data));
  assert.equal(recoveredLegacy.data.attempts.some((a) => a.id === preLoginAttempt), true);
});

test("saving WeChat profile before first submission still binds the device and syncs attempts across reinstalls", async (t) => {
  const server = await createWalletTestServer({ postgres });
  t.after(() => server.close());

  const { data: catalog } = await server.json("/api/catalog");
  const version = catalog.versions[0];
  const answers = Array.from({ length: version.questionCount }, () => "B");

  const guest1 = randomUUID();
  const login1 = await server.json("/api/tool-credits/login", {
    code: "wallet-test-profile-first",
    visitorId: guest1,
  });
  assert.equal(login1.status, 200);
  const session1 = login1.data;

  const { data: profileSess } = await server.json("/api/miniprogram-profile/session", {});
  const saveProfile = await server.json("/api/miniprogram-profile/profile", {
    token: profileSess.token,
    guestId: guest1,
    name: "先改资料",
  }, auth(session1));
  assert.equal(saveProfile.status, 200);

  const attempt1 = randomUUID();
  const submit1 = await server.json("/api/submit", {
    guestId: guest1,
    attemptId: attempt1,
    versionId: version.id,
    name: "先改资料",
    answers,
  }, auth(session1));
  assert.equal(submit1.status, 200);

  const guest2 = randomUUID();
  const login2 = await server.json("/api/tool-credits/login", {
    code: "wallet-test-profile-first",
    visitorId: guest2,
  });
  assert.equal(login2.status, 200);

  const synced = await server.json("/api/attempts/sync", { guestId: guest2 }, auth(login2.data));
  assert.equal(synced.status, 200);
  assert.equal(synced.data.scope, "account");
  assert.equal(synced.data.attempts.length, 1);
  assert.equal(synced.data.attempts[0].id, attempt1);
});

test("mini-program cloud-sync preserves cached position on degraded guest scope and clears only on authoritative account scope", async () => {
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  const storeMap = new Map();
  let nextResponse = null;
  const priorWx = globalThis.wx;
  globalThis.wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: "release" } }),
    getStorageSync: (k) => (storeMap.has(k) ? storeMap.get(k) : ""),
    setStorageSync: (k, v) => { storeMap.set(k, v); },
    removeStorageSync: (k) => { storeMap.delete(k); },
    request: ({ success }) => success({ statusCode: 200, header: {}, data: nextResponse }),
  };
  const modulesToClear = [
    "../mini-program/config.js",
    "../mini-program/utils/storage.js",
    "../mini-program/services/api.js",
    "../mini-program/services/profile.js",
    "../mini-program/services/tool-credits.js",
    "../mini-program/services/cloud-sync.js",
  ];
  for (const mod of modulesToClear) delete req.cache[req.resolve(mod)];
  try {
    const storage = req("../mini-program/utils/storage.js");
    const cloudSync = req("../mini-program/services/cloud-sync.js");
    storage.setToolCreditToken("a".repeat(64));
    storage.setPosition({ id: "pos:1", label: "外交部 · 一级科员", exam: "guokao" });

    nextResponse = { positionId: null, position: null, scope: "guest" };
    const degraded = await cloudSync.syncPosition();
    assert.equal(degraded.ok, false);
    assert.equal(storage.position()?.id, "pos:1");

    nextResponse = { positionId: null, position: null, scope: "account" };
    const authoritative = await cloudSync.syncPosition();
    assert.equal(authoritative.ok, true);
    assert.equal(authoritative.position, null);
    assert.equal(storage.position(), null);
  } finally {
    for (const mod of modulesToClear) delete req.cache[req.resolve(mod)];
    globalThis.wx = priorWx;
  }
});
