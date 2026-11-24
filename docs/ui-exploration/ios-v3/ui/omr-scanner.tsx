import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, Bookmark, Camera, Check, LoaderCircle, Maximize2, RotateCcw, Scan, Sun } from "lucide-react";
import { Button } from "./components/motion/button/base";
import { mountRoot, type Cleanup } from "./root-registry";
import {
  OMR_DIRECT_MAX_BYTES,
  OMR_DIRECT_MAX_EDGE,
  OMR_TARGET_EDGE,
  summarizeOmrResult,
  type OmrApplyMode,
  type OmrRecognizeResponse,
} from "../../../../src/omr-draft.js";

export type OmrScannerProps = {
  paperTitle?: string;
  questionCount: number;
  currentAnswers: readonly string[];
  onRecognize: (imageBase64: string, expectedQuestions: number) => Promise<OmrRecognizeResponse>;
  onApply: (payload: { result: OmrRecognizeResponse; mode: OmrApplyMode }) => void;
  onClose: () => void;
};

type ScanPhase = "idle" | "loading" | "ready" | "error";

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("照片读取失败，请重选"));
    };
    reader.onerror = () => reject(new Error("照片读取失败，请重选"));
    reader.readAsDataURL(file);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("无法读取该图片，请选 JPG 重试"));
    img.src = url;
  });
}

async function prepareOmrJpeg(file: File): Promise<{ dataUrl: string; previewUrl: string }> {
  const previewUrl = URL.createObjectURL(file);
  let image: HTMLImageElement;
  try {
    image = await loadImage(previewUrl);
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) {
    URL.revokeObjectURL(previewUrl);
    throw new Error("照片尺寸无效，请重拍");
  }

  const isJpeg = file.type === "image/jpeg" || file.type === "image/jpg" || /\.jpe?g$/i.test(file.name || "");
  const longEdge = Math.max(width, height);

  if (isJpeg && longEdge <= OMR_DIRECT_MAX_EDGE && file.size <= OMR_DIRECT_MAX_BYTES) {
    const dataUrl = await readAsDataUrl(file);
    return { dataUrl, previewUrl };
  }

  const scale = longEdge > OMR_TARGET_EDGE ? OMR_TARGET_EDGE / longEdge : 1;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(previewUrl);
    throw new Error("请直接选择 JPG 图片");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
  let dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  if (dataUrl.length * 0.75 > 11.5 * 1024 * 1024) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  }
  return { dataUrl, previewUrl };
}

function OmrGuideIllustration() {
  return (
    <svg className="rr-omr-guide-art" viewBox="0 0 180 112" fill="none" aria-hidden="true">
      <path d="M18 32V20a6 6 0 0 1 6-6h12M144 14h12a6 6 0 0 1 6 6v12M162 80v12a6 6 0 0 1-6 6h-12M36 98H24a6 6 0 0 1-6-6V80" stroke="#b98a3e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="34" y="21" width="112" height="70" rx="8" fill="#fffdf8" stroke="#dfd0b8" strokeWidth="1.5" />
      <rect x="44" y="30" width="40" height="4.5" rx="2.25" fill="#e6d7bd" />
      <rect x="118" y="30" width="18" height="4.5" rx="2.25" fill="#efe4d0" />
      <g fill="#e9decb">
        <rect x="44" y="42" width="8" height="4" rx="2" /><rect x="54" y="42" width="8" height="4" rx="2" fill="#302d26" /><rect x="64" y="42" width="8" height="4" rx="2" /><rect x="74" y="42" width="8" height="4" rx="2" />
        <rect x="44" y="52" width="8" height="4" rx="2" /><rect x="54" y="52" width="8" height="4" rx="2" /><rect x="64" y="52" width="8" height="4" rx="2" fill="#302d26" /><rect x="74" y="52" width="8" height="4" rx="2" />
        <rect x="44" y="62" width="8" height="4" rx="2" fill="#302d26" /><rect x="54" y="62" width="8" height="4" rx="2" /><rect x="64" y="62" width="8" height="4" rx="2" /><rect x="74" y="62" width="8" height="4" rx="2" />
        <rect x="44" y="72" width="8" height="4" rx="2" /><rect x="54" y="72" width="8" height="4" rx="2" /><rect x="64" y="72" width="8" height="4" rx="2" /><rect x="74" y="72" width="8" height="4" rx="2" fill="#302d26" />
        <rect x="98" y="42" width="8" height="4" rx="2" fill="#302d26" /><rect x="108" y="42" width="8" height="4" rx="2" /><rect x="118" y="42" width="8" height="4" rx="2" /><rect x="128" y="42" width="8" height="4" rx="2" />
        <rect x="98" y="52" width="8" height="4" rx="2" /><rect x="108" y="52" width="8" height="4" rx="2" /><rect x="118" y="52" width="8" height="4" rx="2" /><rect x="128" y="52" width="8" height="4" rx="2" fill="#302d26" />
        <rect x="98" y="62" width="8" height="4" rx="2" /><rect x="108" y="62" width="8" height="4" rx="2" fill="#302d26" /><rect x="118" y="62" width="8" height="4" rx="2" /><rect x="128" y="62" width="8" height="4" rx="2" />
        <rect x="98" y="72" width="8" height="4" rx="2" /><rect x="108" y="72" width="8" height="4" rx="2" /><rect x="118" y="72" width="8" height="4" rx="2" fill="#302d26" /><rect x="128" y="72" width="8" height="4" rx="2" />
      </g>
      <line x1="28" y1="56" x2="152" y2="56" stroke="#c5864b" strokeWidth="1.6" strokeDasharray="4 3" strokeLinecap="round" opacity=".72" />
    </svg>
  );
}

function OmrScanner({ questionCount, currentAnswers, onRecognize, onApply, onClose }: OmrScannerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const seqRef = useRef(0);
  const previewRef = useRef("");

  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<OmrRecognizeResponse | null>(null);
  const [mode, setMode] = useState<OmrApplyMode>("fill-blank");

  const replacePreview = (next: string) => {
    if (previewRef.current && previewRef.current !== next) {
      URL.revokeObjectURL(previewRef.current);
    }
    previewRef.current = next;
    setPreviewUrl(next);
  };

  useEffect(() => () => {
    seqRef.current += 1;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const summary = result ? summarizeOmrResult(result, { questionCount, currentAnswers }) : null;
  const hasExisting = currentAnswers.some((value) => value === "A" || value === "B" || value === "C" || value === "D");

  const triggerPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const seq = ++seqRef.current;
    setPhase("loading");
    setError("");
    setResult(null);
    try {
      const prepared = await prepareOmrJpeg(file);
      if (seq !== seqRef.current) {
        URL.revokeObjectURL(prepared.previewUrl);
        return;
      }
      replacePreview(prepared.previewUrl);
      const recognized = await onRecognize(prepared.dataUrl, questionCount);
      if (seq !== seqRef.current) return;
      const nextSummary = summarizeOmrResult(recognized, { questionCount, currentAnswers });
      if (nextSummary.recognized === 0) {
        setError(nextSummary.warnings[0] || "未识别到有效涂黑，请重拍");
        setPhase("error");
        return;
      }
      setResult(recognized);
      setMode(hasExisting ? "fill-blank" : "replace");
      setPhase("ready");
    } catch (caught) {
      if (seq !== seqRef.current) return;
      const message = caught instanceof Error && caught.message ? caught.message : "识别失败，请重拍";
      setError(message);
      setPhase("error");
    }
  };

  const handleCancel = () => {
    seqRef.current += 1;
    setPhase(result ? "ready" : "idle");
    if (!result) setError("");
  };

  const applyDisabled = !result || !summary || summary.recognized === 0 || (hasExisting && mode === "fill-blank" && summary.fillBlankAdded === 0);

  return (
    <div className="rr-omr-sheet" data-omr-phase={phase}>
      <input
        ref={inputRef}
        id={inputId}
        className="rr-omr-file-input"
        type="file"
        accept="image/*"
        aria-label="选择答题卡照片"
        onChange={handleFileChange}
      />

      {phase === "idle" ? (
        <button type="button" className="rr-omr-guide" onClick={triggerPicker} aria-label="拍照或选图">
          <OmrGuideIllustration />
          <div className="rr-omr-cues" aria-hidden="true">
            <span><Scan size={13} />四角入镜</span>
            <span><Maximize2 size={13} />纸面平整</span>
            <span><Sun size={13} />光线均匀</span>
          </div>
        </button>
      ) : null}

      {previewUrl ? (
        <div className={`rr-omr-preview${phase === "loading" ? " is-loading" : ""}`}>
          <img src={previewUrl} alt="已选答题卡照片" />
          {phase === "loading" ? (
            <div className="rr-omr-loading-overlay" role="status" aria-live="polite">
              <LoaderCircle size={20} className="rr-omr-spin" />
              <span>识别中…</span>
            </div>
          ) : null}
        </div>
      ) : phase === "loading" ? (
        <div className="rr-omr-loading-box" role="status" aria-live="polite">
          <LoaderCircle size={20} className="rr-omr-spin" />
          <span>处理中…</span>
        </div>
      ) : null}

      {phase === "error" ? (
        <div className="rr-omr-alert is-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      {phase === "ready" && summary ? (
        <div className="rr-omr-result">
          <div className="rr-omr-metrics" aria-label="识别统计">
            <div className="rr-omr-metric">
              <strong>{summary.recognized}</strong>
              <small>已识别</small>
            </div>
            <div className={`rr-omr-metric${summary.lowConfidenceCount ? " is-warn" : ""}`}>
              <strong>{summary.lowConfidenceCount}</strong>
              <small>存疑</small>
            </div>
            <div className="rr-omr-metric">
              <strong>{summary.blank}</strong>
              <small>留空</small>
            </div>
          </div>

          {summary.lowConfidenceCount > 0 ? (
            <div className="rr-omr-suspect">
              <Bookmark size={13} />
              <span>{summary.lowConfidence.slice(0, 6).join("、")}{summary.lowConfidenceCount > 6 ? ` 等 ${summary.lowConfidenceCount} 题` : " 题"}</span>
            </div>
          ) : null}

          {summary.warnings.length > 0 ? (
            <div className="rr-omr-alert" role="status">
              <AlertCircle size={15} />
              <span>{summary.warnings[0]}</span>
            </div>
          ) : null}

          {hasExisting && summary.recognized > 0 ? (
            <div className="rr-omr-merge" role="radiogroup" aria-label="导入方式">
              <button
                type="button"
                role="radio"
                aria-checked={mode === "fill-blank"}
                className={`rr-omr-merge-pill${mode === "fill-blank" ? " is-selected" : ""}`}
                onClick={() => setMode("fill-blank")}
              >
                <span>仅补空题</span>
                {summary.fillBlankAdded ? <small>+{summary.fillBlankAdded}</small> : null}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "replace"}
                className={`rr-omr-merge-pill${mode === "replace" ? " is-selected" : ""}`}
                onClick={() => setMode("replace")}
              >
                <span>整份替换</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rr-omr-actions">
        {phase === "idle" ? (
          <Button type="button" className="rr-omr-primary" onClick={triggerPicker}>
            <Camera size={16} />拍照 / 选图
          </Button>
        ) : phase === "loading" ? (
          <Button type="button" variant="secondary" onClick={handleCancel}>
            取消
          </Button>
        ) : phase === "error" ? (
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              手录
            </Button>
            <Button type="button" className="rr-omr-primary" onClick={triggerPicker}>
              <RotateCcw size={15} />重拍
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={triggerPicker}>
              <RotateCcw size={15} />重拍
            </Button>
            <Button
              type="button"
              className="rr-omr-primary"
              disabled={applyDisabled}
              onClick={() => { if (result) onApply({ result, mode: hasExisting ? mode : "replace" }); }}
            >
              <Check size={16} />填入
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function mountOmrScanner(container: HTMLElement, props: OmrScannerProps): Cleanup {
  return mountRoot(container, <OmrScanner {...props} />);
}
