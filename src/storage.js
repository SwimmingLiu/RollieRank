import { DEFAULT_RULES, OPTIONS, QUESTION_COUNT, validateRules } from './scoring.js';

export const STORAGE_KEY = 'rollierank:h5:v1';

export function emptyDraft() {
  // Question types are now verified from the booklets; no separate manual-confirmation state is needed.
  return { answers: Array(QUESTION_COUNT).fill(null), current: 1, autoNext: true, reportReady: false, rules: structuredClone(DEFAULT_RULES), updatedAt: null };
}

export function restoreDraft(raw) {
  const draft = emptyDraft();
  if (!raw || typeof raw !== 'object') return draft;
  if (Array.isArray(raw.answers) && raw.answers.length === QUESTION_COUNT) {
    draft.answers = raw.answers.map(answer => OPTIONS.includes(answer) ? answer : null);
  }
  if (Number.isInteger(raw.current) && raw.current >= 1 && raw.current <= QUESTION_COUNT) draft.current = raw.current;
  if (typeof raw.autoNext === 'boolean') draft.autoNext = raw.autoNext;
  if (typeof raw.reportReady === 'boolean') draft.reportReady = raw.reportReady;
  if (typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)) draft.updatedAt = raw.updatedAt;
  if (raw.rules) {
    try {
      validateRules(raw.rules);
      draft.rules = structuredClone(raw.rules);
    } catch { /* Invalid saved rules must not affect scores. */ }
  }
  return draft;
}

export function loadDrafts(storage, paperIds) {
  try {
    const text = storage.getItem(STORAGE_KEY);
    const raw = text ? JSON.parse(text) : {};
    if (!raw || typeof raw !== 'object' || raw.version !== undefined && raw.version !== 1) throw new Error('Invalid storage format');
    const drafts = Object.fromEntries(paperIds.map(id => [id, restoreDraft(raw.drafts?.[id])]));
    return { drafts, selectedId: paperIds.includes(raw.selectedId) ? raw.selectedId : paperIds[0], warning: false };
  } catch {
    return { drafts: Object.fromEntries(paperIds.map(id => [id, emptyDraft()])), selectedId: paperIds[0], warning: true };
  }
}

export function saveDrafts(storage, selectedId, drafts) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, selectedId, drafts }));
}
