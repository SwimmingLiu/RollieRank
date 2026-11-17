#!/usr/bin/env python3
"""Regenerate PAGES.md from the unpacked v78 bundle.

Usage:
    python3 tools/gen-pages.py [source-dir] [out-file]

Reads source/app-service.js, slices each `__wxRoute = '<route>'` region, and
extracts the Page({...}) object: top-level data keys, default values and method
names. Output mirrors the layout the previous hand-run tool produced.
"""

import json
import os
import re
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "source"
OUT = sys.argv[2] if len(sys.argv) > 2 else "PAGES.md"

TRUE, FALSE, NULL, UNDEF = "\x01T", "\x01F", "\x01N", "\x01U"


def decode_literal(expr):
    """Turn a minified JS literal into a Python value, or a placeholder string."""
    e = expr.strip()
    if e == "!0":
        return True
    if e == "!1":
        return False
    if e == "null":
        return None
    if e in ("void 0", "undefined"):
        return UNDEF
    if e.startswith('"') and e.endswith('"'):
        try:
            return json.loads(e)
        except Exception:
            return e[1:-1]
    if e.startswith("'") and e.endswith("'"):
        return e[1:-1]
    if re.fullmatch(r"-?\d+(\.\d+)?", e):
        return float(e) if "." in e else int(e)
    if e.startswith("[") and e.endswith("]"):
        return [] if e == "[]" else ["<%d items>" % (e.count(",") + 1)]
    if e.startswith("{") and e.endswith("}"):
        return {} if e == "{}" else "{...}"
    # identifier / call expression: the initial value comes from a module constant
    return "<expr:%s>" % e if len(e) < 40 else "<expr>"


def split_top_level(body):
    """Split an object body on commas that are not nested inside brackets/quotes."""
    parts, depth, cur, i, n = [], 0, [], 0, len(body)
    quote = None
    while i < n:
        c = body[i]
        if quote:
            cur.append(c)
            if c == "\\":
                cur.append(body[i + 1] if i + 1 < n else "")
                i += 2
                continue
            if c == quote:
                quote = None
            i += 1
            continue
        if c in "\"'`":
            quote = c
            cur.append(c)
        elif c in "{[(":
            depth += 1
            cur.append(c)
        elif c in "}])":
            depth -= 1
            cur.append(c)
        elif c == "," and depth == 0:
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(c)
        i += 1
    if cur:
        parts.append("".join(cur))
    return [p for p in parts if p.strip()]


def brace_span(text, start, open_ch="{", close_ch="}"):
    """Return (body_start, body_end) of the balanced block starting at `start`."""
    assert text[start] == open_ch
    depth, i, quote = 0, start, None
    while i < len(text):
        c = text[i]
        if quote:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in "\"'`":
            quote = c
        elif c == open_ch:
            depth += 1
        elif c == close_ch:
            depth -= 1
            if depth == 0:
                return start + 1, i
        i += 1
    return start + 1, len(text)


def parse_page(chunk):
    m = re.search(r"Page\(\{", chunk)
    if not m:
        return None
    body_start, body_end = brace_span(chunk, m.end() - 1)
    body = chunk[body_start:body_end]

    data_fields, defaults = [], {}
    methods = []
    for part in split_top_level(body):
        km = re.match(r"\s*([A-Za-z_$][\w$]*)\s*:", part)
        if not km:
            continue
        key = km.group(1)
        value = part[km.end():]
        if key == "data" and value.lstrip().startswith("{"):
            vs = len(part) - len(value.lstrip())
            ds, de = brace_span(part, vs)
            for field in split_top_level(part[ds:de]):
                fm = re.match(r"\s*([A-Za-z_$][\w$]*)\s*:\s*(.*)$", field, re.S)
                if not fm:
                    continue
                data_fields.append(fm.group(1))
                defaults[fm.group(1)] = decode_literal(fm.group(2))
        elif re.match(r"\s*function\s*\(", value):
            methods.append(key)
    return data_fields, defaults, methods


def to_jsonable(v):
    if v is UNDEF:
        return "<undefined>"
    return v


def main():
    app = open(os.path.join(SRC, "app-service.js"), encoding="utf-8", errors="replace").read()
    cfg = json.load(open(os.path.join(SRC, "app-config.json"), encoding="utf-8"))

    marks = [(m.start(), m.group(1)) for m in re.finditer(r"__wxRoute = '([^']+)'", app)]
    routes = []
    for i, (pos, name) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(app)
        if not name.startswith("pages/"):
            continue
        parsed = parse_page(app[pos:end])
        if parsed:
            routes.append((name, parsed))

    order = cfg["pages"]
    routes.sort(key=lambda r: order.index(r[0]) if r[0] in order else 999)
    pages_cfg = cfg.get("page", {})

    lines = []
    lines.append("# 行测小助理 — 小程序全页面扒包报告")
    lines.append("")
    lines.append("- AppID: `wxd74bddd3fe422729`")
    lines.append("- 包版本: **v78**")
    lines.append("- 页面数: %d（无分包）" % len(order))
    lines.append("- 入口: `%s`" % cfg.get("entryPagePath", ""))
    lines.append("- 导航标题: %s" % cfg.get("global", {}).get("window", {}).get("navigationBarTitleText", ""))
    lines.append("")
    lines.append("> 本文件由 `tools/gen-pages.py` 从 `source/app-service.js` 的 `Page()` 定义自动生成，")
    lines.append("> 覆盖全部 %d 个页面的 data 默认值与方法清单。" % len(order))
    lines.append("> 交互截图见 `screenshots/`，设计分析见 `UI-DESIGN.md`，版本变更见 `CHANGELOG-v76-to-v78.md`。")
    lines.append("")
    lines.append("## 阅读顺序建议")
    lines.append("")
    lines.append("1. 先看 `UI-DESIGN.md` 的「视觉语言」和「可复用的交互模式」两节 —— 建立整体印象")
    lines.append("2. 再看下面「页面清单」了解全貌")
    lines.append("3. 需要具体实现细节时，按页面查 data 字段与 methods")
    lines.append("4. `source/app-service.js` 里搜 `__wxRoute = 'pages/xxx/xxx'` 可以定位到该页的完整实现")
    lines.append("")
    lines.append("## 页面清单")
    lines.append("")
    lines.append("| # | 路由 | 标题 |")
    lines.append("|---|---|---|")
    for i, route in enumerate(order, 1):
        w = pages_cfg.get(route + ".html", {}).get("window", {})
        lines.append("| %d | `%s` | %s |" % (i, route, w.get("navigationBarTitleText", "—")))
    lines.append("")
    lines.append("## 逐页结构与数据")

    for route in order:
        parsed = next((p for r, p in routes if r == route), None)
        if not parsed:
            continue
        fields, defaults, methods = parsed
        w = pages_cfg.get(route + ".html", {}).get("window", {})
        lines.append("")
        lines.append("### `%s`" % route)
        lines.append("")
        lines.append("- 标题: %s" % w.get("navigationBarTitleText", "（无）"))
        if w:
            extra = {k: v for k, v in w.items() if k != "navigationBarTitleText"}
            if extra:
                lines.append("- window: `%s`" % json.dumps(extra, ensure_ascii=False))
        lines.append("- data 字段 (%d): %s" % (len(fields), ", ".join("`%s`" % f for f in fields)))
        lines.append("- 方法 (%d): %s" % (len(methods), ", ".join(methods)))
        shown = {k: to_jsonable(v) for k, v in defaults.items()
                 if not isinstance(to_jsonable(v), str) or not to_jsonable(v).startswith("<expr")}
        if shown:
            lines.append("")
            lines.append("默认值:")
            lines.append("```json")
            lines.append(json.dumps(shown, ensure_ascii=False, indent=1))
            lines.append("```")

    open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print("wrote %s: %d pages" % (OUT, len(order)))


if __name__ == "__main__":
    main()
