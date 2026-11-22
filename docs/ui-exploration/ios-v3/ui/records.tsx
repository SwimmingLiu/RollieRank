import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, ChevronRight, ListChecks, Search, X } from "lucide-react";
import { Button } from "./components/motion/button/base";
import { Card, CardContent } from "./components/motion/card";
import { Tabs, TabsList, TabsTrigger } from "./components/motion/tabs";
import { Avatar, NumberTicker, ProgressBar, ScrollArea, TextInput } from "./primitives";
import type { RecentPaper } from "./home";
import { publisherName, publisherIcon } from "./publishers";

// 记录页只呈现草稿或真实成绩，预置设计记录由宿主迁出，避免技术身份占据卡片。
export type PracticeRecord = RecentPaper & { id: string; year: number; updatedAt?: number; attemptNumber?: number };
export type RecordsViewState = {
  query: string;
  filter: "all" | "complete" | "draft";
  scrollTop: number;
};
export type RecordsProps = {
  records: PracticeRecord[];
  onOpen: (id: string) => void;
  user?: { name: string; avatarSrc: string };
  onEditProfile?: () => void;
  viewState?: RecordsViewState;
  onViewStateChange?: (state: RecordsViewState) => void;
};

type HistoryFilter = RecordsViewState["filter"];
const FILTERS = [
  { value: "all", label: "全部" },
  { value: "complete", label: "已完成" },
  { value: "draft", label: "录入中" },
] satisfies { value: HistoryFilter; label: string }[];
const twoDigits = (value: number | string) => String(value).padStart(2, "0");
const compact = (value: string) => value.toLocaleLowerCase("zh-CN").replace(/\s+/g, "");

// Named collections and variants remain searchable without forcing a fictional period label.
function searchText(record: PracticeRecord) {
  const institutionName = publisherName(record.institution);
  return compact([
    institutionName,
    record.editionLabel ?? "",
    record.paperTitle ?? "",
    record.variantLabel ?? "",
    `${record.institution}${record.year}年第${record.period}期行测第${record.paper}套`,
    // Match the compact paper identity people type without requiring spaces or the word “行测”.
    `${record.institution}${record.period}期${record.paper}套`,
    `${institutionName}${record.period}期${record.paper}套`,
    `${twoDigits(record.period)}期${twoDigits(record.paper)}套`,
    record.complete ? "已完成" : "录入中",
  ].join(" "));
}

// History uses the same paper cards as the library: score/progress first, paper identity second.
function RecordLine({ record, onOpen }: { record: PracticeRecord; onOpen: RecordsProps["onOpen"] }) {
  return <Card className={`rr2-record-card rr6-record-card ${record.complete ? "complete" : "draft"}`} size="compact" interactive>
    <CardContent className="rr6-record-body">
      <div className="rr6-record-brand"><img src={publisherIcon(record.institution)} alt="" /><strong>{publisherName(record.institution)}</strong>{record.complete ? <Check size={14} /> : <ListChecks size={14} />}</div>
      <span className="rr6-record-scope">{record.year} · {record.editionLabel ?? `${twoDigits(record.period)}期`}{record.variantLabel ? ` · ${record.variantLabel}` : ""}</span>
      <span className="rr6-record-paper">{record.paperTitle ?? `${twoDigits(record.paper)}套`}{record.attemptNumber !== undefined ? <small> · 第{record.attemptNumber}次</small> : null}</span>
      <div className="rr6-record-value">{record.complete ? <strong>{typeof record.score === "number" ? record.score.toFixed(2) : record.score}<small>分</small></strong> : <strong className="num">{record.answered}<small> / {record.totalQuestions ?? 130} 题</small></strong>}<ChevronRight size={17} aria-hidden="true" /></div>
      {!record.complete ? <ProgressBar value={record.answered} max={record.totalQuestions ?? 130} label="录入进度" valueText={`已录${record.answered}题，共${record.totalQuestions ?? 130}题`} animated={false} /> : null}
    </CardContent>
    <Button variant="ghost" pressScale={1} className="rr-card-hit" aria-label={`${publisherName(record.institution)}${record.year}年，${record.editionLabel ?? `第${record.period}期`}${record.variantLabel ?? ""}，${record.paperTitle ?? `行测第${record.paper}套`}，${record.complete ? "查看成绩" : "继续录入"}`} onClick={() => onOpen(record.id)} />
  </Card>;
}

// 完整历史由宿主提供，独立于首页的三条近期练习；筛选始终以记录 id 打开原卷。
export function Records({ records, onOpen, viewState, onViewStateChange, onEditProfile, user = { name: "卷友", avatarSrc: "assets/avatars/rank-8.svg" } }: RecordsProps) {
  // 返回一张已浏览的历史列表时，恢复它的查询对象与位置；viewState只负责首次挂载种子。
  const initialView = useRef<RecordsViewState>(viewState ?? { query: "", filter: "all", scrollTop: 0 });
  const [query, setQuery] = useState(initialView.current.query);
  // 搜索按需展开，与筛选共用工具栏，把首屏空间留给练习记录。
  const [searchOpen, setSearchOpen] = useState(Boolean(initialView.current.query));
  const [filter, setFilter] = useState<HistoryFilter>(initialView.current.filter);
  const viewport = useRef<HTMLDivElement>(null);
  const queryField = useRef<HTMLInputElement>(null);
  const stateCallback = useRef(onViewStateChange);
  const appliedConditions = useRef<Pick<RecordsViewState, "query" | "filter"> | null>(null);
  useLayoutEffect(() => { stateCallback.current = onViewStateChange; }, [onViewStateChange]);
  const tokens = useMemo(() => query.trim().split(/[\s,，、]+/).filter(Boolean).map(compact), [query]);
  const visible = useMemo(() => records.filter((record) => {
    if (filter === "complete" && !record.complete) return false;
    if (filter === "draft" && record.complete) return false;
    const text = searchText(record);
    return tokens.every((token) => text.includes(token));
  }), [records, filter, tokens]);

  // 首次恢复与用户更改条件必须分开，否则挂载时的归零会吞掉宿主保存的滚动位置。
  useLayoutEffect(() => {
    const previous = appliedConditions.current;
    if (previous?.query === query && previous.filter === filter) return;
    appliedConditions.current = { query, filter };
    viewport.current?.scrollTo({ top: previous ? 0 : initialView.current.scrollTop, behavior: "auto" });
    stateCallback.current?.({ query, filter, scrollTop: viewport.current?.scrollTop ?? 0 });
  }, [filter, query]);
  const openRecord = (id: string) => {
    // 点击和滚动事件可能同帧到达，打开前再读一次实际位置，不能只依赖上一帧onScroll。
    stateCallback.current?.({ query, filter, scrollTop: viewport.current?.scrollTop ?? 0 });
    onOpen(id);
  };

  return (
    <div className="rr2-profile rr6-profile" data-slot="practice-history">
      <Card className="rr2-profile-identity" size="compact">
        <CardContent className="rr2-profile-person">
          <Avatar name={user.name} src={user.avatarSrc} size="lg" className="rr2-profile-avatar" />
          <div className="rr2-profile-person-copy">
            <h2>{user.name}</h2>
            <p><NumberTicker value={records.length} animated={false} /><span>份练习</span></p>
          </div>
          <img className="rr6-profile-art" src="assets/illustrations/answer-paper.svg" alt="" aria-hidden="true" />
          {onEditProfile ? <Button variant="ghost" className="rr-card-hit" onClick={onEditProfile} aria-label="编辑个人资料" /> : null}
        </CardContent>
      </Card>
      {/* 学习工具沿用卷卡双列布局，由同一原生组件呈现岗位和分析入口。 */}
      <div id="practice-tools-ui" />
      <div className={`rr2-profile-controls rr-record-controls ${searchOpen ? "searching" : ""}`}>
        {searchOpen ? <TextInput
          ref={queryField}
          type="search"
          value={query}
          onChange={setQuery}
          placeholder="机构、套卷或卷号"
          aria-label="查询练习记录"
          enterKeyHint="search"
          leftIcon={<Search size={17} />}
          rightIcon={query ? <Button variant="ghost" size="icon" aria-label="清空关键词" onClick={() => { setQuery(""); queryField.current?.focus({ preventScroll: true }); }}><X size={16} /></Button> : undefined}
          classNames={{ root: "rr2-profile-search", field: "rr2-profile-search-field", input: "rr2-profile-search-input", leftIcon: "rr2-profile-search-icon", rightIcon: "rr2-profile-search-clear" }}
        /> : null}
        <div className="rr-record-toolbar"><Tabs value={filter} onValueChange={(value) => { if (value === "all" || value === "complete" || value === "draft") setFilter(value); }} variant="segment" className="rr2-profile-tabs">
          <TabsList className="rr2-profile-tab-list">
            {FILTERS.map((item) => <TabsTrigger value={item.value} key={item.value} className="rr2-profile-tab" indicatorClassName="rr2-profile-tab-indicator">{item.label}</TabsTrigger>)}
          </TabsList>
        </Tabs><Button variant="ghost" size="icon" className="rr-record-search-toggle" aria-label={searchOpen ? "收起搜索" : "搜索练习记录"} aria-expanded={searchOpen} onClick={() => {
          if (searchOpen) { setSearchOpen(false); setQuery(""); }
          else { setSearchOpen(true); requestAnimationFrame(() => queryField.current?.focus({ preventScroll: true })); }
        }}>{searchOpen ? <X size={17} /> : <Search size={17} />}</Button></div>
      </div>
      {/* Filters lead directly into their records, without a separate count strip or empty spacer. */}
      <ScrollArea.Root className="rr2-profile-scroll">
        <ScrollArea.Viewport
          ref={viewport}
          className="rr2-profile-viewport"
          tabIndex={0}
          role="region"
          aria-label="练习历史记录，可上下滚动"
          onScroll={(event) => stateCallback.current?.({ query, filter, scrollTop: event.currentTarget.scrollTop })}
        >
          <ScrollArea.Content className="rr2-record-list rr6-record-grid">
            {/* A new result set must not carry each Badge's old page projection into a different row. */}
            {visible.length ? visible.map((record) => <RecordLine key={`${record.id}:${filter}:${query}`} record={record} onOpen={openRecord} />) : (
              <Card className="rr2-profile-empty" size="compact">
                <CardContent className="rr2-profile-empty-content">
                  {/* Search controls already clear filters; empty results keep just their identity and title. */}
                  <BookOpen size={25} />
                  <h3>{records.length ? "没有符合条件的记录" : "还没有练习记录"}</h3>
                </CardContent>
              </Card>
            )}
          </ScrollArea.Content>
        </ScrollArea.Viewport>
      </ScrollArea.Root>
    </div>
  );
}
