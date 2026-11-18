// 数字展示：分值为整数百分之一分，对外按两位小数展示并去掉多余的零。
function score(cents) {
  if (cents === null || cents === undefined || Number.isNaN(Number(cents))) return "--";
  return (Number(cents) / 100).toFixed(2);
}

function rate(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return Math.round(Number(value) * 1000) / 10;
}

function percent(value) {
  const n = rate(value);
  return n === "--" ? n : `${n}%`;
}

function minutes(ms) {
  if (!ms || ms < 0) return "--";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function dateTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_LABEL = { correct: "正确", wrong: "错误", blank: "未答" };

module.exports = { score, rate, percent, minutes, dateTime, STATUS_LABEL };
