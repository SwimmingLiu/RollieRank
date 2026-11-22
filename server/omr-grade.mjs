import { gradeVersion } from "../src/model.js";
import { summarize } from "./omr.mjs";

const fault = (statusCode, message) => Object.assign(new Error(message), { statusCode });

// 识别结果先做“套卷对号”：选择题按题号直接比对，缺答按空题计分，不猜测。
export function scoreOcrResult(version, recognized) {
  const answers = version.questions.map((question) => {
    const hit = recognized.questions.find((item) => item.number === question.number);
    return hit?.answer ?? null;
  });
  const report = gradeVersion(version, answers);
  return { answers, report };
}

export function createOmrGradeService({ readCatalog }) {
  return async function handle({ pathname, method, input, send }) {
    // 只接管 /api/omr/grade 本身；其余 /api/omr/* 归识别服务。
    if (pathname !== "/api/omr/grade" || method !== "POST") return false;
    const versionId = input?.versionId;
    if (typeof versionId !== "string") throw fault(400, "请指定要对照的套卷版本。");
    const store = readCatalog();
    const version = store.versions.find((item) => item.id === versionId && item.status !== "draft");
    if (!version) throw fault(404, "找不到这套卷版本。");
    const recognized = input.recognized;
    if (!recognized || !Array.isArray(recognized.questions))
      throw fault(400, "请先识别答题卡再对照打分。");
    if (recognized.questions.length && recognized.questions.length !== version.questions.length)
      throw fault(400, `这套卷共 ${version.questions.length} 题，识别结果有 ${recognized.questions.length} 题，请核对答题卡与套卷是否匹配。`);
    const { answers, report } = scoreOcrResult(version, recognized);
    send(200, {
      versionId: version.id,
      paperTitle: version.title,
      answers,
      report,
      unrecognized: answers.filter((answer) => answer === null).length,
    });
    return true;
  };
}

// 单独暴露给 CLI 与验证脚本复用。
export { summarize };
