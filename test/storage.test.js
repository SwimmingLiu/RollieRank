import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDraft, loadDrafts, restoreDraft, saveDrafts, STORAGE_KEY } from '../src/storage.js';

const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test('paper drafts remain independent and restore after reload', () => {
  const storage = memoryStorage();
  const { drafts } = loadDrafts(storage, ['paper-1', 'paper-2']);
  drafts['paper-1'].answers[0] = 'A';
  drafts['paper-1'].current = 2;
  drafts['paper-2'].answers[0] = 'D';
  saveDrafts(storage, 'paper-2', drafts);
  const loaded = loadDrafts(storage, ['paper-1', 'paper-2']);
  assert.equal(loaded.selectedId, 'paper-2');
  assert.equal(loaded.drafts['paper-1'].answers[0], 'A');
  assert.equal(loaded.drafts['paper-1'].current, 2);
  assert.equal(loaded.drafts['paper-2'].answers[0], 'D');
  assert.equal(loaded.warning, false);
});

test('corrupt or blocked storage is recoverable with a visible warning flag', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, '{bad json');
  const loaded = loadDrafts(storage, ['one']);
  assert.equal(loaded.warning, true);
  assert.deepEqual(loaded.drafts.one.answers, Array(130).fill(null));
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  assert.equal(loadDrafts(blocked, ['one']).warning, true);
  assert.throws(() => saveDrafts(blocked, 'one', {}), /quota/);
});

test('invalid saved values cannot create invalid answers or weights', () => {
  const draft = emptyDraft();
  draft.answers[0] = '<script>';
  draft.current = 131;
  draft.rules[7].cents = 1000;
  const restored = restoreDraft(draft);
  assert.equal(restored.answers[0], null);
  assert.equal(restored.current, 1);
  assert.equal(restored.rules[7].cents, 85);
});
