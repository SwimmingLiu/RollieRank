import { useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "./components/motion/tabs";
import { SHARE_MODES, ShareModeArtwork, isShareMode, type ShareMode, type ShareResultProps } from "./results";
import { mountRoot } from "./root-registry";

export type ShareStudioProps = ShareResultProps & {
  mode?: ShareMode;
  onModeChange?: (mode: ShareMode) => void;
};

// Fit the actual artifact to its container so every phone width shows the same complete export layout.
export function ShareStudio({ mode: controlledMode, onModeChange, ...props }: ShareStudioProps) {
  const [localMode, setLocalMode] = useState<ShareMode>("report");
  const mode = controlledMode ?? localMode;
  const [available, setAvailable] = useState(284);
  const [height, setHeight] = useState(720);
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const fit = Math.min(1, available / 450);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setAvailable(element.clientWidth));
    setAvailable(element.clientWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    // Rounded scrollHeight can lose a fraction of a pixel and create a scrollbar that changes the fit width.
    const observer = new ResizeObserver(entries => { for (const entry of entries) setHeight(Math.ceil(entry.contentRect.height)); });
    setHeight(Math.ceil(element.getBoundingClientRect().height / fit));
    observer.observe(element);
    return () => observer.disconnect();
  }, [mode]);

  const changeMode = (value: string) => {
    if (!isShareMode(value)) return;
    setLocalMode(value);
    onModeChange?.(value);
    viewport.current?.scrollTo({ top: 0, left: 0 });
  };
  return <div className="rr-share-studio" data-share-mode={mode} data-ready="true">
    <Tabs value={mode} onValueChange={changeMode} variant="segment" className="rr-share-mode-tabs"><TabsList aria-label="分享样式">{SHARE_MODES.map(item => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}</TabsList></Tabs>
    <div ref={viewport} className="rr-share-preview" role="region" aria-label="分享预览" tabIndex={0}>
      <div className="rr-share-preview-stage" style={{ width: 450 * fit, height: Math.ceil(height * fit) }}><div ref={canvas} className="rr-share-preview-canvas" style={{ transform: `scale(${fit})` }}><ShareModeArtwork {...props} mode={mode} /></div></div>
    </div>
  </div>;
}

export function mountShareStudio(container: HTMLElement, props: ShareStudioProps) { return mountRoot(container, <ShareStudio {...props} />); }
