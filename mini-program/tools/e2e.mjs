// 生产接口联调：按小程序的实际调用顺序走一遍。
const BASE = "https://rollie-rank.swimmingliu.cn/api/";
const call = async (path, body) => {
  const res = await fetch(BASE + path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
};
const steps = [];
const check = (name, ok, extra = "") => { steps.push(`${ok ? "ok  " : "FAIL"} ${name} ${extra}`); if (!ok) process.exitCode = 1; };

const run = String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 9) + 1);
const guestId = `aaaaaaaa-${run}-4ef0-9abc-1234567890`.slice(0, 36);
const attemptId = `bbbbbbbb-${run}-4789-8abc-0123456789`.slice(0, 36);

const { data: catalog } = await call("catalog");
const version = catalog.versions.find(v => v.questionCount === 130);
check("套卷目录", Boolean(version), `${catalog.versions.length} 套 / ${version.questionCount} 题 / 满分 ${version.maxCents / 100}`);
check("目录不泄露答案", version.questions.every(q => !("correctAnswer" in q)));

const answers = Array.from({ length: version.questionCount }, (_, i) => ["A", "B", "C", "D"][i % 4]);
const startedAt = Date.now() - 30 * 60000;
const timing = { schema: 2, mode: "whole", origin: "custom", attemptId, versionId: version.id, startedAt, endedAt: startedAt + 30 * 60000,
  plannedMs: 120 * 60000, actualMs: 30 * 60000, entryMs: 0, modules: [{ id: "whole", name: "整卷", plannedMs: 120 * 60000, actualMs: 30 * 60000 }] };
const submitted = await call("submit", { guestId, attemptId, versionId: version.id, name: "卷友", answers, timing });
check("交卷并保存用时", submitted.ok && submitted.data.timing, `总分 ${submitted.data.report?.totalCents / 100}`);
check("重复交卷被拒", (await call("submit", { guestId, attemptId, versionId: version.id, name: "卷友", answers: answers.map(a => (a === "A" ? "B" : a)) })).status === 400);

const synced = await call("attempts/sync", { guestId });
check("记录同步", synced.data.attempts?.[0]?.id === attemptId);

const rank = await call(`positions/leaderboard?versionId=${encodeURIComponent(version.id)}&guestId=${guestId}&scope=nationwide`);
check("全国同卷榜", rank.ok && rank.data.rows?.length >= 1, `参与 ${rank.data.count} 人`);
const dim = version.questions[0].typeId;
const subjectRank = await call(`positions/leaderboard?versionId=${encodeURIComponent(version.id)}&guestId=${guestId}&scope=nationwide&dimension=${encodeURIComponent(dim)}`);
check("题型榜", subjectRank.ok, `dimension=${subjectRank.data.dimension}`);

const posted = await call("discussions", { paperId: version.paperId, attemptId, guestId, clientId: `client-${run}`, nickname: "卷友", text: "第三题资料分析的原文在哪里？" });
const commentId = posted.data.comment?.id;
check("发表评论", posted.ok && Boolean(commentId));
check("点赞", (await call("discussions/like", { paperId: version.paperId, attemptId, guestId, commentId, liked: true })).data.comment?.likeCount === 1);
const reply = await call("discussions", { paperId: version.paperId, attemptId, guestId, clientId: `client2-${run}`, nickname: "卷友", text: "在第三段表格下面。", parentId: commentId });
check("回复", reply.ok && reply.data.comment?.replyTo?.id === commentId);
const list = await call(`discussions?paperId=${encodeURIComponent(version.paperId)}&guestId=${guestId}&attemptId=${attemptId}`);
check("评论列表", list.ok && list.data.comments?.[0]?.replyCount === 1);

const publicId = rank.data.rows?.[0]?.publicId;
const pub = await call(`positions/public-result?publicId=${publicId}&versionId=${encodeURIComponent(version.id)}&guestId=${guestId}&scope=nationwide`);
check("公开成绩（不含他人答卷）", pub.ok && pub.data.result?.subjects?.length > 0);

const positions = await call("positions/catalog?page=1&pageSize=20&exam=guokao");
check("岗位目录", positions.ok && positions.data.items?.length === 20, `共 ${positions.data.total} 个岗位`);
check("选岗", (await call("positions/selection", { guestId, positionId: positions.data.items[0].id })).ok);
check("岗位范围榜单", (await call(`positions/leaderboard?versionId=${encodeURIComponent(version.id)}&guestId=${guestId}&scope=selected`)).ok);
check("错误用时被拒", (await call("submit", { guestId: `cccccccc-${run}-4ef0-9abc-1234567890`.slice(0, 36), attemptId: `dddddddd-${run}-4789-8abc-0123456789`.slice(0, 36), versionId: version.id, answers, timing: { ...timing, plannedMs: 60000 } })).status === 400);

console.log(steps.join("\n"));
console.log(process.exitCode ? "有失败项" : "全部通过");
