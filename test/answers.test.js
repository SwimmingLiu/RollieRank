import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAnswers } from '../src/answers.js';

test('continuous options accept lowercase, separators and a starting question', () => {
  assert.deepEqual(parseAnswers('a b,c；d\nA', 36), ['A', 'B', 'C', 'D', 'A'].map((answer, index) => ({ question: 36 + index, answer })));
});

test('blank placeholders preserve question alignment', () => {
  assert.deepEqual(parseAnswers('A-_?D'), ['A', null, null, null, 'D'].map((answer, index) => ({ question: index + 1, answer })));
});

test('numbered input can be out of order and use full-width punctuation', () => {
  assert.deepEqual(parseAnswers('第３题：ｃ\n1、a；2.B 130 D'), [{ question: 1, answer: 'A' }, { question: 2, answer: 'B' }, { question: 3, answer: 'C' }, { question: 130, answer: 'D' }]);
});

test('PDF-style grouped ranges and numbered answers can be mixed', () => {
  assert.deepEqual(parseAnswers('1--5 DDADD 6–10 CAA-B\n130.D'), ['D', 'D', 'A', 'D', 'D', 'C', 'A', 'A', null, 'B'].map((answer, index) => ({ question: index + 1, answer })).concat({ question: 130, answer: 'D' }));
});

test('invalid formats never partially import, truncate or silently remove input', () => {
  for (const input of ['', 'ABCDE', 'A选B', '1.A 1.B', '0.A', '131.B', '1-5 ABCD', '5-1 ABCDA', '1.A 2.E', '1.ABC', '<script>A</script>', '1-5 ABCDAX']) {
    assert.throws(() => parseAnswers(input), undefined, input);
  }
  assert.throws(() => parseAnswers('AB', 130), /131/);
  assert.throws(() => parseAnswers('A', 0), /起始/);
  assert.throws(() => parseAnswers('A', 1.5), /起始/);
});

test('a full 130-answer sequence maps exactly to 1–130', () => {
  const sequence = 'ABCD'.repeat(32) + 'AB';
  const result = parseAnswers(sequence);
  assert.equal(result.length, 130);
  assert.deepEqual(result[129], { question: 130, answer: 'B' });
});
