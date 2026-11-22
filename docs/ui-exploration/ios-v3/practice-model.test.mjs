import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attemptTarget, latestAttempt, saveAttempt, recentAttempts } from './practice-model.js';

const record = (id, complete, paper = 3) => ({ id, institution: '四海', period: 1, paper, complete, answers: Array(130).fill(complete ? 'A' : '') });
test('all paper entry points distinguish a full draft from a submitted attempt', () => {
  assert.equal(attemptTarget(undefined).label, '开始录入');
  const fullDraft = record('draft', false); fullDraft.answers.fill('A');
  assert.deepEqual(attemptTarget(fullDraft), { page: 'entry', label: '继续录入' });
  assert.deepEqual(attemptTarget(record('submitted', true)), { page: 'report', label: '看成绩' });
});
test('redo and draft autosave preserve every submitted snapshot', () => {
  const submitted = record('first', true), draft = record('second', false);
  let history = saveAttempt([submitted], draft);
  draft.answers[0] = 'B';
  assert.equal(history[0].answers[0], '');
  history = saveAttempt(history, draft);
  history = saveAttempt(history, { ...draft, complete: true });
  assert.equal(history.length, 2);
  assert.equal(history.find(r => r.id === 'first').answers[0], 'A');
  assert.equal(history[0].answers[0], 'B');
  assert.equal(saveAttempt(history, { ...draft, answers: Array(130).fill('C') }), history);
});
test('home shows three distinct recent papers while history retains repeated attempts', () => {
  const history = [record('redo', false), record('old', true), record('four', true, 4), record('five', true, 5), record('six', true, 6)];
  assert.equal(latestAttempt(history, history[1]).id, 'redo');
  assert.deepEqual(recentAttempts(history).map(r => r.id), ['redo', 'four', 'five']);
  assert.equal(history.length, 5);
});

// More than three and sparse period numbers must survive catalogue selection and historical validation.
import { periodsFor, papersFor, isAvailablePeriod, isPeriodNumber } from './catalog-data.js';
test('period choices are catalogue driven, including sparse future periods', () => {
 const custom = { 四海: { year: 2026, periods: [{ number: 2, papers: [1] }, { number: 12, papers: [1, 4] }, { number: 37, papers: [8] }] } };
 assert.deepEqual(periodsFor('四海', custom), [2, 12, 37]);
 assert.equal(isAvailablePeriod('四海', 37, custom), true);
 assert.equal(isAvailablePeriod('四海', 3, custom), false);
 assert.deepEqual(papersFor('四海', 12, custom), [1, 4]);
 assert.equal(isPeriodNumber(37), true);
 assert.equal(isPeriodNumber(1.5), false);
 // Real collections replace the old fabricated sequence, while sparse-key selection remains supported.
 assert.equal(isAvailablePeriod('四海', 12), false);
 assert.equal(papersFor('粉笔', 1).length, 6);
 assert.equal(papersFor('上岸村', 1).length, 10);
});
