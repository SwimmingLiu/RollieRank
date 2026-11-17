#!/usr/bin/env python3
"""Convert official .xls/.xlsx position tables into the versioned catalog schema."""

import argparse
from bisect import bisect_right
from datetime import date
import hashlib
import json
import math
from pathlib import Path
import re
import sys
from urllib.parse import quote, urlparse
import zipfile


ALIASES = {
    "code": ["职位代码", "职位编码", "岗位代码", "岗位编码", "招录职位代码", "招考职位代码"],
    "departmentCode": ["部门代码", "部门编码", "单位代码", "单位编码", "招录机关代码"],
    "department": ["部门名称", "招录机关", "招录单位", "招考单位", "单位名称", "机关名称", "招聘单位", "招录机关名称"],
    "unit": ["用人司局", "用人单位", "招录机关内设机构", "内设机构", "招考单位名称"],
    "title": ["招考职位", "职位名称", "招录职位", "岗位名称", "职位", "岗位"],
    "location": ["工作地点", "工作地区", "工作所在地", "工作单位所在地", "招考地区", "地区"],
    "education": ["学历", "学历要求", "学历学位", "学历学位要求"],
    "major": ["专业", "专业要求", "专业类别", "招考专业"],
    "recruits": ["招考人数", "招录人数", "招录计划", "计划人数", "招聘人数", "人数"],
    # Sheet names combine several institutions; preserve the actual columns for hierarchical browsing.
    "institutionCategory": ["机构性质", "机构类别", "机关类别"],
    "examCategory": ["考试类别", "考试类型", "笔试类别", "试卷类别"],
}


class ImportValidationError(ValueError):
    pass


def text(value):
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def header(value):
    return re.sub(r"[\s\u3000]+", "", text(value))


def identifier(value, number_format, coordinate, formula=False):
    if formula or isinstance(value, bool):
        raise ImportValidationError(f"{coordinate}：编码必须是文本或可靠的整数，不能使用公式。")
    if isinstance(value, (float, int)):
        if not math.isfinite(value) or value != int(value) or value < 0 or value >= 10**15:
            raise ImportValidationError(f"{coordinate}：数值编码无法可靠还原，请在原表中改用文本。")
        result = str(int(value))
        fmt = number_format.split(";")[0]
        if re.fullmatch(r"0+", fmt):
            result = result.zfill(len(fmt))
    else:
        result = text(value)
    if not result or len(result) > 120 or re.search(r"[\x00-\x1f]", result):
        raise ImportValidationError(f"{coordinate}：岗位或部门编码为空、过长或含控制字符。")
    if re.fullmatch(r"[+-]?\d+(?:\.\d+)?[eE][+-]?\d+", result):
        raise ImportValidationError(f"{coordinate}：科学计数法编码无法可靠还原，请使用原始文本编码。")
    return result


def position_id(exam, year, region, department_code, department, code):
    encode = lambda value: quote(str(value), safe="-_.!~*'()")
    return "pos:" + ":".join(map(encode, [exam, year, region, department_code or department, code]))


def exam_category_label(value):
    compact = re.sub(r"\s+", "", value).replace("（", "(").replace("）", ")")
    return {
        "中央机关及其省级直属机构综合管理类": "副省级",
        "市(地)级及以下直属机构综合管理类": "地市级",
        "副省级": "副省级", "地市级": "地市级", "行政执法类": "行政执法类",
    }.get(compact, value)


def merged_lookup(ranges):
    columns = {}
    for r0, r1, c0, c1 in ranges:
        for col in range(c0, c1):
            columns.setdefault(col, []).append((r0, r1, c0))
    for col, intervals in columns.items():
        intervals.sort()
        columns[col] = ([r[0] for r in intervals], intervals)
    def origin(row, col):
        if col in columns:
            starts, intervals = columns[col]
            index = bisect_right(starts, row) - 1
            if index >= 0 and row < intervals[index][1]:
                return intervals[index][0], intervals[index][2]
        return row, col
    return origin


def workbook_tables(path):
    if path.stat().st_size > 20 * 1024 * 1024:
        raise ImportValidationError("Excel 文件不能超过 20 MB。")
    if path.suffix.lower() == ".xls":
        try:
            import xlrd
        except ImportError as error:
            raise ImportValidationError("缺少 xlrd，请安装 scripts/positions-requirements.txt 中的依赖。") from error
        book = xlrd.open_workbook(path, formatting_info=True, on_demand=True)
        try:
            for sheet in book.sheets():
                origin = merged_lookup(sheet.merged_cells)
                def get(row, col):
                    if col >= sheet.ncols:
                        return None, "General", False
                    row, col = origin(row, col)
                    cell = sheet.cell(row, col)
                    xf = book.xf_list[cell.xf_index]
                    fmt = book.format_map[xf.format_key].format_str
                    return cell.value, fmt, cell.ctype in (xlrd.XL_CELL_ERROR, xlrd.XL_CELL_DATE, xlrd.XL_CELL_BOOLEAN)
                yield sheet.name, sheet.nrows, sheet.ncols, get
        finally:
            book.release_resources()
    elif path.suffix.lower() == ".xlsx":
        try:
            import openpyxl
        except ImportError as error:
            raise ImportValidationError("缺少 openpyxl，请安装 scripts/positions-requirements.txt 中的依赖。") from error
        with zipfile.ZipFile(path) as archive:
            if sum(item.file_size for item in archive.infolist()) > 100 * 1024 * 1024:
                raise ImportValidationError("Excel 解压后不能超过 100 MB。")
        book = openpyxl.load_workbook(path, data_only=False, keep_links=False)
        try:
            for sheet in book.worksheets:
                origin = merged_lookup([(r.min_row - 1, r.max_row, r.min_col - 1, r.max_col) for r in sheet.merged_cells.ranges])
                def get(row, col):
                    row, col = origin(row, col)
                    cell = sheet.cell(row + 1, col + 1)
                    return cell.value, cell.number_format, cell.data_type in ("f", "e")
                yield sheet.title, sheet.max_row, sheet.max_column, get
        finally:
            book.close()
    else:
        raise ImportValidationError("请选择 .xls 或 .xlsx 岗位表。")


def convert(path, *, exam, year, region, source_page, download_url, retrieved_at,
            publisher, label=None, source_id=None, announcement_page=None, columns=None, sheets=None, source_type="published"):
    if exam not in ("guokao", "shengkao") or not 2000 <= int(year) <= 2100:
        raise ImportValidationError("考试类型应为 guokao 或 shengkao，年度应为 2000–2100。")
    if not region or len(region) > 80 or not publisher or len(publisher) > 200:
        raise ImportValidationError("请填写地区与来源机构。")
    for name, value in (("来源页面", source_page), ("下载地址", download_url), ("公告页面", announcement_page)):
        if value and (urlparse(value).scheme not in ("https", "http") or not urlparse(value).netloc):
            raise ImportValidationError(f"{name}需要完整的 HTTP 或 HTTPS 地址。")
    if source_type not in ("published", "user-file"):
        raise ImportValidationError("来源类型无效。")
    if source_type == "published" and (not source_page or not download_url):
        raise ImportValidationError("请填写来源页面与原文件下载地址。")
    date.fromisoformat(retrieved_at)
    source_id = source_id or f"{exam}-{year}-{hashlib.sha256(region.encode()).hexdigest()[:10]}"
    if not re.fullmatch(r"[a-zA-Z0-9._-]{1,100}", source_id) or source_id in ("__proto__", "constructor", "prototype"):
        raise ImportValidationError("来源 ID 只能包含英文字母、数字、点、下划线或连字符。")
    mapping = columns or {}
    if not isinstance(mapping, dict) or set(mapping) - set(ALIASES):
        raise ImportValidationError("列映射包含未知字段。")
    positions, seen, imported_sheets, selected_sheets = [], {}, [], set(sheets or [])
    found_sheets = set()
    for name, row_count, col_count, get in workbook_tables(path):
        if selected_sheets and name not in selected_sheets:
            continue
        found_sheets.add(name)
        if row_count > 100000 or col_count > 200:
            raise ImportValidationError(f"{name}：工作表最多支持 100000 行、200 列。")
        indices, first_row = {}, None
        for row in range(min(row_count, 30)):
            values = [header(get(row, col)[0]) for col in range(col_count)]
            candidate = {}
            for field, aliases in ALIASES.items():
                accepted = [header(mapping[field])] if field in mapping else aliases
                matches = [i for i, value in enumerate(values) if value in accepted]
                if matches:
                    if len(matches) > 1:
                        raise ImportValidationError(f"{name} 第 {row + 1} 行：{field} 匹配多列，请显式指定列映射。")
                    candidate[field] = matches[0]
            if "code" in candidate and "title" in candidate:
                if "department" not in candidate:
                    raise ImportValidationError(f"{name} 第 {row + 1} 行：缺少部门名称列。")
                missing = [field for field in mapping if field not in candidate]
                if missing:
                    raise ImportValidationError(f"{name}：找不到已指定的列 {', '.join(missing)}。")
                indices, first_row = candidate, row + 1
                break
        if first_row is None:
            if selected_sheets or any(text(get(r, c)[0]) for r in range(min(row_count, 5))
                                      for c in range(min(col_count, 20))) and row_count > 30:
                raise ImportValidationError(f"{name}：未找到岗位编码、部门名称和岗位名称表头，请检查列映射。")
            continue
        count = 0
        for row in range(first_row, row_count):
            cells = {field: get(row, col) for field, col in indices.items()}
            values = {field: text(cell[0]) for field, cell in cells.items()}
            if not any(values.values()):
                continue
            coordinate = f"{name} 第 {row + 1} 行"
            if not values.get("code") and not values.get("title"):
                raise ImportValidationError(f"{coordinate}：非空行缺少岗位编码与名称，请移除说明或指定工作表。")
            code = identifier(*cells["code"][:2], coordinate, cells["code"][2])
            department_code = identifier(*cells["departmentCode"][:2], coordinate, cells["departmentCode"][2]) if values.get("departmentCode") else ""
            for field in ("department", "title"):
                if not values.get(field) or len(values[field]) > 300:
                    raise ImportValidationError(f"{coordinate}：{field} 不能为空，且不能超过 300 字。")
            # Optional source classifications keep the existing text bound; older tables may omit both columns.
            for field in ("unit", "location", "education", "major", "institutionCategory", "examCategory"):
                if len(values.get(field, "")) > 4000:
                    raise ImportValidationError(f"{coordinate}：{field} 超过 4000 字。")
            count_text = values.get("recruits", "")
            if count_text and (not re.fullmatch(r"\d+", count_text) or int(count_text) > 100000):
                raise ImportValidationError(f"{coordinate}：招录人数必须为非负整数。")
            pid = position_id(exam, year, region, department_code, values["department"], code)
            if pid in seen:
                raise ImportValidationError(f"{coordinate}：重复岗位编码 {code}，首次出现于 {seen[pid]}。")
            seen[pid] = coordinate
            # Retain the actual columns for browsing without adding classifications to the saved position identity.
            positions.append({
                "id": pid, "exam": exam, "year": int(year), "region": region, "code": code,
                "departmentCode": department_code, "department": values["department"],
                "title": values["title"], **{field: values.get(field, "") for field in ("unit", "location", "education", "major")},
                "recruits": int(count_text) if count_text else None,
                "sourceId": source_id, "sourceSheet": name, "sourceRow": row + 1,
                **({"institutionCategory": values["institutionCategory"]} if "institutionCategory" in values else {}),
                **({"examCategory": values["examCategory"], "examCategoryLabel": exam_category_label(values["examCategory"])} if "examCategory" in values else {}),
            })
            count += 1
        imported_sheets.append({"name": name, "headerRow": first_row, "count": count})
    if selected_sheets - found_sheets:
        raise ImportValidationError("找不到工作表：" + "、".join(sorted(selected_sheets - found_sheets)))
    if not positions:
        raise ImportValidationError("岗位表中没有可导入的岗位，请检查表头、工作表和列映射。")
    if len(positions) > 50000:
        raise ImportValidationError("单次最多导入 50000 个岗位。")
    return {"schemaVersion": 1, "source": {
        "id": source_id, "label": label or f"{year} 年{'国考' if exam == 'guokao' else region + '省考'}岗位表",
        "exam": exam, "year": int(year), "region": region, "publisher": publisher,
        "sourceType": source_type,
        "sourcePage": source_page, "announcementPage": announcement_page or source_page,
        "downloadUrl": download_url, "retrievedAt": retrieved_at, "fileName": path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "count": len(positions), "sheets": imported_sheets,
    }, "positions": positions}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--exam", required=True, choices=("guokao", "shengkao"))
    parser.add_argument("--year", required=True, type=int)
    parser.add_argument("--region", required=True)
    parser.add_argument("--source-page", default="")
    parser.add_argument("--download-url", default="")
    parser.add_argument("--source-type", choices=("published", "user-file"), default="published")
    parser.add_argument("--retrieved-at", required=True)
    parser.add_argument("--publisher", required=True)
    parser.add_argument("--label")
    parser.add_argument("--source-id")
    parser.add_argument("--announcement-page")
    parser.add_argument("--columns", type=Path, help="JSON object mapping schema fields to exact workbook headers")
    parser.add_argument("--sheet", action="append", dest="sheets")
    args = parser.parse_args()
    try:
        options = vars(args).copy()
        path, output = options.pop("input"), options.pop("output")
        options["columns"] = json.loads(args.columns.read_text()) if args.columns else None
        dataset = convert(path, **options)
        output.parent.mkdir(parents=True, exist_ok=True)
        temp = output.with_suffix(output.suffix + ".tmp")
        temp.write_text(json.dumps(dataset, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        temp.replace(output)
        print(json.dumps({"output": str(output), "count": len(dataset["positions"]), "source": dataset["source"]}, ensure_ascii=False))
    except zipfile.BadZipFile:
        print(json.dumps({"error": "Excel 文件损坏或格式与扩展名不一致。"}, ensure_ascii=False), file=sys.stderr)
        return 1
    except (ValueError, OSError) as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
