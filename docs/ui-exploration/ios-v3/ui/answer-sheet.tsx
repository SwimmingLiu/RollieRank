import { useCallback, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "./components/motion/button/base";
import { mountRoot, type Cleanup } from "./root-registry";

export type AnswerSheetSection = { name: string; start: number; end: number };
export type AnswerSheetProps = {
  sections: readonly AnswerSheetSection[];
  answers: readonly string[];
  current: number;
  marks?: readonly number[];
  onJump: (question: number) => void;
};

const isAnswer = (value: string | undefined) => value === "A" || value === "B" || value === "C" || value === "D";

// 标记是答卷的一部分，使用可选标记保持既有调用和题号键盘行为兼容。
function AnswerSheet({ sections, answers, current, marks = [], onJump }: AnswerSheetProps) {
  const titlePrefix = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const cells = useRef(new Map<number, HTMLButtonElement>());
  const numbers = sections.flatMap((section) => Array.from({ length: section.end - section.start + 1 }, (_, index) => section.start + index));
  const initial = numbers.includes(current) ? current : numbers[0];
  const [active, setActive] = useState(initial);
  const answered = numbers.filter((number) => isAnswer(answers[number - 1])).length;

  const reveal = useCallback((number: number) => {
    const list = listRef.current;
    const cell = cells.current.get(number);
    if (!list || !cell || !list.clientHeight) return;
    const bounds = list.getBoundingClientRect();
    const item = cell.getBoundingClientRect();
    const heading = cell.closest("section")?.querySelector(".ios-answer-sheet-group-title");
    const top = bounds.top + (heading?.getBoundingClientRect().height ?? 0) + 8;
    const bottom = bounds.bottom - 8;
    // scrollIntoView can also move the sheet or the iframe; only this list owns positioning.
    if (item.top < top) list.scrollTop += item.top - top;
    else if (item.bottom > bottom) list.scrollTop += item.bottom - bottom;
  }, []);

  useLayoutEffect(() => {
    setActive(initial);
    if (initial === undefined) return;
    reveal(initial);
    const list = listRef.current;
    if (!list) return;
    // Grid reflow and a sheet becoming visible can change row positions without changing current.
    let width = list.clientWidth;
    let height = list.clientHeight;
    const observer = new ResizeObserver(() => {
      if (width === list.clientWidth && height === list.clientHeight) return;
      width = list.clientWidth;
      height = list.clientHeight;
      reveal(initial);
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [initial, reveal, sections]);

  function focusQuestion(number: number | undefined) {
    if (number === undefined) return;
    const cell = cells.current.get(number);
    if (!cell) return;
    setActive(number);
    cell.focus({ preventScroll: true });
    reveal(number);
  }

  function keyDown(event: KeyboardEvent<HTMLButtonElement>, number: number, sectionIndex: number) {
    const index = numbers.indexOf(number);
    const section = sections[sectionIndex];
    if (!section) return;
    const columns = getComputedStyle(event.currentTarget).getPropertyValue("--ios-answer-sheet-columns").trim() === "4" ? 4 : 5;
    const column = (number - section.start) % columns;
    let target: number | undefined;
    if (event.key === "ArrowRight") target = numbers[index + 1];
    else if (event.key === "ArrowLeft") target = numbers[index - 1];
    else if (event.key === "Home") target = numbers[0];
    else if (event.key === "End") target = numbers.at(-1);
    else if (event.key === "ArrowDown") {
      const next = sections[sectionIndex + 1];
      target = number + columns <= section.end ? number + columns : next ? Math.min(next.start + column, next.end) : section.end;
    } else if (event.key === "ArrowUp") {
      const previous = sections[sectionIndex - 1];
      target = number - columns >= section.start ? number - columns : previous
        ? Math.min(previous.start + Math.floor((previous.end - previous.start) / columns) * columns + column, previous.end)
        : section.start;
    } else return;
    event.preventDefault();
    focusQuestion(target);
  }

  return <div className="ios-answer-sheet">
    <p className="ios-answer-sheet-summary" aria-live="polite">已答 <strong>{answered}</strong><span> / {numbers.length}</span></p>
    <div ref={listRef} className="ios-answer-sheet-list" role="region" aria-label="按题型选择题号">
      {sections.map((section, sectionIndex) => {
        const titleId = `${titlePrefix}-${section.start}`;
        return <section className="ios-answer-sheet-group" key={`${section.start}-${section.end}`} aria-labelledby={titleId}>
          <h3 id={titleId} className="ios-answer-sheet-group-title"><span>{section.name}</span><small>{section.start}–{section.end} 题</small></h3>
          <div className="ios-answer-sheet-grid">
            {Array.from({ length: section.end - section.start + 1 }, (_, index) => section.start + index).map((number) => {
              const answer = answers[number - 1];
              const selected = isAnswer(answer);
              return <Button key={number} type="button" variant="ghost" pressScale={0.98}
                className="ios-answer-sheet-cell" data-question={number} data-answer-state={selected ? "answered" : "blank"}
                data-review-marked={marks.includes(number)}
                aria-label={`第 ${number} 题，${selected ? `已选 ${answer}` : "未答"}${current === number ? "，当前题" : ""}${marks.includes(number) ? "，已标记" : ""}`}
                aria-current={current === number ? "true" : undefined} tabIndex={active === number ? 0 : -1}
                ref={(element) => { if (element) cells.current.set(number, element); else cells.current.delete(number); }}
                onFocus={() => setActive(number)} onKeyDown={(event) => keyDown(event, number, sectionIndex)} onClick={() => onJump(number)}>
                <span className="ios-answer-sheet-number" aria-hidden="true">{number}</span>
                <span className={selected ? "ios-answer-sheet-answer" : "ios-answer-sheet-blank"} aria-hidden="true">{selected ? answer : "·"}</span>
              </Button>;
            })}
          </div>
        </section>;
      })}
    </div>
  </div>;
}

export function mountAnswerSheet(container: HTMLElement, props: AnswerSheetProps): Cleanup {
  return mountRoot(container, <AnswerSheet {...props} />);
}
