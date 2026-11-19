import { useCallback, useRef } from "react";
import { X } from "lucide-react";
import { BottomSheet } from "./components/motion/bottom-sheet";
import { Button } from "./components/motion/button/base";
import { mountRoot, type Cleanup } from "./root-registry";

export type SheetProps = {
  open: boolean;
  title: string;
  layout?: "options";
  /** Only locally authored interface markup belongs here; this is not a remote HTML boundary. */
  html: string;
  onClose: () => void;
  onContentReady?: (content: HTMLElement) => void;
};

function BusinessSheet({ open, title, html, layout, onClose, onContentReady }: SheetProps) {
  // Native business controls stay in the authored content; the official sheet owns drag, focus and Escape.
  const contentRevision = useRef(0);
  const contentReady = useCallback((element: HTMLDivElement | null) => {
    const revision = ++contentRevision.current;
    if (!element) return;
    // Native enhancement mounts separate roots, so it must run after this React commit has finished.
    queueMicrotask(() => {
      if (element.isConnected && revision === contentRevision.current) onContentReady?.(element);
    });
  }, [html, onContentReady]);

  const options = layout === "options";
  return (
    <BottomSheet
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}
      snapPoints={options ? ["auto", 0.86] : ["auto"]}
      optionList={options}
      className={options ? "beui-island rr-sheet rr-options-sheet" : "beui-island rr-sheet"}
      labels={{ label: title, close: "关闭面板" }}
    >
      {!options && <div className="sheet-heading">
        <h2 id="sheet-title">{title}</h2>
        <Button id="sheet-close" variant="ghost" size="icon" className="icon-button" aria-label="关闭面板" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </Button>
      </div>}
      <div id="sheet-content" ref={contentReady} dangerouslySetInnerHTML={{ __html: html }} />
    </BottomSheet>
  );
}

/** Reuse one container and call with open:false to preserve the official exit transition and focus return. */
export function mountSheet(container: HTMLElement, props: SheetProps): Cleanup {
  return mountRoot(container, <BusinessSheet {...props} />);
}
