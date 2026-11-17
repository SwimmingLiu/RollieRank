# 岗位目录导入

当前内置目录为中央机关及其直属机构 2027 年度考试录用公务员招考简章，共 19,426 个岗位、35,691 个招录名额。2027 是招考年度，公告发表于 2026 年 10 月；两者不能混用。资料获取日期为 2026-11-14。

公告来源为[国家税务总局上海市税务局转载页面](https://shanghai.chinatax.gov.cn/tax/xxgk/rsxx/202610/t481763.html)，原始 Excel 压缩包下载自[新华网招考简章附件页面](https://www.xinhuanet.com/edu/20261014/b1348cb4596a4d3d95323b5dcb751c6a/c.html)。原包位于 `data/positions/sources/guokao-2027.zip`，文件哈希、四张工作表的记录数与来源信息位于同目录的 `manifest.json`。规范化目录为 `data/positions/guokao-2027.json`，每条记录保留原工作表和行号，完整报考条件以官方原表为准。

## Excel 导入环境

岗位查询、选岗、排行榜和已转换 JSON 的导入只需要现有 Node.js 服务。首次解析 Excel 时安装独立 Python 环境：

```bash
python3 -m venv /tmp/rollierank-positions-python
/tmp/rollierank-positions-python/bin/python -m pip install -r scripts/positions-requirements.txt
POSITIONS_PYTHON=/tmp/rollierank-positions-python/bin/python npm run dev
```

管理页的岗位目录区域可以选择 `.xls`、`.xlsx` 或规范化 `.json`，文件最多 20 MB。上传会分块进行，解析和校验全部通过后才写入目录；失败时保留已选文件和输入，原目录继续可用。

Excel 需填写考试类型、招考年度、地区、目录名称、来源机构及获取日期。来源和下载链接可选，未提供时明确标记为用户提供文件。用户导入文件始终与内置官方文件区分显示。JSON 使用文件内的来源信息。

## 命令行转换

导入器支持国考和省考常用列名，自动查找前 30 行中的表头。省考文件示例：

```bash
/tmp/rollierank-positions-python/bin/python scripts/import-positions.py 广东省考岗位表.xlsx \
  --output /tmp/guangdong-2027.json \
  --exam shengkao --year 2027 --region 广东 \
  --source-type user-file --publisher 用户提供文件 \
  --retrieved-at 2026-11-14 --label 广东省考岗位目录
```

公开发布的原表使用 `--source-type published`，并提供完整的 `--source-page`、`--download-url`。可用 `--source-id` 指定来源 ID，用 `--announcement-page` 记录单独的公告页面。转换后的 JSON 可在管理页导入，无需再次解析 Excel。

最少需要岗位编码、部门名称和岗位名称三列。常见别名包括职位代码、岗位代码、招录单位、招录机关、招考职位和职位名称。可选字段包括部门编码、用人单位、工作地点、学历、专业和招录人数。合并的部门单元格会按原表范围补齐，普通空白单元格不会自动沿用上一行。

非标准表头可通过 JSON 指定列映射，例如：

```json
{"code":"职位编号","department":"机关","title":"职务","recruits":"计划名额"}
```

将映射保存为 `columns.json`，在转换命令中添加 `--columns columns.json`。用 `--sheet 岗位表` 选择特定工作表，可重复传入多个工作表。缺失工作表或指定列会报错，不会生成部分目录。

## 编码与校验

岗位编码和部门编码都是字符串。文本 `000007` 原样保留；数值 7 配有明确的 `000000` 格式时恢复为 `000007`。超过可靠精度的数值编码、科学计数法文本、空编码及 `.xlsx` 中的公式编码会被拒绝。旧 `.xls` 的公式由 xlrd 读取缓存值，导入器不能据此判断原单元格是否使用公式，源表编码应优先使用文本。

岗位唯一标识包含考试、招考年度、地区、部门编码或部门名称、岗位编码。同一部门同年同地区的重复编码会同时报告两处原表行号，并拒绝整次导入。不同部门、不同年度或不同省份的同码岗位可以共存。来源 ID 已存在时也不会覆盖原目录。

导入器还校验非空字段、人数格式、空目录和记录数量。脚本退出码为 1 时，标准错误输出包含 JSON 错误信息，已有输出文件保持原样；退出码为 0 时才原子替换输出文件。

## 验证命令

```bash
POSITIONS_PYTHON=/tmp/rollierank-positions-python/bin/python node --test test/positions*.test.js
```

Excel 测试需要上述 Python 依赖，浏览器测试需要 Playwright 与 Chromium。依赖缺失时，对应可选测试会明确显示跳过；服务端榜单和选岗行为测试不依赖这些工具。
