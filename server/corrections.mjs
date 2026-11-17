import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { CHOICES, gradeVersion } from "../src/model.js";

const fault = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const id = (value, label) => {
  if (typeof value !== "string" || !/^[\w-]{10,80}$/.test(value))
    throw fault(400, `${label}无效，请刷新后重试。`);
  return value;
};
const text = (value, label, limit) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > limit)
    throw fault(400, `${label}须为 1–${limit} 字。`);
  return value.trim();
};
const revisionOf = (version) => version.answerRevision ?? 0;
const dataOf = (store) => store.features?.corrections ?? { feedbacks: [], reviews: [], revisions: [] };
const writableData = (store) => {
  store.features ??= {};
  return (store.features.corrections ??= { feedbacks: [], reviews: [], revisions: [] });
};
const versionFor = (store, versionId) => {
  const version = store.versions.find((v) => v.id === versionId);
  if (!version) throw fault(404, "找不到反馈对应的套卷版本。");
  return version;
};
const receiptFor = (store, guestId, attemptId) => {
  id(guestId, "本机身份凭证");
  id(attemptId, "答卷凭证");
  const receipt = store.receipts[`${guestId}:${attemptId}`];
  if (!receipt || receipt.isSample) throw fault(404, "找不到这份已提交答卷，请先同步练习记录。");
  return receipt;
};
const scoreSummary = (report) => Object.fromEntries(
  ["totalCents", "maxCents", "correct", "wrong", "blank"].map((key) => [key, report[key]]),
);
const feedbackStatus = (items) => {
  if (items.every((item) => item.status === "pending")) return "pending";
  if (items.some((item) => item.status === "pending")) return "partial";
  if (items.every((item) => item.status === "approved")) return "approved";
  if (items.every((item) => item.status === "rejected")) return "rejected";
  return "mixed";
};

// 按题号检查订正历史，可继续审核无关题目，也能识别答案改回原值的过期依据。
const isStale = (store, feedback, item) => {
  const version = versionFor(store, feedback.versionId);
  return version.questions[item.question - 1]?.correctAnswer !== item.originalAnswer ||
    dataOf(store).revisions.some((revision) => revision.versionId === version.id &&
      revision.toRevision > feedback.baseRevision &&
      revision.changes.some((change) => change.question === item.question));
};
const viewFeedback = (store, feedback) => {
  const { guestId, ...publicFields } = feedback;
  return {
    ...publicFields,
    status: feedbackStatus(feedback.items),
    currentRevision: revisionOf(versionFor(store, feedback.versionId)),
    items: feedback.items.map((item) => ({ ...item, stale: item.status === "pending" && isStale(store, feedback, item) })),
  };
};
const pendingSummary = (store) => {
  const feedbacks = dataOf(store).feedbacks;
  return {
    pendingCount: feedbacks.filter((feedback) => feedback.items.some((item) => item.status === "pending")).length,
    pendingQuestionCount: feedbacks.reduce((sum, feedback) => sum + feedback.items.filter((item) => item.status === "pending").length, 0),
    reviewEnabled: Boolean(process.env.ROLLIERANK_REVIEW_TOKEN?.trim()),
  };
};
const authorize = (input) => {
  const configured = process.env.ROLLIERANK_REVIEW_TOKEN;
  if (typeof configured !== "string" || !configured.trim())
    throw fault(403, "审核尚未启用，请联系维护者配置审核凭证。");
  if (typeof input.reviewToken !== "string" || input.reviewToken.length > 4096)
    throw fault(403, "维护者凭证无效，请重新输入。");
  const hash = (value) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(configured), hash(input.reviewToken)))
    throw fault(403, "维护者凭证无效，请重新输入。");
};
const validRevision = (value) => {
  if (!Number.isSafeInteger(value) || value < 0) throw fault(400, "答案修订号无效，请同步后重试。");
  return value;
};
const questionNumbers = (value) => {
  if (!Array.isArray(value) || !value.length || value.length > 300 ||
      !value.every((number) => Number.isInteger(number) && number >= 1 && number <= 300) ||
      new Set(value).size !== value.length)
    throw fault(400, "请选择互不重复的题号，每次最多 300 题。");
  return [...value].sort((a, b) => a - b);
};

export function createCorrectionsService({ readCatalog, mutateCatalog }) {
  // POST 查询也要等订正落盘，避免把随后回滚的临时成绩当成正式结果返回。
  let pendingChanges = Promise.resolve();
  const transact = (operation) => {
    const task = mutateCatalog(operation);
    pendingChanges = task.catch(() => {});
    return task;
  };
  const submit = async (input) => {
    const guestId = id(input.guestId, "本机身份凭证");
    const attemptId = id(input.attemptId, "答卷凭证");
    const feedbackId = id(input.feedbackId, "反馈编号");
    const baseRevision = validRevision(input.baseRevision);
    if (!Array.isArray(input.changes)) throw fault(400, "请填写题号、建议答案和核对依据。");
    questionNumbers(input.changes.map((change) => change?.question));
    const changes = input.changes.map((change) => {
      if (!CHOICES.includes(change.suggestedAnswer)) throw fault(400, "建议答案须为 A、B、C、D。");
      return { question: change.question, suggestedAnswer: change.suggestedAnswer,
        evidence: text(change.evidence, "核对依据", 4000) };
    }).sort((a, b) => a.question - b.question);
    return transact((store) => {
      const data = writableData(store);
      const prior = data.feedbacks.find((feedback) => feedback.id === feedbackId);
      if (prior) {
        const originalChanges = prior.items.map(({ question, suggestedAnswer, evidence }) => ({ question, suggestedAnswer, evidence }));
        if (prior.guestId !== guestId || prior.attemptId !== attemptId || prior.baseRevision !== baseRevision ||
            JSON.stringify(originalChanges) !== JSON.stringify(changes))
          throw fault(409, "反馈编号已使用，请创建新的反馈。");
        return { feedback: viewFeedback(store, prior), replayed: true };
      }
      const receipt = receiptFor(store, guestId, attemptId);
      const version = versionFor(store, receipt.versionId);
      if (baseRevision !== revisionOf(version)) throw fault(409, "参考答案已修订，请同步报告后重新反馈。");
      const items = changes.map((change) => {
        const question = version.questions[change.question - 1];
        if (!question) throw fault(400, `这套卷没有第 ${change.question} 题。`);
        if (question.correctAnswer === change.suggestedAnswer)
          throw fault(400, `第 ${change.question} 题的建议答案与当前参考答案相同。`);
        return { ...change, originalAnswer: question.correctAnswer, status: "pending" };
      });
      const feedback = { id: feedbackId, guestId, attemptId, versionId: version.id,
        paperTitle: version.title, versionLabel: version.versionLabel,
        baseRevision, createdAt: Date.now(), items };
      data.feedbacks.unshift(feedback);
      return { feedback: viewFeedback(store, feedback), replayed: false };
    });
  };

  const list = (input) => {
    const guestId = id(input.guestId, "本机身份凭证");
    const store = readCatalog();
    const data = dataOf(store);
    const ownedReceipts = new Map(Object.entries(store.receipts).filter(([key]) => key.startsWith(`${guestId}:`)));
    const notifications = data.revisions.flatMap((revision) => revision.attemptChanges
      .filter((change) => ownedReceipts.has(change.receiptKey))
      .map(({ receiptKey, ...change }) => ({
        ...change, id: `${revision.id}:${change.attemptId}`, revisionId: revision.id,
        reviewId: revision.reviewId, feedbackId: revision.feedbackId,
        versionId: revision.versionId, paperTitle: revision.paperTitle, versionLabel: revision.versionLabel,
        fromRevision: revision.fromRevision, toRevision: revision.toRevision,
        reason: revision.reason, createdAt: revision.createdAt, changes: revision.changes,
      })));
    return {
      feedbacks: data.feedbacks.filter((feedback) => feedback.guestId === guestId).map((feedback) => viewFeedback(store, feedback)),
      notifications,
    };
  };

  const preview = (input) => {
    const guestId = id(input.guestId, "本机身份凭证");
    const store = readCatalog();
    const feedback = dataOf(store).feedbacks.find((item) => item.id === input.feedbackId && item.guestId === guestId);
    if (!feedback) throw fault(404, "找不到这份反馈。");
    const receipt = receiptFor(store, guestId, input.attemptId ?? feedback.attemptId);
    if (receipt.versionId !== feedback.versionId) throw fault(400, "只能试算同一套卷版本的答卷。");
    const version = versionFor(store, feedback.versionId);
    const pending = feedback.items.filter((item) => item.status === "pending");
    if (!pending.length) throw fault(409, "这份反馈已经处理，请查看最新正式报告。");
    if (pending.some((item) => isStale(store, feedback, item)))
      throw fault(409, "反馈依据的答案已订正，请按最新参考答案重新反馈。");
    const projectedVersion = structuredClone(version);
    for (const item of pending) projectedVersion.questions[item.question - 1].correctAnswer = item.suggestedAnswer;
    const official = gradeVersion(version, receipt.answers);
    const projected = gradeVersion(projectedVersion, receipt.answers);
    return { hypothetical: true, baseRevision: revisionOf(version), attemptId: receipt.id,
      official: scoreSummary(official), projected: scoreSummary(projected),
      deltaCents: projected.totalCents - official.totalCents,
      changes: pending.map((item) => ({ question: item.question, officialAnswer: item.originalAnswer,
        suggestedAnswer: item.suggestedAnswer, answer: receipt.answers[item.question - 1],
        beforeStatus: official.rows[item.question - 1].status, afterStatus: projected.rows[item.question - 1].status })) };
  };

  const admin = (input) => {
    authorize(input);
    const store = readCatalog();
    return { ...pendingSummary(store),
      feedbacks: dataOf(store).feedbacks.map((feedback) => viewFeedback(store, feedback)),
      reviews: structuredClone(dataOf(store).reviews),
      versions: store.versions.map((version) => ({ id: version.id, answerRevision: revisionOf(version),
        receiptCount: Object.values(store.receipts).filter((receipt) => receipt.versionId === version.id && !receipt.isSample).length })),
    };
  };

  const review = async (input) => {
    authorize(input);
    const reviewId = id(input.reviewId, "审核编号");
    const feedbackId = id(input.feedbackId, "反馈编号");
    const selected = questionNumbers(input.questionNumbers);
    if (!["approve", "reject"].includes(input.decision)) throw fault(400, "请选择通过或拒绝。");
    const reason = text(input.reason, "审核理由", 2000);
    const expectedRevision = validRevision(input.expectedRevision);
    const requestFields = { feedbackId, questionNumbers: selected, decision: input.decision, reason, expectedRevision };
    return transact((store) => {
      // 凭证可能在请求排队时被撤销，事务执行前再次核验；任何凭证均不写入持久化对象。
      authorize(input);
      const data = writableData(store);
      const prior = data.reviews.find((item) => item.id === reviewId);
      if (prior) {
        if (JSON.stringify(prior.request) !== JSON.stringify(requestFields))
          throw fault(409, "审核编号已用于其他结论，请刷新待审队列。");
        const feedback = data.feedbacks.find((item) => item.id === feedbackId);
        return { feedback: viewFeedback(store, feedback), review: structuredClone(prior), replayed: true };
      }
      const feedback = data.feedbacks.find((item) => item.id === feedbackId);
      if (!feedback) throw fault(404, "找不到这份反馈。");
      const items = selected.map((number) => feedback.items.find((item) => item.question === number));
      if (items.some((item) => !item)) throw fault(400, "所选题号不属于这份反馈。");
      if (items.some((item) => item.status !== "pending")) throw fault(409, "所选题目已有审核结论，请刷新待审队列。");
      const version = versionFor(store, feedback.versionId);
      const currentRevision = revisionOf(version);
      if (input.decision === "approve" && (currentRevision !== expectedRevision || items.some((item) => isStale(store, feedback, item))))
        throw fault(409, "参考答案已修订，所选依据可能过期，请刷新后重新核对。");
      const createdAt = Date.now();
      let revision = null;
      if (input.decision === "approve") {
        const changes = items.map((item) => ({ question: item.question,
          beforeAnswer: version.questions[item.question - 1].correctAnswer, afterAnswer: item.suggestedAnswer }));
        for (const item of items) version.questions[item.question - 1].correctAnswer = item.suggestedAnswer;
        version.answerRevision = currentRevision + 1;
        revision = { id: randomUUID(), reviewId, feedbackId, versionId: version.id,
          paperTitle: version.title, versionLabel: version.versionLabel,
          fromRevision: currentRevision, toRevision: version.answerRevision, createdAt, reason,
          changes, attemptChanges: [] };
        // 全版本答卷共享新标准答案；不动 answers、createdAt 或其他参与信息，也不使用分数缓存。
        for (const [receiptKey, receipt] of Object.entries(store.receipts)) {
          if (receipt.versionId !== version.id || receipt.isSample) continue;
          const before = scoreSummary(receipt.report);
          const report = gradeVersion(version, receipt.answers);
          const after = scoreSummary(report);
          const change = { revisionId: revision.id, reviewId, createdAt,
            fromRevision: currentRevision, toRevision: version.answerRevision,
            questionNumbers: selected, before, after, deltaCents: after.totalCents - before.totalCents };
          receipt.report = report;
          receipt.answerRevision = version.answerRevision;
          receipt.correctionHistory ??= [];
          receipt.correctionHistory.push(change);
          revision.attemptChanges.push({ receiptKey, attemptId: receipt.id, before, after, deltaCents: change.deltaCents });
        }
        data.revisions.unshift(revision);
      }
      for (const item of items) Object.assign(item, { status: input.decision === "approve" ? "approved" : "rejected",
        reviewId, reviewedAt: createdAt, reason, ...(revision ? { answerRevision: revision.toRevision } : {}) });
      const record = { id: reviewId, request: requestFields, createdAt, actor: "maintainer",
        versionId: version.id, fromRevision: currentRevision, toRevision: revisionOf(version),
        affectedAttempts: revision?.attemptChanges.length ?? 0, revisionId: revision?.id ?? null };
      data.reviews.unshift(record);
      store.audit.unshift({ id: reviewId, action: input.decision === "approve" ? "审核通过纠错" : "拒绝纠错反馈",
        target: `${version.title} · v${version.versionLabel} · 第 ${selected.join("、")} 题`,
        createdAt, correctionReviewId: reviewId, answerRevision: revisionOf(version), reason });
      return { feedback: viewFeedback(store, feedback), review: structuredClone(record), replayed: false };
    });
  };

  return async function handle({ pathname, method, input, send }) {
    if (!pathname.startsWith("/api/corrections/")) return false;
    if (pathname !== "/api/corrections/submit" && pathname !== "/api/corrections/review") await pendingChanges;
    let result;
    if (method === "GET" && pathname === "/api/corrections/summary") result = pendingSummary(readCatalog());
    else if (method === "POST") {
      const handler = { "/api/corrections/submit": submit, "/api/corrections/list": list,
        "/api/corrections/preview": preview, "/api/corrections/admin": admin,
        "/api/corrections/review": review }[pathname];
      if (!handler) return false;
      result = await handler(input);
    } else return false;
    send(200, result);
    return true;
  };
}
