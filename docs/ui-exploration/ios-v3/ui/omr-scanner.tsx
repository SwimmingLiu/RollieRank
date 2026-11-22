import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, Camera, Check, LoaderCircle, RotateCcw } from "lucide-react";
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
  paperTitle: string;
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
      else reject(new Error("照片读取失败，请重新选择。"));
    };
    reader.onerror = () => reject(new Error("照片读取失败，请重新选择。"));
    reader.readAsDataURL(file);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("无法读取这张照片，请选择清晰的 JPG 图片重试。"));
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
    throw new Error("照片尺寸无效，请重新拍摄。");
  }

  const isJpeg = file.type === "image/jpeg" || file.type === "image/jpg" || /\.jpe?g$/i.test(file.name || "");
  const longEdge = Math.max(width, height);

  // 合规尺寸的 JPEG 直接传原字节，保留原始锐度；非 JPEG 或超大原图在端侧转码缩放。
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
    throw new Error("当前浏览器无法处理照片，请直接选择 JPG 图片。");
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

function OmrScanner({ paperTitle, questionCount, currentAnswers, onRecognize, onApply, onClose }: OmrScannerProps) {
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
      setResult(recognized);
      setMode(hasExisting ? "fill-blank" : "replace");
      setPhase("ready");
    } catch (caught) {
      if (seq !== seqRef.current) return;
      const message = caught instanceof Error && caught.message ? caught.message : "识别失败，请重拍或手动录入。";
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
      <p className="rr-omr-context" title={paperTitle}>
        <span>{paperTitle}</span>
        <small>{questionCount} 题</small>
      </p>

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
        <div className="rr-omr-empty">
          <div className="rr-omr-empty-icon" aria-hidden="true">
            <Camera size={24} />
          </div>
          <p className="rr-omr-tip">正对答题卡拍摄，四角完整入镜、光线均匀</p>
          <p className="rr-omr-subtip">识别后填入当前草稿，存疑题可核对后再交卷</p>
        </div>
      ) : null}

      {previewUrl ? (
        <div className={`rr-omr-preview${phase === "loading" ? " is-loading" : ""}`}>
          <img src={previewUrl} alt="已选答题卡照片" />
          {phase === "loading" ? (
            <div className="rr-omr-loading-overlay" role="status" aria-live="polite">
              <LoaderCircle size={20} className="rr-omr-spin" />
              <span>正在识别答题卡…</span>
            </div>
          ) : null}
        </div>
      ) : phase === "loading" ? (
        <div className="rr-omr-loading-box" role="status" aria-live="polite">
          <LoaderCircle size={20} className="rr-omr-spin" />
          <span>正在准备照片…</span>
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
              <small>待核对</small>
            </div>
            <div className="rr-omr-metric">
              <strong>{summary.blank}</strong>
              <small>未填涂</small>
            </div>
          </div>

          {summary.recognized === 0 ? (
            <div className="rr-omr-alert is-error" role="alert">
              <AlertCircle size={16} />
              <span>未识别到有效涂黑，请重拍或继续手动录入。</span>
            </div>
          ) : summary.lowConfidenceCount > 0 ? (
            <p className="rr-omr-note">
              第 {summary.lowConfidence.slice(0, 6).join("、")}{summary.lowConfidenceCount > 6 ? ` 等 ${summary.lowConfidenceCount} 题` : " 题"}涂痕较浅，填入后将自动标为存疑。
            </p>
          ) : null}

          {summary.warnings.length > 0 ? (
            <div className="rr-omr-alert" role="status">
              <AlertCircle size={16} />
              <span>{summary.warnings[0]}</span>
            </div>
          ) : null}

          {hasExisting && summary.recognized > 0 ? (
            <div className="rr-omr-merge" role="radiogroup" aria-label="导入方式">
              <button
                type="button"
                role="radio"
                aria-checked={mode === "fill-blank"}
                className={`rr-omr-merge-option${mode === "fill-blank" ? " is-selected" : ""}`}
                onClick={() => setMode("fill-blank")}
              >
                <span>
                  <b>仅补空题</b>
                  <small>保留已填 {summary.existingAnswered} 题，补录 {summary.fillBlankAdded} 题</small>
                </span>
                {mode === "fill-blank" ? <Check size={15} /> : null}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "replace"}
                className={`rr-omr-merge-option${mode === "replace" ? " is-selected" : ""}`}
                onClick={() => setMode("replace")}
              >
                <span>
                  <b>整份替换</b>
                  <small>用本次识别覆盖当前草稿{summary.replaceConflicts ? `（改写 ${summary.replaceConflicts} 题）` : ""}</small>
                </span>
                {mode === "replace" ? <Check size={15} /> : null}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rr-omr-actions">
        {phase === "idle" ? (
          <Button type="button" className="rr-omr-primary" onClick={triggerPicker}>
            <Camera size={16} />拍照或选图
          </Button>
        ) : phase === "loading" ? (
          <Button type="button" variant="secondary" onClick={handleCancel}>
            取消识别
          </Button>
        ) : phase === "error" ? (
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              继续手录
            </Button>
            <Button type="button" className="rr-omr-primary" onClick={triggerPicker}>
              <RotateCcw size={15} />重新选图
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
              <Check size={16} />填入答题卡
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
