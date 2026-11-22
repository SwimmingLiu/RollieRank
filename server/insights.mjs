import { createHash } from "node:crypto";
import { subjectAttempt, subjectId, subjectName } from "../src/subjects.js";
import { defaultNickname, isDefaultNickname } from "./wechat-profile.mjs";

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

/** Keep one complete published attempt per identity; subject ranking may choose a different complete attempt. */
export function publicParticipants({ store, members, version, positionId = null, dimension = "total" }) {
  const participants = [];
  for (const [identity, member] of Object.entries(members)) {
    // 管理接口的明确撤回优先于旧目录中可能残留的回执 ID。
    if (member.participationOptOut === true) continue;
    if (positionId && member.positionId !== positionId) continue;
    let best = null;
    for (const attemptId of member.attemptIds ?? []) {
      const receipt = store.receipts?.[`${identity}:${attemptId}`];
      if (!receipt || receipt.isSample || receipt.versionId !== version.id || !Array.isArray(receipt.answers) || receipt.answers.length !== version.questions.length) continue;
      const report = subjectAttempt(receipt).report;
      const part = dimension === "total" ? null : report?.breakdown?.find((item) => item.id === dimension);
      const value = dimension === "total" ? report?.totalCents : part?.centsEarned;
      const maxCents = dimension === "total" ? report?.maxCents : part?.maxCents;
      if (!Number.isFinite(value) || value < 0 || !Number.isFinite(maxCents) || maxCents <= 0 || value > maxCents) continue;
      const metric = dimension === "total" ? value : value / maxCents;
      if (!best || metric > best.metric || (metric === best.metric && (receipt.createdAt < best.receipt.createdAt ||
        (receipt.createdAt === best.receipt.createdAt && receipt.id.localeCompare(best.receipt.id) < 0))))
        best = { identity, name: !isDefaultNickname(member.name) ? member.name : anonymous(identity), receipt, report, metric, value, maxCents, rate: value / maxCents };
    }
    if (best) participants.push(best);
  }
  participants.sort((a, b) => b.metric - a.metric || a.receipt.createdAt - b.receipt.createdAt || a.identity.localeCompare(b.identity));
  const below = new Map();
  for (let index = participants.length - 1; index >= 0; index--) {
    const metric = participants[index].metric;
    if (!below.has(metric)) below.set(metric, participants.length - index - 1);
  }
  let rank = 0;
  return participants.map((person, index) => {
    if (!index || person.metric !== participants[index - 1].metric) rank = index + 1;
    return { ...person, rank, publicId: publicId(version.id, person.identity),
      surpassedPercent: ratio(below.get(person.metric), participants.length) * 100 };
  });
}

export function publicLeaderboardRow(person, viewerId) {
  return { publicId: person.publicId, rank: person.rank, name: person.name, value: person.value, maxCents: person.maxCents,
    rate: person.rate, createdAt: person.receipt.createdAt, isMe: person.identity === viewerId, surpassedPercent: person.surpassedPercent };
}

function publicSubjects(report) {
  return report.breakdown.map((part) => ({ id: part.id, name: part.name, count: part.count, centsEarned: part.centsEarned,
    maxCents: part.maxCents, rate: part.maxCents > 0 ? part.centsEarned / part.maxCents : 0 }));
}

export function publicResult(person) {
  return { publicId: person.publicId, name: person.name, totalCents: person.report.totalCents, maxCents: person.report.maxCents,
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
