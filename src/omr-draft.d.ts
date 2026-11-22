export const OMR_LOW_CONFIDENCE: number;
export const OMR_TARGET_EDGE: number;
export const OMR_DIRECT_MAX_EDGE: number;
export const OMR_DIRECT_MAX_BYTES: number;

export type OmrQuestionResult = {
  number: number;
  answer: string | null;
  confidence: number;
};

export type OmrRecognizeResponse = {
  questions: OmrQuestionResult[];
  recognized: number;
  blank: number;
  averageConfidence: number;
  layout?: { engine?: string; style?: string };
  warnings?: string[];
  elapsedMs?: number;
  imageDigest?: string;
  cached?: boolean;
};

export type OmrSummary = {
  total: number;
  recognized: number;
  blank: number;
  lowConfidence: number[];
  lowConfidenceCount: number;
  existingAnswered: number;
  fillBlankAdded: number;
  replaceConflicts: number;
  warnings: string[];
  averageConfidence: number;
  elapsedMs: number;
  cached: boolean;
};

export type OmrApplyMode = "fill-blank" | "replace";

export function normalizeChoice(value: unknown): string;
export function summarizeOmrResult(
  result: OmrRecognizeResponse | null | undefined,
  options?: { questionCount: number; currentAnswers?: readonly string[] },
): OmrSummary;
export function applyOmrResult(options: {
  result: OmrRecognizeResponse | null | undefined;
  questionCount: number;
  currentAnswers?: readonly string[];
  currentMarks?: readonly number[];
  mode?: OmrApplyMode;
}): {
  answers: string[];
  marks: number[];
  appliedCount: number;
  lowConfidenceMarked: number[];
  firstFocusQuestion: number;
};
export function formatOmrApplyToast(options: {
  appliedCount: number;
  lowConfidenceMarked: readonly number[];
  mode?: OmrApplyMode;
}): string;
