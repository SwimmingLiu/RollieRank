# 答题卡识别（OMR）

把手机拍的答题卡照片读成 1–140 题的 A/B/C/D，并可直接对照一套卷打分。识别在 Node 进程内完成，不调用外部 OCR 服务。

## 为什么不是 OCR

OCR 只会把 `[A][B][C][D]` 这些印刷字读出来，读不出“哪一格被铅笔涂黑了”。答题卡是**光学标记识别（OMR）**问题：先定位每个选项格，再比较四格的填充率，取得分最高的那格。DeepSeek-OCR 一类接口只能作为辅助（读题号、校正版式），不能替代判定。

## 接口

与服务端其余模块一样走同一套 JSON 分发：同源校验、Bearer 维护者凭证（`ROLLIERANK_REVIEW_TOKEN`）对 `/api/omr/*` 不强制，识别是公开能力。

| 路径 | 方法 | 输入 | 返回 |
| --- | --- | --- | --- |
| /api/omr/health | GET | 无 | `{ok, imageLimit, maxQuestions}` |
| /api/omr/recognize | POST | `{image, expectedQuestions?}` | 识别结果（见下） |
| /api/omr/recognize-url | POST | `{url, expectedQuestions?}` | 同上，服务端代下载 |
| /api/omr/grade | POST | `{versionId, recognized}` | 对照套卷的打分报告 |

### /api/omr/recognize

`image` 为 JPEG 的 base64，可直接带 `data:image/jpeg;base64,` 前缀。上限 12 MB。目前只接受 JPEG；其他格式请在客户端先转码。

返回：

```json
{
  "questions": [{ "number": 1, "answer": "D", "confidence": 0.91 }],
  "recognized": 130,
  "blank": 10,
  "averageConfidence": 0.82,
  "layout": { "engine": "omr-v2", "style": "column", "box": {}, "groups": 7 },
  "warnings": [],
  "elapsedMs": 620,
  "imageDigest": "sha256…",
  "cached": false
}
```

`expectedQuestions` 给出后按题号补齐，缺答的题输出 `answer: null`。置信度是“最优格与次优格的填充率差”，低于 0.25 的题建议人工复核。

`layout.style` 表示识别用的版式：`column` 是每题一列、选项竖排（蓝底答题区那种），`row` 是每题一行、选项横排（白底公务员答题卡）。行式版式的 `layout` 还会带 `rows`（检测到的题行数）、`blocks`（答题块数）和 `shear`（照片倾斜的剪切量，约 0.03 表示 1.7°）。

同一张图片按 sha256 缓存（进程内，最近 40 张），重复提交返回 `cached: true`，不再重复计算。

### /api/omr/grade

`recognized` 直接传 `/api/omr/recognize` 的返回即可。题数须与套卷题数一致（答空题请传 `answer: null`，不要省略条目），否则返回 400；缺答按空题计分。

返回 `answers`（按套卷题号排列，未识别为 null）、`report`（与正式交卷同一套 `gradeVersion` 计分）、`unrecognized`。

## 命令行

```bash
npm run omr -- test/fixtures/omr/sheet-a.jpg --json
npm run omr -- photo.jpg --repeat 5 --expected 140     # 连续跑 5 次，报告冷启动与平均耗时
```

## 验证

```bash
node --test test/omr.test.js          # 接口契约、缓存、对照打分
npm run verify:omr -- --repeat 3      # 真起服务 + 三张不同版式照片 + 耗时
```

`verify:omr` 会写出 `test-results/omr/omr.json` 与每张图的答案文本，并在以下情况失败：

- 识别题数掉到实测基线以下 12 题（sheet-a 99、sheet-b 123、sheet-c 101）。这是回归门禁，不是能力目标：三张样张都有真实的空格或漏涂，达不到 140
- 与 `test/fixtures/omr/*.answers.json` 的人工转录答案逐题比对，正确题数低于下限（sheet-a 118、sheet-b 132、sheet-c 110），或错判超过上限（sheet-a 6、sheet-b 2、sheet-c 6）。错判既包括读错字母，也包括把空格读成答案——它比漏读更不能接受
- 平均请求耗时超过 `--max-average-ms`（默认 8000）
- 三张版式相同、作答不同的答题卡读出完全相同的答案（说明没有真正判读涂黑）

CI 的 `RollieRank verification` 作业会跑这两条，证据随其他验证产物一起保留 14 天。

## 测试图

`test/fixtures/omr/` 下三张真实照片，覆盖三种版式：

| 文件 | 尺寸 | 版式 | 人工答案 |
| --- | --- | --- | --- |
| sheet-a.jpg | 1282×1710 | 蓝底/白底交替，每题一列、选项竖排 | 129 题有涂痕 |
| sheet-b.jpg | 1440×1920 | 白底竖版，每题一行、选项横排，整页倾斜约 2° | 135 题有涂痕 |
| sheet-c.jpg | 1282×1710 | 蓝底，带分隔线，噪声更多 | 130 题有涂痕 |

答案键 `sheet-*.answers.json` 是逐格高倍核对的人工转录结果，用作正确率门禁；换图时必须同时更新答案键。

## 运行要求

- Node 20+
- 运行依赖只有 `jpeg-js`（解码 JPEG）。部署脚本用 `npm ci --omit=dev` 安装它，见 `deploy/install-node-api.sh`。

## 已知边界

- 只支持 JPEG；HEIC/PNG 需客户端先转码。
- 分辨率：引擎的几何阈值在长边 1710–2048px 上标定。长边超过约 2260px 时直接缩到 2048 和 1710 两个尺度各读一次、取答得多的那份（手机原图就走这条路径，单张约 1.5–3 秒）；长边低于约 1080px 时阈值不够用，识别会明显退化。
- 答题卡版式按“140 题 × 4 选项 × 7 个块 × 每块 20 题”建模，支持两种排布：每题一列（`column`）和每题一行（`row`）；其他版式需要新增版式参数。
- 行式版式要求题目行在照片上是水平方向可聚类的：倾斜超过约 6° 或强透视时，剪切校正只能还原一部分。
- 白底卡上颜色很浅的涂痕可能漏检，整列空白的题位会保留为缺答，而不是顺次错位。
- 涂得极淡、跨格涂改、折痕遮挡的题可能识别为空格，需要用 `warnings` 与低置信度提示人工复核。
- 公开样张实测（2026-11）：三张官方回归图正确率 A 125/129、B 135/135、C 118/130。外部样张里，白底红字印刷格、空白卡、整页斜拍或只占画面一角时准确率明显下降：4K 手机原图（3120×4160）上的白底红字卡只能读出 10–20 题，空白卡会读入少量印刷框假答案。这类输入需要先修版式定位，不能靠调阈值硬凑。
