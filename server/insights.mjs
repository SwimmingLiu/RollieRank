import { createHash } from "node:crypto";
import { subjectAttempt, subjectId, subjectName } from "../src/subjects.js";
import { avatarUrlForProfile, defaultNickname, isDefaultNickname, wechatProfilesByGuest } from "./wechat-profile.mjs";
import { accountIdForGuest, findReceiptForIdentity } from "./account-identity.mjs";

export const SCORE_BANDS = [
  { id: "lt60", label: "60 以下", from: 0, to: .6 },
  { id: "60-70", label: "60–70", from: .6, to: .7 },
  { id: "70-80", label: "70–80", from: .7, to: .8 },
  { id: "80plus", label: "80 及以上", from: .8, to: Infinity },
];
export const MIN_SAMPLE_SIZE = 5;

// Identifiers are version-specific and never reveal the guest capability or private receipt ID.
const publicId = (versionId, identity) => "public-" + createHash("sha256").update(versionId + "\0" + identity).digest("hex").slice(0, 24);
const anonymous = (id) => defaultNickname(id);
const answerOptions = ["A", "B", "C", "D"];
const inBand = (rate, band) => band === "all" || SCORE_BANDS.some((item) => item.id === band && rate >= item.from && rate < item.to);
// Empty cohorts have no observed distribution; null prevents a misleading zero-percent measurement.
const ratio = (count, total) => total ? count / total : null;

/** Keep one complete published attempt per identity (or linked WeChat account); subject ranking may choose a different complete attempt. */
export function publicParticipants({ store, members, version, positionId = null, dimension = "total" }) {
  const participants = [];
  const profilesByGuest = wechatProfilesByGuest(store);
  const profilesByAccount = store?.features?.wechatProfilesByAccount ?? {};
  const accountSelections = store?.features?.positions?.accountSelections ?? {};
  const accountOptOut = store?.features?.positions?.accountOptOut ?? {};
  const grouped = new Map();
  for (const [identity, member] of Object.entries(members)) {
    const accountId = member?.accountId || accountIdForGuest(store, identity);
    const key = accountId ? `account:${accountId}` : identity;
    if (!grouped.has(key)) grouped.set(key, { accountId: accountId || null, entries: [] });
    grouped.get(key).entries.push([identity, member]);
  }
  for (const { accountId, entries } of grouped.values()) {
    entries.sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0));
    // 管理接口与跨设备撤回优先于旧目录中可能残留的回执 ID。
    if (accountId && accountOptOut[accountId]?.optOut === true) continue;
    if (entries.every(([, member]) => member.participationOptOut === true)) continue;
    const latestEntry = entries[0];
    const primaryIdentity = latestEntry[0];
    const latestWithPos = entries.find(([, member]) => member.positionId !== undefined);
    const effectivePos = accountId && Object.hasOwn(accountSelections, accountId)
      ? (accountSelections[accountId].positionId ?? null)
      : (latestWithPos?.[1]?.positionId ?? null);
    if (positionId && effectivePos !== positionId) continue;
    const accountProfile = accountId ? profilesByAccount[accountId] : null;
    const guestProfile = entries.map(([id]) => profilesByGuest.get(id)).find(Boolean) ?? null;
    const profile = accountProfile || guestProfile;
    const accountName = typeof accountProfile?.name === "string" ? accountProfile.name.trim() : "";
    const guestProfileName = typeof guestProfile?.name === "string" ? guestProfile.name.trim() : "";
    const memberName = entries.map(([, member]) => typeof member?.name === "string" ? member.name.trim() : "")
      .find((name) => !isDefaultNickname(name)) || "";
    const displayName = !isDefaultNickname(accountName)
      ? accountName
      : !isDefaultNickname(guestProfileName)
        ? guestProfileName
        : memberName || anonymous(primaryIdentity);
    const avatarUrl = avatarUrlForProfile(accountProfile) || avatarUrlForProfile(guestProfile) || avatarUrlForProfile(profile);
    const guestIds = new Set(entries.map(([id]) => id));
    const publicIdentity = accountId ? `account:${accountId}` : primaryIdentity;
    let best = null;
    for (const [identity, member] of entries) {
      if (member.participationOptOut === true) continue;
      for (const attemptId of member.attemptIds ?? []) {
        const receipt = store.receipts?.[`${identity}:${attemptId}`]
          ?? (accountId ? findReceiptForIdentity(store, { guestId: identity, attemptId, accountId })?.receipt : null);
        if (!receipt || receipt.isSample || receipt.versionId !== version.id || !Array.isArray(receipt.answers) || receipt.answers.length !== version.questions.length) continue;
        const report = subjectAttempt(receipt).report;
        const part = dimension === "total" ? null : report?.breakdown?.find((item) => item.id === dimension);
        const value = dimension === "total" ? report?.totalCents : part?.centsEarned;
        const maxCents = dimension === "total" ? report?.maxCents : part?.maxCents;
        if (!Number.isFinite(value) || value < 0 || !Number.isFinite(maxCents) || maxCents <= 0 || value > maxCents) continue;
        const metric = dimension === "total" ? value : value / maxCents;
        if (!best || metric > best.metric || (metric === best.metric && (receipt.createdAt < best.receipt.createdAt ||
          (receipt.createdAt === best.receipt.createdAt && receipt.id.localeCompare(best.receipt.id) < 0)))) {
          best = {
            identity: primaryIdentity,
            publicIdentity,
            accountId,
            guestIds,
            name: displayName,
            avatarUrl,
            receipt,
            report,
            metric,
            value,
            maxCents,
            rate: value / maxCents,
          };
        }
      }
    }
    if (best) participants.push(best);
  }
  participants.sort((a, b) => b.metric - a.metric || a.receipt.createdAt - b.receipt.createdAt || a.publicIdentity.localeCompare(b.publicIdentity));
  const below = new Map();
  for (let index = participants.length - 1; index >= 0; index--) {
    const metric = participants[index].metric;
    if (!below.has(metric)) below.set(metric, participants.length - index - 1);
  }
  let rank = 0;
  return participants.map((person, index) => {
    if (!index || person.metric !== participants[index - 1].metric) rank = index + 1;
    return { ...person, rank, publicId: publicId(version.id, person.publicIdentity),
      surpassedPercent: ratio(below.get(person.metric), participants.length) * 100 };
  });
}

export function publicLeaderboardRow(person, viewerId, viewerAccountId = null) {
  const isMe = person.identity === viewerId ||
    Boolean(person.guestIds && viewerId && person.guestIds.has(viewerId)) ||
    Boolean(viewerAccountId && person.accountId === viewerAccountId);
  return { publicId: person.publicId, rank: person.rank, name: person.name,
    ...(person.avatarUrl ? { avatarUrl: person.avatarUrl } : {}),
    value: person.value, maxCents: person.maxCents,
    rate: person.rate, createdAt: person.receipt.createdAt, isMe, surpassedPercent: person.surpassedPercent };
}

function publicSubjects(report) {
  return report.breakdown.map((part) => ({ id: part.id, name: part.name, count: part.count, correct: part.correct, centsEarned: part.centsEarned,
    maxCents: part.maxCents, rate: part.maxCents > 0 ? part.centsEarned / part.maxCents : 0 }));
}

export function publicResult(person) {
  return { publicId: person.publicId, name: person.name,
    ...(person.avatarUrl ? { avatarUrl: person.avatarUrl } : {}),
    totalCents: person.report.totalCents, maxCents: person.report.maxCents,
    rate: person.report.totalCents / person.report.maxCents, rank: person.rank, surpassedPercent: person.surpassedPercent,
    subjects: publicSubjects(person.report) };
}

/** Aggregates read the current receipts on every request so approved corrections cannot leave stale charts. */
export function buildInsights({ version, ownReceipt, participants, band }) {
  const sample = participants.filter((person) => inBand(person.report.totalCents / person.report.maxCents, band));
  const ownReport = subjectAttempt(ownReceipt).report;
  const sampleCount = sample.length;
  const questions = version.questions.map((question) => {
    const counts = Object.fromEntries(answerOptions.map((answer) => [answer, 0]));
    let blank = 0;
    for (const person of sample) {
      const answer = person.receipt.answers[question.number - 1];
      if (answerOptions.includes(answer)) counts[answer]++;
      else blank++;
    }
    return { number: question.number, typeId: subjectId(question.typeId, question.type), type: subjectName(question.type),
      correctAnswer: question.correctAnswer, ownAnswer: ownReceipt.answers[question.number - 1] || null,
      options: answerOptions.map((answer) => ({ answer, count: counts[answer], rate: ratio(counts[answer], sampleCount) })),
      blank: { count: blank, rate: ratio(blank, sampleCount) } };
  });
  const subjects = ownReport.breakdown.map((part) => {
    const ownRate = part.maxCents > 0 ? part.centsEarned / part.maxCents : 0;
    const values = sample.map((person) => person.report.breakdown.find((item) => item.id === part.id))
      .filter((item) => item && item.maxCents > 0).map((item) => item.centsEarned / item.maxCents);
    const averageRate = values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
    return { id: part.id, name: part.name, count: part.count, maxCents: part.maxCents, ownRate, averageRate,
      deltaRate: averageRate === null ? null : ownRate - averageRate };
  });
  return { band, sampleCount, participantCount: participants.length, minSampleSize: MIN_SAMPLE_SIZE,
    lowSample: sampleCount > 0 && sampleCount < MIN_SAMPLE_SIZE, questions, subjects,
    bands: [{ id: "all", label: "全部", count: participants.length, rate: participants.length ? 1 : null },
      ...SCORE_BANDS.map((item) => { const count = participants.filter((person) => inBand(person.report.totalCents / person.report.maxCents, item.id)).length;
        return { id: item.id, label: item.label, count, rate: ratio(count, participants.length) }; })] };
}
