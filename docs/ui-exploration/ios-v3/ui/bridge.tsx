import { useCallback, type ReactNode } from "react";
import { Button } from "./components/motion/button/base";
import { Tabs, TabsList, TabsTrigger } from "./components/motion/tabs";
import { Home, type HomeProps } from "./home";
import { Records, type RecordsProps } from "./records";
import { ScoreOverview, ShareResult, type ScoreOverviewProps, type ShareResultProps } from "./results";
import { Ranking, type RankingProps } from "./ranking";
import { Catalog, type CatalogProps } from "./catalog";
import { Podium, type PodiumProps } from "./podium";
import { cleanup, hasMountedAncestor, isMounted, mountRoot, type Cleanup } from "./root-registry";

export { cleanup };
export { publishers, publisherName, publisherIcon } from "./publishers";
export { mountSheet } from "./sheet-bridge";
export { createSharePoster } from "./results";
export { mountPracticeTools } from "./practice-tools";
export { mountPositionPicker, mountPositionSubmitPrompt, mountPositionDetail } from "./position-picker";
// 专项组件必须从公共 bundle 导出，实际手机入口才能使用同一套图表、交流和答题卡。
export { mountAnalyticsReport, mountAnalyticsStats } from "./analytics";
export { mountDiscussionReportEntry, mountDiscussionPage, mountDiscussionEditor } from "./discussions";
export { mountAnswerSheet } from "./answer-sheet";
export { mountInsightPanel, mountInsightEntry, mountInsightQuestionEntry, mountInsightQuestionStat } from "./insights";
export { mountPracticeTimer, mountEntryTools, mountTimingReport, mountTimerPaperPicker } from "./practice-session";
export { mountOmrScanner } from "./omr-scanner";
export type { OmrScannerProps } from "./omr-scanner";
export { mountSingleAnswer } from "./single-answer";
export { mountShareStudio } from "./share-studio";
export { createModeSharePoster, isShareMode } from "./results";
export type { ShareMode } from "./results";
export type { ShareStudioProps } from "./share-studio";
export type { AnswerSheetProps, AnswerSheetSection } from "./answer-sheet";
// 评论沿用既有 beUI Avatar，真实图片失败时仍显示本地头像回退。
export { mountDiscussionAvatar } from "./discussions-avatar";
export type { HomeProps, RecentPaper, Publisher } from "./home";
export type { PodiumPerson, PodiumProps } from "./podium";

export function mountHome(container: HTMLElement, props: HomeProps): Cleanup {
  return mountRoot(container, <Home {...props} />);
}

export function mountRecords(container: HTMLElement, props: RecordsProps): Cleanup {
  return mountRoot(container, <Records {...props} />);
}
export function mountCatalog(container: HTMLElement, props: CatalogProps): Cleanup {
  return mountRoot(container, <Catalog {...props} />);
}

export function mountScore(container: HTMLElement, props: ScoreOverviewProps): Cleanup {
  return mountRoot(container, <ScoreOverview {...props} />);
}

export function mountShare(container: HTMLElement, props: ShareResultProps): Cleanup {
  return mountRoot(container, <ShareResult {...props} />);
}

export function mountRank(container: HTMLElement, props: RankingProps): Cleanup {
  return mountRoot(container, <Ranking {...props} />);
}

type TabsProps = {
  value: string;
  items: {
    value: string;
    label: ReactNode;
    /** Authored static markup lets period numerals receive their own typography. */
    labelHtml?: string;
    disabled?: boolean;
  }[];
  onChange: (value: string) => void;
  variant?: "pill" | "segment" | "underline";
  className?: string;
  listClassName?: string;
  triggerClassName?: string;
  indicatorClassName?: string;
};

export function mountTabs(container: HTMLElement, props: TabsProps): Cleanup {
  return mountRoot(container, (
    <Tabs value={props.value} onValueChange={props.onChange} variant={props.variant ?? "segment"} className={`rr-tabs ${props.className ?? ""}`}>
      <TabsList className={`rr-tabs-list ${props.listClassName ?? ""}`}>
        {props.items.map((item) => (
          <TabsTrigger key={item.value} value={item.value} disabled={item.disabled} className={`rr-tab ${props.triggerClassName ?? ""}`} indicatorClassName={props.indicatorClassName}>
            {item.labelHtml !== undefined ? <span className="rr-tab-label" dangerouslySetInnerHTML={{ __html: item.labelHtml }} /> : item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  ));
}

type ButtonSnapshot = {
  className: string;
  html: string;
  disabled: boolean;
  type: "submit" | "reset" | "button";
  attributes: { name: string; value: string }[];
};
type ButtonBinding = { host: HTMLElement; original: HTMLButtonElement; button: HTMLButtonElement | null; snapshot: ButtonSnapshot };
const buttonBindings = new WeakMap<HTMLButtonElement, ButtonBinding>();

function EnhancedButton({ snapshot }: { snapshot: ButtonSnapshot }) {
  const { attributes } = snapshot;
  const classes = snapshot.className.split(/\s+/);
  const variant = classes.includes("primary") ? "primary" : classes.includes("secondary") || classes.includes("choice") ? "secondary" : "ghost";
  const applyAttributes = useCallback((button: HTMLButtonElement | null) => {
    if (!button) return;
    for (const { name, value } of attributes) {
      // Disabled belongs to the current React props; its initial attribute must not undo later updates.
      if (name !== "class" && name !== "disabled") button.setAttribute(name, value);
    }
  }, [attributes]);
  // 所有录答选项也复用同一个成熟Button；选中状态只由业务答案驱动。
  // Motion retains its mounted ref; React must own changing labels instead of waiting for another ref call.
  // Restrained press feedback keeps long footer actions from visibly collapsing in width.
  return (
    <Button ref={applyAttributes} className={snapshot.className} variant={variant} pressScale={0.98} disabled={snapshot.disabled} type={snapshot.type}>
      <span className="rr-button-label" style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: snapshot.html }} />
    </Button>
  );
}

function renderButton(binding: ButtonBinding) {
  mountRoot(binding.host, <EnhancedButton snapshot={binding.snapshot} />, () => {
    if (binding.button) buttonBindings.delete(binding.button);
    binding.host.replaceWith(binding.original);
  });
  if (binding.button) buttonBindings.delete(binding.button);
  binding.button = binding.host.querySelector("button");
  if (binding.button) buttonBindings.set(binding.button, binding);
}

export function updateButton(button: HTMLButtonElement, state: { labelHtml?: string; disabled?: boolean }): boolean {
  const binding = buttonBindings.get(button);
  if (!binding || !isMounted(binding.host)) return false;
  const snapshot = { ...binding.snapshot };
  if (state.labelHtml !== undefined) {
    snapshot.html = state.labelHtml;
    binding.original.innerHTML = state.labelHtml;
  }
  if (state.disabled !== undefined) {
    snapshot.disabled = state.disabled;
    binding.original.disabled = state.disabled;
  }
  binding.snapshot = snapshot;
  renderButton(binding);
  return true;
}

export function mountButtons(container: HTMLElement): Cleanup {
  // Navigation, paper rows and icon controls need the same real component feedback as primary actions.
  const buttons = container.querySelectorAll<HTMLButtonElement>("button");
  const hosts = [...container.querySelectorAll<HTMLElement>("[data-rollie-button-root]")];
  for (const original of buttons) {
    if (hasMountedAncestor(original, container)) continue;
    const host = document.createElement("span");
    host.className = "rr-button-root";
    host.dataset.rollieButtonRoot = "";
    host.style.display = "contents";
    const type = original.type === "submit" ? "submit" : original.type === "reset" ? "reset" : "button";
    const snapshot: ButtonSnapshot = {
      className: original.className,
      html: original.innerHTML,
      disabled: original.disabled,
      type,
      attributes: [...original.attributes].map(({ name, value }) => ({ name, value })),
    };
    original.replaceWith(host);
    renderButton({ host, original, snapshot, button: null });
    hosts.push(host);
  }
  return () => { for (const host of hosts) if (isMounted(host)) cleanup(host); };
}

export function mountPodium(container: HTMLElement, props: PodiumProps): Cleanup {
  return mountRoot(container, <Podium {...props} />);
}
