"""Local, source-hash-bound PDF extraction evidence for paper imports."""

import hashlib
import json
import re
import subprocess
import unicodedata
from functools import lru_cache
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / ".local" / "paper-import"


@lru_cache(maxsize=None)
def source_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def text_pages(path):
    with pymupdf.open(path) as doc:
        return [page.get_text(sort=True) for page in doc]


@lru_cache(maxsize=1)
def ocr_binary():
    WORK.mkdir(parents=True, exist_ok=True)
    source = ROOT / "scripts" / "ocr-papers.swift"
    binary = WORK / ("ocr-" + source_hash(source)[:16])
    if not binary.exists():
        subprocess.run(["swiftc", str(source), "-o", str(binary)], check=True, timeout=120)
    return binary


def ocr_page(path, page, *, scale=2.5, english=False, clip=None):
    """Cache results by PDF bytes, page, render settings and recognizer source."""
    binary = ocr_binary()
    settings = json.dumps([source_hash(path), page, scale, english, clip, binary.name])
    key = hashlib.sha256(settings.encode()).hexdigest()
    evidence = WORK / "ocr" / (key + ".json")
    if evidence.exists():
        return json.loads(evidence.read_text())
    evidence.parent.mkdir(parents=True, exist_ok=True)
    image = evidence.with_suffix(".png")
    with pymupdf.open(path) as doc:
        pdf_page = doc[page]
        bounds = None
        if clip:
            width, height = pdf_page.rect.width, pdf_page.rect.height
            bounds = pymupdf.Rect(clip[0] * width, clip[1] * height,
                                     clip[2] * width, clip[3] * height)
        pdf_page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), clip=bounds).save(image)
    command = [str(binary)] + (["--english"] if english else []) + [str(image)]
    result = subprocess.run(command, capture_output=True, text=True, check=True, timeout=60)
    data = json.loads(result.stdout)
    data.update({"source": str(Path(path).relative_to(ROOT / ".raw")),
                 "sourceSha256": source_hash(path), "pdfPage": page + 1,
                 "scale": scale, "english": english, "clip": clip})
    evidence.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return data


def reading_lines(data):
    """Vision can return columns separately; use coordinates for reading order."""
    rows = []
    for line in sorted(data["lines"], key=lambda item: -(item["y"] + item["height"] / 2)):
        center = line["y"] + line["height"] / 2
        row = next((r for y, r in rows if abs(y - center) < .008), None)
        if row is None:
            row = []
            rows.append((center, row))
        row.append(line)
    return [" ".join(item["text"] for item in sorted(row, key=lambda item: item["x"]))
            for _, row in rows]


def page_text(path, page, **kwargs):
    with pymupdf.open(path) as doc:
        native = doc[page].get_text(sort=True)
    if len(native.strip()) > 30:
        return native
    return "\n".join(reading_lines(ocr_page(path, page, **kwargs)))


def normalize_text(text):
    # PDF/OCR 的全角字符与西里尔同形字不会改变选项含义；G/O 等非 A–D 字母不能猜补。
    return unicodedata.normalize("NFKC", text).translate(str.maketrans("АВС", "ABC"))


def answer_groups(text, count):
    """Require every five-question range and five literal A–D answers exactly once."""
    groups = {}
    bad = []
    span = re.compile(r"([0-9IlS]+)\s*[-—–~～－]+\s*([0-9IlS]+)\s*[:：]?")
    for line in normalize_text(text).splitlines():
        matches = list(span.finditer(line))
        for i, match in enumerate(matches):
            start, end = [int(v.translate(str.maketrans("IlS", "115"))) for v in match.groups()]
            if not 1 <= start <= end <= count or end - start != 4:
                continue
            segment = line[match.end():matches[i + 1].start() if i + 1 < len(matches) else len(line)]
            answer = "".join(segment.split()).strip(":：.,，。;；")
            # 横向水印可能与答案同一行；只接受完整五个选项后由非拉丁字符隔开的旁注，不补猜错误字母。
            annotated = re.fullmatch(r'([ABCD]{5})[^A-Za-z].*', answer)
            if annotated:
                answer = annotated[1]
            if not re.fullmatch(r"[ABCD]{5}", answer):
                bad.append([start, end, answer])
                continue
            if start in groups:
                raise ValueError(f"Duplicate answer range {start}-{end}")
            groups[start] = answer
    missing = [n for n in range(1, count + 1, 5) if n not in groups]
    return groups, missing, bad


def booklet_boundaries(path, province=False):
    """Find the actual subsection headings; a scoring image alone cannot prove order."""
    labels = ["图形推理", "定义判断", "类比推理", "逻辑判断"]
    targets = [81, 91, 101, 106] if province else [76, 86, 96, 101]
    with pymupdf.open(path) as doc:
        length = len(doc)
    cache = {}

    def read(page):
        if page not in cache:
            text = page_text(path, page, scale=1.7)
            nums = [int(n) for n in re.findall(
                r"(?:^|\n)[^\d\n]{0,4}(\d{1,3})[.、．]\s*", text)]
            nums = [n for n in nums if 30 <= n <= 135]
            cache[page] = (text, nums)
        return cache[page]

    evidence = []
    for target, label in zip(targets, labels):
        low, high = 2, length - 3
        found = None
        while low <= high:
            page = (low + high) // 2
            text, nums = read(page)
            if not nums:
                page += 1
                text, nums = read(page)
            if not nums:
                raise ValueError(f"Cannot locate question {target}: {path.name}, page {page + 1}")
            if target in nums:
                found = page
                break
            if max(nums) < target:
                low = page + 1
            elif min(nums) > target:
                high = page - 1
            else:
                for nearby in [page - 1, page + 1]:
                    if target in read(nearby)[1]:
                        found = nearby
                        break
                break
        if found is None:
            # 题内表格也可能以数字开头，破坏页码二分的单调性；回查实际标题与题号共同出现的页。
            found = next((p for p in range(2, length - 2)
                          if target in read(p)[1] and label in read(p)[0]), None)
        if found is None:
            raise ValueError(f"Question {target} not found in {path.name}")
        heading_page = next((p for p in [found, found - 1]
                             if label in read(p)[0]), None)
        if heading_page is None:
            raise ValueError(f"Missing {label} heading near question {target} in {path.name}")
        evidence.append({"name": label, "start": target, "pdfPage": found + 1,
                         "headingPage": heading_page + 1})
    return evidence


TYPE_NAMES = {
    "政治理论": "politics", "常识判断": "common", "言语理解": "language",
    "数量关系": "quantity", "判断推理": "reasoning", "资料分析": "data",
    "图形推理": "graphic", "定义判断": "definition", "类比推理": "analogy",
    "逻辑判断": "logic",
}


def booklet_sections(path, count):
    """Read printed section starts, including reasoning subtypes, in source order."""
    names = "政治理论|常识判断|言语理解|数量关系|判断推理|资料分析"
    heading = re.compile(rf"^(?:第[一二三四五六七八九十0-9]+部分|[一二三四五六七八九十]+[、.．])\s*({names})")
    markers = []
    with pymupdf.open(path) as doc:
        length = len(doc)
    for page in range(length):
        text = normalize_text(page_text(path, page, scale=1.5))
        lines = text.splitlines()
        for i, line in enumerate(lines):
            match = heading.search(line)
            if match:
                # 材料内也有“2.24”等数字；模块边界必须用印刷题数累计，不能取看到的第一个数字。
                nearby = ' '.join(lines[i:i + 5])
                amount = re.search(r'共\s*(\d+)\s*[题題小]', nearby)
                if not amount:
                    raise ValueError(f'Missing printed section count: {path.name}, page {page+1}, {line}')
                markers.append({"id": TYPE_NAMES[match[1]], "name": match[1],
                                "count": int(amount[1]), "pdfPage": page + 1})
        if any(m["id"] == "data" for m in markers):
            break
    sections = markers
    ids = {s["id"] for s in sections}
    if not {"common", "language", "quantity", "data"} <= ids:
        raise ValueError(f"Incomplete section headings in {path.name}: {sections}")
    start = 1
    for section in sections:
        section['start'] = start
        section['end'] = start + section.pop('count') - 1
        start = section['end'] + 1
    if start != count + 1 or len(ids) != len(sections):
        raise ValueError(f'Printed module counts do not match {count} answers: {path.name}, {sections}')
    return sections
