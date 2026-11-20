const { subjectName } = require("./catalog.js");
const { percent } = require("./format.js");

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
      pct: rate * 100,
      percentValue: Math.round(rate * 1000) / 10,
      percent: percent(rate),
      earned: cents / 100,
      max: max / 100,
    };
  });
}

function drawRadar(ctx, bands, x, y, width, height) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const radius = Math.min(width / 2 - 62, height / 2 - 28);
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
    const labelY = centerY + dy * (radius + 18);
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

module.exports = { reportBands, drawRadar };
