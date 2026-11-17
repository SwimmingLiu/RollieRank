// 只清理明确由旧设计稿生成的记录，真实回执和用户修改过的未提交答案继续保留。
export function prunePreviewHistory(records, examples) {
  const seeds = new Map(examples.map((record, index) => [`legacy-${[record.institution, record.period, record.paper].join("|")}-${index}`, record]));
  const removed = [], retained = [];
  for (const record of records) {
    const seed = seeds.get(record.id);
    // An old identifier also belongs to authored offline practice; only the complete known seed is disposable.
    const untouched = seed && record.institution === seed.institution && record.period === seed.period && record.paper === seed.paper
      && record.complete === seed.complete && JSON.stringify(record.answers) === JSON.stringify(seed.answers);
    if (!record.serviceBacked && untouched) removed.push(record);
    else retained.push(record);
  }
  return { records: retained, removed };
}

// The earlier broad migration already archived some authored records; restore them without replacing newer edits.
export function recoverPreviewHistory(records, archive, examples) {
  const recovered = prunePreviewHistory(archive, examples).records;
  const ids = new Set(records.map(record => record.id));
  return [...records, ...recovered.filter(record => {
    if (ids.has(record.id)) return false;
    ids.add(record.id);
    return true;
  })];
}
