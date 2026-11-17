import { roundedScoreRatio } from "./model.js";

const names = [
  "小林同学",
  "认真做题的阿圆",
  "向岸而行",
  "一颗小栗子",
  "每天多一分",
  "卷卷不倦",
  "晚风有信",
  "山海可平",
  "小周今天上岸了吗",
  "晨间自习室",
  "一只考考",
  "慢慢来会比较快",
];

export function demoEntries(version) {
  // 演示成绩也从可达的单题分值相加，避免生成 0.85 分题型中不可能出现的分数。
  const order = [...version.questions].sort(
    (a, b) =>
      (Math.imul(a.number, 2654435761) >>> 0) -
      (Math.imul(b.number, 2654435761) >>> 0),
  );
  // 新参考卷可能折算到百分制；演示用户必须与本人提交使用相同满分和总分舍入规则。
  const rawMaximum = version.questions.reduce((n, q) => n + q.cents, 0);
  const target = version.scoringRule?.normalizationMaxCents ?? rawMaximum;
  return names.map((name, index) => {
    const rate = [
      0.89, 0.862, 0.862, 0.834, 0.81, 0.792, 0.775, 0.751, 0.73, 0.705, 0.668,
      0.612,
    ][index];
    const correct = new Set(
      order.slice(0, Math.round(order.length * rate)).map((q) => q.number),
    );
    const breakdown = [...new Set(version.questions.map((q) => q.typeId))].map(
      (id) => {
        const questions = version.questions.filter((q) => q.typeId === id);
        const maxCents = questions.reduce((n, q) => n + q.cents, 0) * target / rawMaximum;
        return {
          id,
          maxCents,
          centsEarned: questions
            .filter((q) => correct.has(q.number))
            .reduce((n, q) => n + q.cents, 0) * target / rawMaximum,
        };
      },
    );
    return {
      userId: `demo-${index}`,
      name,
      versionId: version.id,
      createdAt: 1793952000000 + index * 60000,
      totalCents: roundedScoreRatio(
        version.questions.filter((q) => correct.has(q.number)).reduce((n, q) => n + q.cents, 0),
        rawMaximum, target,
      ),
      breakdown,
      isDemo: true,
    };
  });
}

export function rankEntries(
  entries,
  { versionId, dimension = "total", minimum = 10 } = {},
) {
  const best = new Map();
  for (const entry of entries.filter((item) => item.versionId === versionId)) {
    const part = entry.breakdown.find((item) => item.id === dimension);
    const value =
      dimension === "total" ? entry.totalCents : (part?.centsEarned ?? 0);
    const maxCents = dimension === "total" ? null : part?.maxCents;
    if (dimension !== "total" && value === 0) continue;
    const score = maxCents ? value / maxCents : value;
    const previous = best.get(entry.userId);
    if (
      !previous ||
      score > previous.score ||
      (score === previous.score && entry.createdAt < previous.createdAt)
    )
      best.set(entry.userId, { ...entry, value, score, maxCents });
  }
  const rows = [...best.values()].sort(
    (a, b) => b.score - a.score || a.createdAt - b.createdAt,
  );
  let rank = 0;
  return {
    count: rows.length,
    visible: rows.length >= minimum,
    rows: rows.map((entry, index) => {
      if (!index || entry.score !== rows[index - 1].score) rank = index + 1;
      return { ...entry, rank };
    }),
  };
}
