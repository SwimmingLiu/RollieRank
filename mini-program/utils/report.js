const { subjectName } = require("./catalog.js");
const { score, scoreCard, percent } = require("./format.js");

function reportBands(parts) {
  const groups = new Map();
  for (const part of parts || []) {
    const name = subjectName(part.name);
    const total = groups.get(name) || { name, cents: 0, max: 0 };
    total.cents += part.centsEarned || 0;
    total.max += part.maxCents || 0;
    groups.set(name, total);
  }
  return [...groups.values()].map(({ name, cents, max }) => {
    const rate = max > 0 ? Math.max(0, Math.min(1, cents / max)) : 0;
    return {
      name,
      rate,
      pct: Math.round(rate * 1000) / 10,
      percentValue: Math.round(rate * 1000) / 10,
      percent: percent(rate),
      earnedCents: cents,
      maxCents: max,
      earned: score(cents),
      max: score(max),
    };
  });
}

function samePaper(a, b) {
  if (!a || !b) return false;
  if (a.paperId && b.paperId) return a.paperId === b.paperId;
  return Boolean(a.versionId && b.versionId && a.versionId === b.versionId);
}

function signedPoints(deltaRate) {
  if (!Number.isFinite(deltaRate)) return "—";
  const pts = Math.round(deltaRate * 1000) / 10;
  if (pts === 0) return "持平";
  return `${pts > 0 ? "+" : "−"}${Math.abs(pts)}`;
}

// 选取当前答卷之前、同一套卷且满分与题量一致的最近一次正式作答，用于生成“上次 VS 本次”。
function buildComparison(current, historyList) {
  if (!current || !current.report || !Array.isArray(historyList) || !historyList.length) return null;
  const currentTime = current.createdAt || 0;
  const currentMax = current.report.maxCents || 0;
  const currentCount = Array.isArray(current.answers) ? current.answers.length : (current.questionCount || 0);
  if (!currentMax) return null;

  const priorCandidates = historyList
    .filter(item =>
      item &&
      item.id &&
      item.id !== current.id &&
      samePaper(current, item) &&
      (item.createdAt || 0) < currentTime &&
      (item.maxCents || 0) === currentMax &&
      (!currentCount || !item.questionCount || item.questionCount === currentCount)
    )
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  const previous = priorCandidates[priorCandidates.length - 1];
  if (!previous) return null;

  const prevCents = Number(previous.totalCents) || 0;
  const currCents = Number(current.report.totalCents) || 0;
  const deltaCents = currCents - prevCents;
  const deltaTone = deltaCents > 0 ? "up" : deltaCents < 0 ? "down" : "same";
  const deltaText = deltaCents === 0
    ? "持平"
    : `${deltaCents > 0 ? "+" : "−"}${scoreCard(Math.abs(deltaCents))}`;

  const prevRate = previous.maxCents ? prevCents / previous.maxCents : (previous.rate || 0);
  const currRate = currentMax ? currCents / currentMax : (current.report.rate || 0);
  const prevAcc = previous.questionCount ? (previous.correct || 0) / previous.questionCount : null;
  const currAcc = currentCount ? (current.report.correct || 0) / currentCount : null;

  const prevBands = new Map(reportBands(previous.subjects || []).map(item => [item.name, item]));
  const currBands = reportBands(current.report.breakdown || []);
  const subjects = currBands.map(curr => {
    const prev = prevBands.get(curr.name);
    const beforeRate = prev ? prev.rate : null;
    const deltaRate = beforeRate === null ? null : curr.rate - beforeRate;
    const roundedPts = deltaRate === null ? null : Math.round(deltaRate * 1000) / 10;
    const tone = roundedPts === null ? "same" : roundedPts > 0 ? "up" : roundedPts < 0 ? "down" : "same";
    return {
      name: curr.name,
      beforePct: beforeRate === null ? null : Math.round(beforeRate * 1000) / 10,
      afterPct: curr.pct,
      beforeText: beforeRate === null ? "—" : percent(beforeRate),
      afterText: curr.percent,
      deltaText: signedPoints(deltaRate),
      tone,
    };
  });

  return {
    previousId: previous.id,
    attemptCount: priorCandidates.length + 1,
    previousScore: scoreCard(prevCents),
    currentScore: scoreCard(currCents),
    deltaCents,
    deltaText,
    deltaTone,
    rates: [
      { key: "rate", label: "得分率", before: percent(prevRate), after: percent(currRate) },
      { key: "accuracy", label: "正确率", before: prevAcc === null ? "—" : percent(prevAcc), after: currAcc === null ? "—" : percent(currAcc) },
    ],
    subjects,
  };
}

function drawRadar(ctx, bands, x, y, width, height) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const radius = Math.min(width / 2 - 64, height / 2 - 34);
  if (radius <= 0 || bands.length < 3) return;
  const axes = bands.map((_, index) => {
    const angle = index * Math.PI * 2 / bands.length - Math.PI / 2;
    return [Math.cos(angle), Math.sin(angle)];
  });
  const plot = (values) => {
    ctx.beginPath();
    axes.forEach(([dx, dy], index) => {
      const px = centerX + dx * radius * values[index];
      const py = centerY + dy * radius * values[index];
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  };

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#e6dac4";
  for (const tick of [.25, .5, .75, 1]) {
    plot(bands.map(() => tick));
    ctx.stroke();
  }
  for (const [dx, dy] of axes) {
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + dx * radius, centerY + dy * radius);
    ctx.stroke();
  }
  ctx.font = '10px Nunito, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "#a49782";
  for (const tick of [.25, .5, .75, 1]) {
    ctx.fillText(Math.round(tick * 100) + "%", centerX, centerY - tick * radius + 1);
  }
  ctx.font = '12px Nunito, FangYuan, sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#746651";
  axes.forEach(([dx, dy], index) => {
    ctx.textAlign = Math.abs(dx) < .1 ? "center" : dx > 0 ? "left" : "right";
    const labelX = centerX + dx * (radius + 12);
    const labelY = centerY + dy * (radius + (Math.abs(dx) < .1 ? 22 : 18));
    ctx.fillText(bands[index].name, labelX, labelY, Math.max(46, (width - radius * 2) / 2));
  });
  plot(bands.map(band => band.rate));
  ctx.fillStyle = "rgba(183, 137, 79, .19)";
  ctx.fill();
  ctx.strokeStyle = "#b68851";
  ctx.lineWidth = 2;
  ctx.stroke();
  axes.forEach(([dx, dy], index) => {
    ctx.beginPath();
    const rate = bands[index].rate;
    ctx.arc(centerX + dx * radius * rate, centerY + dy * radius * rate, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#b68851";
    ctx.fill();
    ctx.strokeStyle = "#fffdf8";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
  ctx.restore();
}

module.exports = { reportBands, buildComparison, drawRadar };
