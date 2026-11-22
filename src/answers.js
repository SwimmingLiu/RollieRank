import { QUESTION_COUNT } from "./scoring.js";

const isBlank = (option) => ["-", "_", "?"].includes(option);

// 原解析器写死 130 题；保留默认行为，并按导入套卷的实际题量阻止越界和意外扩展数组。
export function parseAnswers(
  input,
  startQuestion = 1,
  questionCount = QUESTION_COUNT,
) {
  if (
    !Number.isInteger(questionCount) ||
    questionCount < 1 ||
    questionCount > 300
  )
    throw new Error("套卷题数应在 1–300 之间。");
  if (
    !Number.isInteger(startQuestion) ||
    startQuestion < 1 ||
    startQuestion > questionCount
  )
    throw new Error(`起始题号须在 1–${questionCount} 之间。`);
  const text = input
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[—–－]/g, "-")
    .replace(/第\s*(\d+)\s*题/g, "$1")
    .trim();
  if (!text) throw new Error("请先粘贴答案。");
  const entries = [];
  const seen = new Set();
  const add = (question, option) => {
    if (question < 1 || question > questionCount)
      throw new Error(`第 ${question} 题超出 1–${questionCount} 题范围。`);
    if (seen.has(question))
      throw new Error(`第 ${question} 题重复，请核对后再导入。`);
    seen.add(question);
    entries.push({ question, answer: isBlank(option) ? null : option });
  };
  if (!/\d/.test(text)) {
    const sequence = text.replace(/[\s,，;；、|]/g, "");
    if (!/^[ABCD_?\-]+$/.test(sequence))
      throw new Error("仅支持 A、B、C、D；空题请用 -、_ 或 ? 占位。");
    [...sequence].forEach((option, index) =>
      add(startQuestion + index, option),
    );
  } else {
    let rest = text;
    while (rest) {
      rest = rest.replace(/^[\s,，;；、|]+/, "");
      if (!rest) break;
      const range = rest.match(
        /^(\d+)\s*-{1,2}\s*(\d+)\s*[:.、)]?\s*([ABCD_?\-]+)/,
      );
      const single = rest.match(/^(\d+)\s*[:.、)\s]*([ABCD_?\-])/);
      if (range) {
        const [, first, last, options] = range;
        const start = Number(first);
        const end = Number(last);
        if (end < start || options.length !== end - start + 1)
          throw new Error(`${first}–${last} 题的选项数与题号范围不一致。`);
        [...options].forEach((option, index) => add(start + index, option));
        rest = rest.slice(range[0].length);
      } else if (single) {
        add(Number(single[1]), single[2]);
        rest = rest.slice(single[0].length);
      } else {
        throw new Error(
          `无法识别“${rest.slice(0, 16)}”。请使用 1.A 或 1-5 ABCDA 格式。`,
        );
      }
    }
  }
  if (!entries.length) throw new Error("没有识别到答案。");
  return entries.sort((a, b) => a.question - b.question);
}
