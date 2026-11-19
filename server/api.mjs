import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PAPERS } from "../src/data/papers.js";
import { IMPORTED_PAPERS } from "../src/data/imported-papers.js";
import { DEFAULT_RULES } from "../src/scoring.js";
import { createMiniprogramWebService } from "./miniprogram-web.mjs";
import { createDiscussionsService } from "./discussions.mjs";
import { createCorrectionsService } from "./corrections.mjs";
import { createPositionsService, includeSubmittedAttempt, initializeDefaultParticipation } from "./positions.mjs";
import { resolveTimerLimit, timerSectionsForQuestions, validateTimingSummary } from "../src/practice-timer.js";
import {
  gradeVersion,
  parseQuestionCsv,
  publicVersion,
  validateQuestions,
  roundedScoreRatio,
} from "../src/model.js";

// 原入口给所有卷套用一期130题规则；新来源使用逐卷身份、题型和计分依据，原有版本保持稳定。
const builtins = () => [
  ...PAPERS.map((paper) => ({
    id: `${paper.id}:v1`,
    paperId: paper.id,
    number: paper.number,
    title: paper.title,
    timeLimitMinutes: paper.timeLimitMinutes,
    timeLimitKind: paper.timeLimitKind,
    timeLimitSource: paper.timeLimitSource,
    institution: "四海",
    project: "2026 下半年 · 国考行测",
    period: "一期",
    variant: "地市级 / 行政执法类",
    versionLabel: "1.0",
    status: "published",
    createdAt: 1793894400000,
    questions: [...paper.answerKey].map((correctAnswer, i) => {
      const rule = DEFAULT_RULES.find(
        (r) => i + 1 >= r.start && i + 1 <= r.end,
      );
      return {
        number: i + 1,
        correctAnswer,
        type: rule.name,
        typeId: rule.id,
        cents: rule.cents,
      };
    }),
  })),
  ...IMPORTED_PAPERS.map((paper) => ({
    id: `${paper.id}:v1`,
    paperId: paper.id,
    number: paper.number,
    title: paper.title,
    timeLimitMinutes: paper.timeLimitMinutes,
    timeLimitKind: paper.timeLimitKind,
    timeLimitSource: paper.timeLimitSource,
    institution: paper.institution,
    project: paper.project,
    period: paper.period,
    variant: paper.variant,
    versionLabel: "1.0",
    status: "published",
    createdAt: Date.now(),
    scoringRule: paper.scoringRule,
    sources: paper.sources,
    questions: [...paper.answerKey].map((correctAnswer, i) => {
      const section = paper.sections.find((s) => i + 1 >= s.start && i + 1 <= s.end);
      return { number: i + 1, correctAnswer, type: section.name,
        typeId: section.id, cents: section.cents };
    }),
  })),
];

// 功能模块共用一个落盘事务，答案订正与成绩变化才能同时保存和回滚。
export async function createApi({ dataDirectory, featureFactories = [createPositionsService, createDiscussionsService, createCorrectionsService, createMiniprogramWebService] }) {
  let saved;
  try {
    saved = JSON.parse(
      await readFile(new URL("catalog.json", dataDirectory), "utf8"),
    );
  } catch (error) {
    if (error.code !== "ENOENT")
      throw new Error("本机套卷数据损坏，请先备份并检查 catalog.json。", {
        cause: error,
      });
  }
  // 已有本机目录不能遮住新增内置卷，也不能覆盖自定义卷、下线状态或历史提交。
  const packaged = builtins();
  const missing = packaged.filter((v) => !saved?.versions.some((prior) => prior.id === v.id));
  let timeMetadataUpdated = false;
  // 补已核实的卷首时限；不覆盖自定义时限、答题内容、下线状态或答案订正。
  let versions = saved ? [...saved.versions.map(version => {
    const source = packaged.find(paper => paper.id === version.id);
    if (!source?.timeLimitMinutes || version.timeLimitMinutes !== undefined) return version;
    timeMetadataUpdated = true;
    return { ...version, timeLimitMinutes: source.timeLimitMinutes, timeLimitKind: source.timeLimitKind, timeLimitSource: source.timeLimitSource };
  }), ...missing] : packaged;
  let audit = saved?.audit ?? [];
  let receipts = saved?.receipts ?? {};
  let features = saved?.features ?? {};
  let queue = Promise.resolve();
  const persist = async () => {
    const content = JSON.stringify({ versions, audit, receipts, features });
    await mkdir(dataDirectory, { recursive: true });
    const temp = new URL("catalog.tmp", dataDirectory);
    await writeFile(temp, content);
    await rename(temp, new URL("catalog.json", dataDirectory));
  };
  if (saved && (missing.length || timeMetadataUpdated)) await persist();
  // 文件写入失败时同步回滚内存；同一提交的并发重试必须等到前一次写入完成。
  const mutate = (operation) => {
    const task = queue
      .catch(() => {})
      .then(async () => {
        const before = structuredClone({ versions, audit, receipts, features });
        try {
          const result = operation();
          await persist();
          return result;
        } catch (error) {
          ({ versions, audit, receipts, features } = before);
          throw error;
        }
      });
    queue = task;
    return task;
  };
  const log = (action, target) =>
    audit.unshift({ id: randomUUID(), action, target, createdAt: Date.now() });
  const send = (response, status, body) => {
    response.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(JSON.stringify(body));
  };
  const readCatalog = () => ({ versions, audit, receipts, features });
  // 正式练习默认纳入榜单；首轮迁移只补真实回执，既有显式撤回意图由岗位模块保留。
  if (initializeDefaultParticipation(readCatalog())) await persist();
  const mutateCatalog = (operation) => mutate(() => operation(readCatalog()));
  const services = [];
  for (const factory of featureFactories)
    services.push(await factory({ readCatalog, mutateCatalog, dataDirectory }));
  return async (request, response, pathname) => {
    if (!pathname.startsWith("/api/")) return false;
    try {
      if (request.method === "GET") await queue.catch(() => {});
      const query = new URL(request.url, "http://localhost").searchParams;
      const dispatchFeatures = async (input) => {
        for (const service of services)
          if (await service({ request, response, pathname, method: request.method,
            input, query, send: (status, body) => send(response, status, body) }))
            return true;
        return false;
      };
      // 本地默认无需凭证；配置维护者凭证后，管理接口必须带匹配的 Bearer 令牌。
      const requireAdmin = () => {
        const expected = process.env.ROLLIERANK_REVIEW_TOKEN?.trim();
        if (!expected) return;
        const header = request.headers.authorization ?? "";
        const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
        if (provided !== expected) {
          const error = new Error("需要维护者凭证。");
          error.statusCode = 401;
          throw error;
        }
      };
      if (request.method === "GET" && await dispatchFeatures(undefined)) return true;
      if (request.method === "GET" && pathname === "/api/catalog") {
        send(response, 200, {
          versions: versions
            .filter((v) => v.status !== "draft")
            .map(publicVersion),
        });
        return true;
      }
      if (request.method === "GET" && pathname === "/api/admin") {
        requireAdmin();
        send(response, 200, {
          versions: versions.map(publicVersion),
          audit: audit.slice(0, 50),
        });
        return true;
      }
      if (request.method !== "POST") {
        send(response, 404, { error: "接口不存在。" });
        return true;
      }
      if (
        request.headers.origin &&
        new URL(request.headers.origin).host !== request.headers.host
      ) {
        send(response, 403, { error: "请从当前本地页面操作。" });
        return true;
      }
      const chunks = [];
      let bodyBytes = 0;
      // 音频和图片需允许有界的媒体请求，其余接口继续保持原来的 1 MB 限额。
      const bodyLimit = (pathname.startsWith("/api/discussions") || pathname === "/api/miniprogram-web/poster")
        ? 8 * 1024 * 1024 : 1024 * 1024;
      for await (const chunk of request) {
        // 逐块转字符串会损坏跨块的中文字符；先按字节计数，完整接收后再解码。
        const buffer = Buffer.from(chunk);
        bodyBytes += buffer.length;
        if (bodyBytes > bodyLimit)
          throw new Error(`内容不能超过 ${bodyLimit / 1024 / 1024} MB。`);
        chunks.push(buffer);
      }
      const body = Buffer.concat(chunks).toString("utf8");
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        throw new Error("请求内容应为 JSON。");
      }
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw new Error("请求内容无效。");
      if (await dispatchFeatures(input)) return true;
      // 历史快照原来只存在浏览器，审核订正后需按本机凭证取回服务端的新成绩。
      if (pathname === "/api/attempts/sync") {
        if (!/^[\w-]{10,80}$/.test(input.guestId ?? "") ||
          (input.attemptIds !== undefined && (!Array.isArray(input.attemptIds) ||
            !input.attemptIds.every((id) => typeof id === "string"))))
          throw new Error("本机记录凭证无效。");
        await queue.catch(() => {});
        const ids = input.attemptIds ? new Set(input.attemptIds) : null;
        const attempts = Object.entries(receipts)
          .filter(([key, attempt]) => key.startsWith(input.guestId + ":") &&
            (!ids || ids.has(attempt.id)))
          .map(([, attempt]) => attempt);
        send(response, 200, { attempts });
        return true;
      }
      if (pathname === "/api/attempts/delete") {
        if (
          !/^[\w-]{10,80}$/.test(input.guestId ?? "") ||
          !Array.isArray(input.attemptIds) ||
          !input.attemptIds.every((id) => typeof id === "string")
        )
          throw new Error("本机记录凭证无效。");
        const ids = new Set(input.attemptIds);
        await mutate(() => {
          for (const key of Object.keys(receipts))
            if (
              key.startsWith(input.guestId + ":") &&
              ids.has(receipts[key].id)
            )
              delete receipts[key];
        });
        send(response, 200, { deleted: true });
        return true;
      }
      if (pathname === "/api/submit" || pathname === "/api/sample") {
        const isSample = pathname === "/api/sample";
        const createAttempt = () => {
          let version = versions.find((v) => v.id === input.versionId);
          if (!version)
            throw new Error("找不到这套卷，草稿仍保留，请刷新目录。");
          if (
            !isSample &&
            (!/^[\w-]{10,80}$/.test(input.guestId ?? "") ||
              !/^[\w-]{10,80}$/.test(input.attemptId ?? ""))
          )
            throw new Error("答卷凭证无效，请刷新后重试。");
          const key = `${input.guestId}:${input.attemptId}`;
          if (!isSample && receipts[key]) {
            const receipt = receipts[key];
            if (
              receipt.versionId !== version.id ||
              JSON.stringify(receipt.answers) !== JSON.stringify(input.answers)
            )
              throw new Error("这次答卷已经提交，请从历史查看，或创建新练习。");
            return receipt;
          }
          if (version.status !== "published")
            throw new Error("这套卷已下线，草稿仍保留，请选择其他套卷。");
          const practiceVersionId = version.id;
          // 示例报告使用独立虚构答案，避免在正式答卷提交前借预览泄露真实参考答案。
          if (isSample)
            version = {
              ...version,
              id: "sample-preview:v1",
              paperId: "sample-preview",
              title: "行测练习 · 示例卷",
              institution: "示例",
              questions: version.questions.map((q, i) => ({
                ...q,
                correctAnswer: ["A", "B", "C", "D"][i % 4],
              })),
            };
          const answers = isSample
            ? version.questions.map((q, i) =>
                i % 11 === 0
                  ? null
                  : i % 4 === 0
                    ? ["A", "B", "C", "D"].find((a) => a !== q.correctAnswer)
                    : q.correctAnswer,
              )
            : input.answers;
          // 仅保存显式结束的做题计时，不用提交时间或录答时间推算做题耗时。
          const timing = !isSample && input.timing !== undefined ? validateTimingSummary(input.timing,
            { versionId: version.id, attemptId: input.attemptId, sections: timerSectionsForQuestions(version.questions), timeLimitMinutes: resolveTimerLimit(version).minutes }) : null;
          const report = gradeVersion(version, answers);
          const attempt = {
            id: isSample ? `sample-${version.id}` : input.attemptId,
            versionId: version.id,
            paperId: version.paperId,
            paperTitle: version.title,
            institution: version.institution,
            project: version.project,
            period: version.period,
            variant: version.variant,
            versionLabel: version.versionLabel,
            // 新提交须绑定实际使用的答案修订，避免订正后的答卷仍按初版基准反馈。
            answerRevision: version.answerRevision ?? 0,
            createdAt: Date.now(),
            answers,
            report,
            ...(timing ? { timing } : {}),
            ...(version.scoringRule ? { scoringRule: structuredClone(version.scoringRule) } : {}),
            isSample,
            ...(isSample ? { practiceVersionId } : {}),
          };
          if (!isSample) {
            receipts[key] = attempt;
            // 上榜与计分在同一事务保存，避免交卷成功但榜单漏记或重复加入。
            includeSubmittedAttempt(readCatalog(), { guestId: input.guestId, attempt,
              ...(typeof input.name === "string" ? { name: input.name } : {}) });
          }
          return attempt;
        };
        if (isSample) await queue.catch(() => {});
        const attempt = isSample
          ? createAttempt()
          : await mutate(createAttempt);
        send(response, 200, attempt);
        return true;
      }
      if (pathname === "/api/admin/import") {
        requireAdmin();
        const questions = parseQuestionCsv(input.csv);
        for (const field of [
          "title",
          "institution",
          "project",
          "period",
          "variant",
        ])
          if (
            typeof input[field] !== "string" ||
            !input[field].trim() ||
            input[field].length > 100
          )
            throw new Error(
              "请填写完整的套卷名称、机构、项目、期数和卷别（各不超过 100 字）。",
            );
        const result = await mutate(() => {
          const prior = input.revisionOf
            ? versions.find(
                (v) => v.id === input.revisionOf && v.status !== "draft",
              )
            : null;
          if (input.revisionOf && !prior) throw new Error("找不到原始版本。");
          if (
            prior &&
            (questions.length !== prior.questions.length ||
              questions.some((q, i) => q.type !== prior.questions[i].type))
          )
            throw new Error("题量或题型结构发生变化，请作为新套卷导入。");
          const paperId = prior?.paperId ?? `custom-${randomUUID()}`;
          const versionLabel = prior
            ? `${Math.max(...versions.filter((v) => v.paperId === paperId).map((v) => Number.parseInt(v.versionLabel))) + 1}.0`
            : "1.0";
          const version = {
            id: `${paperId}:v${versionLabel}`,
            paperId,
            number: prior?.number ?? versions.length + 1,
            title: input.title.trim(),
            institution: input.institution.trim(),
            project: input.project.trim(),
            period: input.period.trim(),
            variant: input.variant.trim(),
            versionLabel,
            status: "draft",
            createdAt: Date.now(),
            questions,
            // 修订参考卷仍须按同一百分制折算；否则只改答案也会把满分退回原始权重总和。
            ...(prior?.scoringRule?.kind === "reference"
              ? { scoringRule: structuredClone(prior.scoringRule) }
              : {}),
          };
          versions.push(version);
          log("导入草稿", `${version.title} · v${versionLabel}`);
          return publicVersion(version);
        });
        send(response, 200, result);
        return true;
      }
      if (pathname === "/api/admin/status") {
        requireAdmin();
        const result = await mutate(() => {
          const version = versions.find((v) => v.id === input.versionId);
          if (!version || !["published", "offline"].includes(input.status))
            throw new Error("套卷或发布状态无效。");
          validateQuestions(version.questions);
          if (input.status === "published") {
            const allRight = gradeVersion(
              version,
              version.questions.map((q) => q.correctAnswer),
            );
            const allBlank = gradeVersion(
              version,
              version.questions.map(() => null),
            );
            const allWrong = gradeVersion(
              version,
              version.questions.map((q) =>
                ["A", "B", "C", "D"].find((a) => a !== q.correctAnswer),
              ),
            );
            const mixed = gradeVersion(
              version,
              version.questions.map((q, index) =>
                index % 2 ? null : q.correctAnswer,
              ),
            );
            // 参考卷的满分可能由原始权重折算；试算须按相同满分验算，不能拿原始权重与百分制结果比较。
            const mixedRaw = version.questions.reduce(
              (n, q, index) => n + (index % 2 ? 0 : q.cents),
              0,
            );
            const rawMaximum = version.questions.reduce((n, q) => n + q.cents, 0);
            const mixedExpected = roundedScoreRatio(mixedRaw, rawMaximum, allRight.maxCents);
            if (
              allRight.totalCents !== allRight.maxCents ||
              allBlank.totalCents !== 0 ||
              allWrong.totalCents !== 0 ||
              mixed.totalCents !== mixedExpected
            )
              throw new Error("试算失败，不能发布。");
          }
          version.status = input.status;
          log(
            input.status === "published" ? "发布套卷" : "下线套卷",
            `${version.title} · v${version.versionLabel}`,
          );
          return publicVersion(version);
        });
        send(response, 200, result);
        return true;
      }
      send(response, 404, { error: "接口不存在。" });
    } catch (error) {
      const message = error.code
        ? "本机数据保存失败，请检查磁盘空间后重试，原答卷仍保留。"
        : error.message;
      // 授权审核等模块需保留 401/403/409 状态，不能把权限和冲突统一改成输入错误。
      const status = Number.isInteger(error.statusCode) && error.statusCode >= 400 &&
        error.statusCode <= 599 ? error.statusCode : 400;
      send(response, status, { error: message });
    }
    return true;
  };
}
