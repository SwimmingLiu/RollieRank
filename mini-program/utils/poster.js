const { drawRadar } = require("./report.js");

const WIDTH = 450;
const COLORS = { paper: "#fcf8ef", white: "#fffdf8", line: "#eadcc5", cover: "#f1e0bb", ink: "#3e3628", muted: "#8a775c", gold: "#b6874a" };

function posterHeight(mode, bands) {
  if (mode === "full") return 774 + bands.length * 34;
  if (mode === "types") return Math.max(360, 158 + bands.length * 38);
  return mode === "radar" ? 464 : 348;
}

function drawPoster(ctx, { mode, summary, bands, images }) {
  const height = posterHeight(mode, bands);
  const { paper, white, line, cover, ink, muted, gold } = COLORS;
  const text = (value, x, y, size, color = ink, weight = 450, family = "Nunito, FangYuan, sans-serif", limit = WIDTH - x - 20) => {
    ctx.fillStyle = color;
    ctx.font = weight + " " + size + "px " + family;
    ctx.fillText(String(value), x, y, limit);
  };
  const box = (x, y, w, h, r, color, stroke) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  };
  const rule = y => {
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(WIDTH - 24, y);
    ctx.stroke();
  };

  box(.5, .5, WIDTH - 1, height - 1, 20, paper, line);
  if (images.publisher) ctx.drawImage(images.publisher, 23, 28, 22, 22);
  text(summary.identity, images.publisher ? 54 : 24, 47, 14, ink, 600);
  rule(68);

  const drawScore = () => {
    box(24, 84, WIDTH - 48, 140, 19, cover);
    text(summary.score, 44, 168, summary.score.length > 5 ? 64 : 70, ink, 750, "Fraunces, Georgia, serif", 280);
    text("/ " + summary.max + " 分", 44, 199, 12, muted);
    if (images.medal) ctx.drawImage(images.medal, WIDTH - 117, 111, 75, 82);
    [
      { value: summary.correct, label: "正确", tint: "#557d51" },
      { value: summary.wrong, label: "错误", tint: "#b26045" },
      { value: summary.blank, label: "未答", tint: "#998164" },
    ].forEach(({ value, label, tint }, index) => {
      const x = 24 + 137 * index;
      box(x, 238, 128, 44, 12, "#f3ecdc");
      text(value, x + 15, 266, 20, tint, 750);
      text(label, x + 61, 266, 12, muted);
    });
    text("同卷排名", 24, 319, 14, muted);
    if (summary.rank) text(summary.rank + " / " + summary.count, WIDTH - 104, 319, 14, ink, 650);
  };
  const drawChart = y => {
    box(24, y, WIDTH - 48, 330, 18, white, line);
    text("能力概览", 41, y + 33, 17, ink, 750);
    text("本卷得分率", WIDTH - 100, y + 32, 11, muted);
    drawRadar(ctx, bands, 30, y + 41, WIDTH - 60, 271);
  };
  const drawTypes = (y, rowHeight) => {
    box(24, y, WIDTH - 48, 42 + bands.length * rowHeight, 18, white, line);
    text("板块表现", 41, y + 29, 17, ink, 750);
    bands.forEach((band, index) => {
      const row = y + 53 + index * rowHeight;
      text(band.name, 41, row + 6, 14);
      text(band.percent, WIDTH - 91, row + 6, 17, ink, 750, "Fraunces, Georgia, serif");
      box(41, row + 13, WIDTH - 82, 4, 2, "#eee5d4");
      const fill = (WIDTH - 82) * band.rate;
      if (fill >= 4) box(41, row + 13, fill, 4, 2, gold);
    });
  };

  if (mode === "full" || mode === "score") drawScore();
  if (mode === "radar") drawChart(84);
  if (mode === "types") drawTypes(84, 38);
  if (mode === "full") {
    drawChart(345);
    drawTypes(694, 34);
  }
  if (images.brand) ctx.drawImage(images.brand, WIDTH - 49, height - 29, 23, 23);
}

module.exports = { WIDTH, posterHeight, drawPoster };
