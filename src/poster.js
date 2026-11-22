import { score, pct, date } from "./ui.js";

export async function drawPoster(
  canvas,
  attempt,
  { style = "score", name = null, showDate = false } = {},
) {
  await document.fonts.ready;
  const columns = style === "answers" ? 10 : 13;
  const rows = Math.ceil(attempt.report.rows.length / columns);
  canvas.width = style === "answers" ? 1500 : 900;
  canvas.height =
    style === "answers"
      ? Math.max(720, 410 + rows * 47)
      : style === "grid"
        ? Math.max(1200, 900 + rows * 42)
        : 1200;
  const width = canvas.width,
    height = canvas.height;
  const ctx = canvas.getContext("2d");
  const round = (x, y, w, h, radius, fill) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const text = (
    value,
    x,
    y,
    size,
    color = "#685071",
    weight = 400,
    align = "left",
  ) => {
    ctx.font = `${weight} ${size}px "Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(String(value), x, y);
  };
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#f2eaf8");
  gradient.addColorStop(1, "#f8e8ef");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.beginPath();
  ctx.arc(width - 30, 90, 240, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff55";
  ctx.fill();
  // 导出品牌与实际界面共用用户提供的透明标识。
  const brandImage = new Image();
  brandImage.src = "/ios-v3/assets/brand/rollierank-logo-transparent.png";
  await brandImage.decode();
  ctx.drawImage(brandImage, 51, 49, 79, 79);
  text("卷卷小榜", 140, 85, 28, "#644b76", 650);
  text("ROLLIERANK", 141, 108, 13, "#9b84a8", 500);
  text(
    style === "answers" ? "本人复盘存档" : "每一次练习，都有迹可循",
    width - 60,
    95,
    19,
    "#8b7397",
    400,
    "right",
  );
  const title =
    attempt.paperTitle.length > 24
      ? attempt.paperTitle.slice(0, 23) + "…"
      : attempt.paperTitle;
  if (style === "answers") {
    round(58, 160, width - 116, height - 240, 25, "#fffdfef2");
    text(title, 90, 220, 27, "#79578e", 600);
    text(
      `${score(attempt.report.totalCents)} / ${score(attempt.report.maxCents)} 分  ·  v${attempt.versionLabel}  ·  ${name ?? "匿名"}${showDate ? "  ·  " + date(attempt.createdAt) : ""}`,
      width - 90,
      220,
      20,
      "#9a7fab",
      400,
      "right",
    );
    text("题号    我的 / 参考    结果", 90, 268, 17, "#a08ca9");
    const cellWidth = (width - 180) / columns;
    attempt.report.rows.forEach((q, i) => {
      const x = 90 + (i % columns) * cellWidth;
      const y = 290 + Math.floor(i / columns) * 47;
      const color =
        q.status === "wrong"
          ? "#c07590"
          : q.status === "correct"
            ? "#8f6aab"
            : "#b3a0bd";
      const bg =
        q.status === "wrong"
          ? "#fbeef3"
          : q.status === "correct"
            ? "#f4edf9"
            : "#f7f5f9";
      round(x, y, cellWidth - 8, 38, 7, bg);
      text(
        `${q.question}  ${q.answer ?? "·"}/${q.correctAnswer}  ${{ correct: "✓", wrong: "×", blank: "·" }[q.status]}`,
        x + 9,
        y + 25,
        16,
        color,
        500,
      );
    });
    text(
      "含逐题答案，仅供本人复盘。练习估分仅供参考。",
      width / 2,
      height - 32,
      16,
      "#aa8eb2",
      400,
      "center",
    );
    return canvas;
  }
  round(58, 162, width - 116, height - 334, 32, "#fffdfef2");
  text(
    attempt.isSample ? "同卷练习成绩 · 示例" : "同卷练习成绩",
    450,
    228,
    23,
    "#9a839f",
    400,
    "center",
  );
  text(title, 450, 280, 29, "#55415e", 600, "center");
  text(
    `${attempt.institution} · ${attempt.period} · v${attempt.versionLabel}`,
    450,
    319,
    18,
    "#a08ca9",
    400,
    "center",
  );
  text(
    score(attempt.report.totalCents),
    450,
    460,
    130,
    "#79578e",
    650,
    "center",
  );
  text(
    `/ ${score(attempt.report.maxCents)} 分  ·  得分率 ${pct(attempt.report.rate)}`,
    450,
    509,
    25,
    "#a08ca9",
    400,
    "center",
  );
  if (style === "grid") {
    text("逐题表现", 120, 567, 20, "#a08ca9");
    text("✓ 答对    × 答错    · 未答", 780, 567, 17, "#a08ca9", 400, "right");
    const cellWidth = 660 / columns;
    attempt.report.rows.forEach((q, i) => {
      const x = 120 + (i % columns) * cellWidth;
      const y = 589 + Math.floor(i / columns) * 42;
      const color =
        q.status === "wrong"
          ? "#c07590"
          : q.status === "correct"
            ? "#8f6aab"
            : "#b3a0bd";
      const bg =
        q.status === "wrong"
          ? "#fae8f0"
          : q.status === "correct"
            ? "#eee1f5"
            : "#f6f3f9";
      round(x, y, cellWidth - 7, 34, 6, bg);
      text(
        `${q.question}${{ correct: "✓", wrong: "×", blank: "·" }[q.status]}`,
        x + (cellWidth - 7) / 2,
        y + 23,
        13,
        color,
        500,
        "center",
      );
    });
  } else {
    const types = [...attempt.report.breakdown]
      .sort((a, b) => a.centsEarned / a.maxCents - b.centsEarned / b.maxCents)
      .slice(0, 3);
    text("下次，先复盘这几项", 120, 567, 20, "#a08ca9");
    types.forEach((type, i) => {
      const y = 595 + i * 65;
      text(type.name, 120, y + 26, 20, "#6f567b", 500);
      round(265, y + 11, 367, 12, 6, "#f0e8f5");
      if (type.centsEarned)
        round(
          265,
          y + 11,
          (367 * type.centsEarned) / type.maxCents,
          12,
          6,
          i === 0 ? "#d8a2b8" : "#ad8cbd",
        );
      text(
        pct(type.centsEarned / type.maxCents),
        777,
        y + 26,
        20,
        "#79578e",
        600,
        "right",
      );
    });
    round(118, 811, 664, 80, 17, "#f7f2f9");
    text(
      `✓ 答对 ${attempt.report.correct}     × 答错 ${attempt.report.wrong}     · 未答 ${attempt.report.blank}`,
      450,
      860,
      22,
      "#987da5",
      500,
      "center",
    );
  }
  const publicName = name ? name.slice(0, 16) : "一位认真练习的人";
  text(publicName, 450, height - 252, 22, "#795d8c", 500, "center");
  if (showDate)
    text(
      date(attempt.createdAt),
      450,
      height - 213,
      17,
      "#ad95b7",
      400,
      "center",
    );
  text("把每一次进步记下来", 450, height - 111, 27, "#795d8c", 600, "center");
  text(
    "打开卷卷小榜，找到同一套练习",
    450,
    height - 68,
    18,
    "#aa8eb2",
    400,
    "center",
  );
  text("练习估分仅供参考", 450, height - 27, 14, "#b69ebc", 400, "center");
  return canvas;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
