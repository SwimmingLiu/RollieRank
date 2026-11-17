// All entry points resolve the same attempt, so a filled draft is never mistaken for a submitted result.
export const paperKey = record => [record.institution, record.period, record.paper].join('|');
export const latestAttempt = (records, paper) => records.find(record => paperKey(record) === paperKey(paper));
export function attemptTarget(record) {
  if (record?.complete) return { page: 'report', label: '看成绩' };
  return { page: 'entry', label: record?.answers.some(Boolean) ? '继续录入' : '开始录入' };
}

// Each submission owns a snapshot; a new attempt on the same paper must not replace the previous score.
export function saveAttempt(records, current) {
  const previous = records.find(record => record.id === current.id);
  if (previous?.complete) return records;
  const snapshot = { ...current, answers: [...current.answers] };
  return [snapshot, ...records.filter(record => record.id !== current.id)];
}
export function recentAttempts(records) {
  const seen = new Set();
  return records.filter(record => {
    const key = paperKey(record);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}
