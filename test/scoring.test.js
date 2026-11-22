import test from 'node:test';
import assert from 'node:assert/strict';
import { PAPERS } from '../src/data/papers.js';
import { DEFAULT_RULES, exportCsv, formatScore, scorePaper, validateRules } from '../src/scoring.js';

const blank = () => Array(130).fill(null);

test('12 source-linked papers have complete answer keys and verified booklet boundaries', () => {
  assert.equal(PAPERS.length, 12);
  assert.equal(new Set(PAPERS.map(paper => paper.id)).size, 12);
  for (const [index, paper] of PAPERS.entries()) {
    assert.equal(paper.number, index + 1);
    assert.match(paper.answerKey, /^[ABCD]{130}$/);
    assert.match(paper.sourceSha256, /^[0-9a-f]{64}$/);
    assert.match(paper.bookletSha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(paper.reasoningBoundaries.map(rule => [rule.name, rule.start, rule.end]), [['图形推理', 76, 85], ['定义判断', 86, 95], ['类比推理', 96, 100], ['逻辑判断', 101, 110]]);
    assert.ok(paper.reasoningBoundaries.every(rule => Number.isInteger(rule.pdfPage) && rule.pdfPage > 0));
  }
  assert.equal(PAPERS[0].answerKey.slice(0, 10), 'DDADDCAADB');
  assert.equal(PAPERS[11].answerKey.slice(-10), 'CAADBBABDC');
});

for (const paper of PAPERS) {
  test(`${paper.title}: all correct is exactly 100 points, all wrong and blank are zero`, () => {
    const perfect = scorePaper(paper.answerKey, [...paper.answerKey]);
    assert.equal(perfect.totalCents, 10000);
    assert.equal(perfect.correct, 130);
    assert.equal(perfect.rows.length, 130);
    assert.deepEqual(perfect.breakdown.map(item => item.centsEarned), [1000, 750, 2400, 1000, 800, 800, 400, 850, 2000]);
    const wrong = [...paper.answerKey].map(answer => answer === 'A' ? 'B' : 'A');
    assert.equal(scorePaper(paper.answerKey, wrong).totalCents, 0);
    assert.equal(scorePaper(paper.answerKey, wrong).wrong, 130);
    assert.equal(scorePaper(paper.answerKey, blank()).blank, 130);
  });
}

test('question boundaries use the correct type and score', () => {
  const expected = new Map([[1, ['政治理论', 50]], [20, ['政治理论', 50]], [21, ['常识判断', 50]], [35, ['常识判断', 50]], [36, ['言语理解', 80]], [65, ['言语理解', 80]], [66, ['数量关系', 100]], [75, ['数量关系', 100]], [76, ['图形推理', 80]], [85, ['图形推理', 80]], [86, ['定义判断', 80]], [95, ['定义判断', 80]], [96, ['类比推理', 80]], [100, ['类比推理', 80]], [101, ['逻辑判断', 85]], [110, ['逻辑判断', 85]], [111, ['资料分析', 100]], [130, ['资料分析', 100]]]);
  const answers = blank();
  for (const q of expected.keys()) answers[q - 1] = PAPERS[0].answerKey[q - 1];
  const report = scorePaper(PAPERS[0].answerKey, answers);
  for (const [q, [type, cents]] of expected) assert.deepEqual([report.rows[q - 1].type, report.rows[q - 1].cents], [type, cents]);
  assert.equal(report.totalCents, [...expected.values()].reduce((sum, [, cents]) => sum + cents, 0));
  assert.equal(report.blank, 112);
});

test('a mixed submission preserves blank positions and includes every question', () => {
  const answers = blank();
  answers[0] = 'D';
  answers[1] = 'A';
  answers[100] = 'A';
  answers[129] = 'D';
  const report = scorePaper(PAPERS[0].answerKey, answers);
  assert.equal(report.totalCents, 235);
  assert.deepEqual([report.correct, report.wrong, report.blank], [3, 1, 126]);
  assert.equal(report.rows[2].question, 3);
  assert.equal(report.rows[2].status, 'blank');
  assert.equal(report.rows[129].cents, 100);
});

test('scores and CSV keep 0.85 point precision and all 130 results', () => {
  const answers = blank();
  answers[100] = PAPERS[0].answerKey[100];
  const report = scorePaper(PAPERS[0].answerKey, answers);
  assert.equal(formatScore(report.totalCents), '0.85');
  assert.equal(formatScore(750), '7.5');
  const csv = exportCsv(PAPERS[0], report);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  const rows = csv.slice(1).split('\r\n');
  assert.equal(rows.length, 131);
  assert.match(rows[101], /"101","逻辑判断","A","A","正确","0.85","0.85"/);
  assert.match(rows[130], /"130","资料分析","","D","未作答","1","0"/);
});

test('invalid answer keys, malformed answers and conflicting rules fail instead of mis-scoring', () => {
  assert.throws(() => scorePaper('ABCD', blank()), /完整/);
  assert.throws(() => scorePaper(PAPERS[0].answerKey, []), /130/);
  const invalid = blank(); invalid[0] = 'E';
  assert.throws(() => scorePaper(PAPERS[0].answerKey, invalid), /个人答案/);
  const overlapping = structuredClone(DEFAULT_RULES); overlapping[5].start = 85; overlapping[5].end = 94;
  assert.throws(() => validateRules(overlapping), /重叠/);
  const changedWeight = structuredClone(DEFAULT_RULES); changedWeight[7].cents = 80;
  assert.throws(() => validateRules(changedWeight), /分值/);
});
