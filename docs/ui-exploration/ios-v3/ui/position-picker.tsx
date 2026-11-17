import { Check, ChevronLeft, ChevronRight, Info, LoaderCircle, Search, X } from "lucide-react";
import { Button } from "./components/motion/button/base";
import { TextInput } from "./primitives";
import { mountRoot } from "./root-registry";

export type PositionLevel = "source" | "category" | "department" | "unit" | "position";
export type PositionCrumb = { level: Exclude<PositionLevel, "position">; id: string; label: string };
export type PositionChoice = { id: string; label: string } & (
  | { kind: "branch" }
  | { kind: "position"; positionId: string; code: string }
);
export type PositionPickerLoad = { kind: "ready" } | { kind: "loading" } | { kind: "saving"; id: string } | { kind: "error"; message: string };
export type PositionPickerProps = {
  level: PositionLevel;
  exam: "guokao" | "shengkao";
  context: string;
  canSwitchSource: boolean;
  breadcrumbs: PositionCrumb[];
  choices: PositionChoice[];
  selectedId: string | null;
  query: string;
  searchable: boolean;
  hasMore: boolean;
  load: PositionPickerLoad;
  onQuery: (query: string) => void;
  onSearch: () => void;
  onPick: (id: string) => void;
  onInfo: (id: string) => void;
  onBack: (level: Exclude<PositionLevel, "position">) => void;
  onMore: () => void;
  onRetry: () => void;
  onExam: (exam: "guokao" | "shengkao") => void;
};
const labels: Record<PositionLevel, string> = { source: "选择招考", category: "选择招录类别", department: "选择招录部门", unit: "选择用人单位", position: "选择具体岗位" };
const searchLabels: Record<PositionLevel, string> = { source: "搜索招考", category: "搜索类别", department: "搜索部门", unit: "搜索单位", position: "搜索岗位或编码" };

export function PositionPicker(props: PositionPickerProps) {
  const busy = props.load.kind === "loading" || props.load.kind === "saving";
  return <section className="rr-position-picker" data-slot="position-picker">
    {/* 考试入口始终可见于首层，省考目录尚未导入时也能明确发现其位置。 */}
    {props.level === "source" ? <div className="rr-position-exams" role="group" aria-label="报考考试">{[{ id: "guokao", label: "国考" }, { id: "shengkao", label: "省考" }].map(item => <Button key={item.id} variant="ghost" aria-pressed={props.exam === item.id} disabled={busy} onClick={() => props.onExam(item.id === "guokao" ? "guokao" : "shengkao")}>{item.label}</Button>)}</div> : null}
    {props.context ? <div className="rr-position-context">{props.canSwitchSource ? <Button variant="ghost" className="rr-position-source" onClick={() => props.onBack("source")} disabled={busy}>{props.context}<ChevronRight size={13} /></Button> : <span>{props.context}</span>}</div> : null}
    <ol className="rr-position-path" aria-label="已选报考条件">
      {props.breadcrumbs.map(crumb => <li key={crumb.level}><span className="rr-position-path-dot" /><Button variant="ghost" className="rr-position-path-item" disabled={busy} onClick={() => props.onBack(crumb.level)}><span>{crumb.label}</span><ChevronRight size={15} /></Button></li>)}
      <li className="current"><span className="rr-position-path-dot" /><strong>{labels[props.level]}</strong></li>
    </ol>
    {props.searchable ? <TextInput type="search" value={props.query} onChange={props.onQuery} placeholder={searchLabels[props.level]} aria-label={searchLabels[props.level]} leftIcon={<Search size={16} />} rightIcon={props.query ? <Button variant="ghost" size="icon" aria-label="清空搜索" onClick={() => props.onQuery("")}><X size={15} /></Button> : undefined} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); props.onSearch(); } }} classNames={{ root: "rr-position-search", field: "rr-position-search-field", input: "rr-position-search-input", rightIcon: "rr-position-search-clear" }} /> : null}
    <div className="rr-position-options" aria-busy={busy} role="group" aria-label={labels[props.level]}>
      {props.choices.map(choice => {
        const selected = choice.kind === "position" && choice.positionId === props.selectedId;
        return <div key={choice.id} className={`rr-position-option-wrap ${choice.kind === "position" ? "leaf" : ""}`}><Button variant="ghost" className={`rr-position-option ${selected ? "selected" : ""}`} disabled={props.load.kind !== "ready"} aria-pressed={choice.kind === "position" ? selected : undefined} data-position-choice={choice.id} data-position-leaf={choice.kind === "position" ? choice.positionId : undefined} onClick={() => props.onPick(choice.id)}>
          <span><span className="rr-position-option-title">{choice.label}</span>{choice.kind === "position" ? <small className="num">{choice.code}</small> : null}</span>
          {props.load.kind === "saving" && props.load.id === choice.id ? <LoaderCircle size={16} className="rr-position-spinner" /> : selected ? <Check size={17} /> : choice.kind === "branch" ? <ChevronRight size={16} /> : null}
        </Button>{choice.kind === "position" ? <Button variant="ghost" size="icon" className="rr-position-info" aria-label={`查看${choice.label}的岗位要求`} onClick={() => props.onInfo(choice.id)} disabled={busy}><Info size={16} /></Button> : null}</div>;
      })}
      {props.load.kind === "loading" ? <div className="rr-position-state" role="status"><LoaderCircle size={18} className="rr-position-spinner" /><span>正在读取</span></div> : null}
      {props.load.kind === "error" ? <div className="rr-position-state" role="alert"><p>{props.load.message}</p><Button variant="ghost" onClick={props.onRetry}>重新读取</Button></div> : !busy && !props.choices.length ? <p className="rr-position-state">{props.level === "source" ? `暂无${props.exam === "shengkao" ? "省考" : "国考"}岗位表` : "没有匹配结果"}</p> : null}
      {props.hasMore && props.load.kind === "ready" ? <Button variant="ghost" className="rr-position-more" onClick={props.onMore}>显示更多</Button> : null}
    </div>
  </section>;
}

export function PositionSubmitPrompt() {
  return <div className="rr-position-prompt" data-slot="position-submit-prompt">
    <div className="rr-position-prompt-actions"><Button className="primary" data-position-action="choose">去选岗</Button><Button variant="ghost" className="secondary" data-position-action="skip-submit">先提交</Button></div>
  </div>;
}

export type PositionDetailProps = {
  title: string;
  code: string;
  fields: { label: string; value: string }[];
  source: { label: string; url: string } | null;
  selected: boolean;
  saving: boolean;
  onBack: () => void;
  onSelect: () => void;
};
export function PositionDetail(props: PositionDetailProps) {
  return <section className="rr-position-detail" data-slot="position-detail">
    <Button variant="ghost" className="rr-position-detail-back" onClick={props.onBack} disabled={props.saving}><ChevronLeft size={15} />岗位列表</Button>
    <h3>{props.title}</h3><p className="rr-position-detail-code num">{props.code}</p>
    <div className="rr-position-detail-fields"><dl>{props.fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>{props.source ? <a href={props.source.url} target="_blank" rel="noopener noreferrer">{props.source.label}<ChevronRight size={14} /></a> : null}</div>
    <Button className="primary rr-position-detail-select" onClick={props.onSelect} disabled={props.saving}>{props.saving ? "正在保存" : props.selected ? "使用当前岗位" : "选择此岗"}</Button>
  </section>;
}
export const mountPositionPicker = (container: HTMLElement, props: PositionPickerProps) => mountRoot(container, <PositionPicker {...props} />);
export const mountPositionSubmitPrompt = (container: HTMLElement) => mountRoot(container, <PositionSubmitPrompt />);
export const mountPositionDetail = (container: HTMLElement, props: PositionDetailProps) => mountRoot(container, <PositionDetail {...props} />);
