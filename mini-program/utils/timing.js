// 做题计时：只有明确开始、暂停、结束的时间才提交给服务端。
// 服务端要求 schema 2 的完整结构，这里把本机的开始/结束时间整理成同一份记录。
const MINUTE = 60000;
const WHOLE = { id: "whole", name: "整卷" };

function buildTiming({ attemptId, versionId, startedAt, endedAt, plannedMinutes, sections, mode }) {
  if (!startedAt || !endedAt || endedAt < startedAt || endedAt - startedAt > 12 * 60 * MINUTE) return null;
  if (!attemptId || !versionId || !Number.isInteger(plannedMinutes) || plannedMinutes < 1 || plannedMinutes > 720) return null;
  const total = plannedMinutes * MINUTE;
  // 模块计划按题量分配整数分钟；整卷只有一个模块。
  const plannedWhole = [{ ...WHOLE, plannedMs: total, actualMs: 0 }];
  const plannedModules = mode === "modules" && Array.isArray(sections) && sections.length ? allocate(total, sections) : null;
  const elapsed = endedAt - startedAt;
  // 真实用时分摊到各模块，合计严格等于整段用时；两种口径都保留。
  const whole = distributeActual(plannedWhole, elapsed)[0];
  const modules = plannedModules ? distributeActual(plannedModules, elapsed) : null;
  const base = { schema: 2, origin: "custom", attemptId, versionId, startedAt, endedAt, plannedMs: total, actualMs: elapsed, entryMs: 0 };
  return {
    whole: { ...base, mode: "whole", modules: [whole] },
    modules: modules ? { ...base, mode: "modules", modules } : null,
  };
}

function allocate(totalMs, sections) {
  // 最大余数法：每段至少 1 分钟，合计精确等于计划总时长。
  const totalMinutes = totalMs / MINUTE;
  const weights = sections.map(section => (Number.isFinite(section.count) && section.count > 0 ? section.count : 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  const quotas = weights.map(weight => (totalMinutes * weight) / sum);
  const minutes = quotas.map(Math.floor);
  let remainder = totalMinutes - minutes.reduce((a, b) => a + b, 0);
  const order = quotas
    .map((quota, index) => ({ index, fraction: quota - minutes[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remainder; i++) minutes[order[i].index] += 1;
  return sections.map((section, index) => ({
    id: section.id || `section-${index + 1}`,
    name: section.name,
    plannedMs: Math.max(1, minutes[index]) * MINUTE,
    actualMs: 0,
  }));
}

// 主计时结束后，把实际用时按题型顺序分配到各模块（保留真实总时长）。
function distributeActual(modules, actualMs) {
  const planned = modules.reduce((sum, module) => sum + module.plannedMs, 0) || 1;
  let used = 0;
  return modules.map((module, index) => {
    const value = index === modules.length - 1
      ? actualMs - used
      : Math.round((actualMs * module.plannedMs) / planned);
    used += value;
    return { ...module, actualMs: value };
  });
}

module.exports = { buildTiming, distributeActual };
