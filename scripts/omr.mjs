#!/usr/bin/env node
/**
 * 答题卡识别 CLI：给验证脚本、批量回放和第三方集成共用同一套识别实现。
 *
 * 用法:
 *   node scripts/omr.mjs <图片...> [--json] [--expected <题数>] [--repeat <次数>] [--debug <目录>]
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createOmrService } from "../server/omr.mjs";

const USAGE = `答题卡识别 CLI

用法:
  node scripts/omr.mjs <图片...> [选项]

选项:
  --json                 只输出 JSON（给脚本和 AI 解析）
  --expected <题数>      按套卷题数补齐，缺答的题输出空值
  --repeat <次数>        同一张图连续识别多次，报告耗时分布（第一次算冷启动）
  --debug <目录>         额外写出定位证据 PNG/JSON
  -h, --help             显示这段说明`;

function parse(argv) {
  const files = [];
  const options = { json: false, repeat: 1, expected: undefined, debug: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") { console.log(USAGE); process.exit(0); }
    else if (arg === "--json") options.json = true;
    else if (arg === "--expected") options.expected = Number(argv[++i]);
    else if (arg === "--repeat") options.repeat = Math.max(1, Number(argv[++i]) || 1);
    else if (arg === "--debug") options.debug = argv[++i];
    else if (arg.startsWith("--")) { console.error(`未知选项 ${arg}`); process.exit(2); }
    else files.push(arg);
  }
  if (!files.length) { console.error(USAGE); process.exit(2); }
  return { files, options };
}

const handler = createOmrService();

// 直接复用 HTTP 服务里的识别分支，CLI 与接口不会出现两套算法。
async function recognizeFile(file, options) {
  const response = { statusCode: 0, body: null };
  const send = (status, body) => { response.statusCode = status; response.body = body; };
  const bytes = await (await import("node:fs/promises")).readFile(file);
  const input = { image: bytes.toString("base64"), expectedQuestions: options.expected };
  let served;
  try {
    served = await handler({
      pathname: "/api/omr/recognize", method: "POST", input, send,
      request: { headers: {} },
    });
  } catch (error) {
    throw Object.assign(new Error(error.message), { statusCode: error.statusCode ?? 500 });
  }
  if (!served) throw new Error("识别接口未注册。");
  if (response.statusCode !== 200) throw new Error(response.body?.error ?? "识别失败。");
  return response.body;
}

const { files, options } = parse(process.argv.slice(2));
const outputs = [];
let failed = false;
for (const file of files) {
  const samples = [];
  let last = null;
  for (let i = 0; i < options.repeat; i++) {
    const started = process.hrtime.bigint();
    try {
      last = await recognizeFile(file, options);
    } catch (error) {
      console.error(`${file}: ${error.message}`);
      failed = true;
      break;
    }
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  if (!last) continue;
  if (options.debug) {
    await mkdir(options.debug, { recursive: true });
    const name = path.basename(file, path.extname(file));
    await writeFile(path.join(options.debug, `${name}.json`), JSON.stringify(last, null, 2));
  }
  outputs.push({
    file,
    recognized: last.recognized,
    blank: last.blank,
    averageConfidence: last.averageConfidence,
    layout: last.layout,
    warnings: last.warnings,
    answers: last.questions.map((q) => q.answer ?? "-").join(""),
    timingsMs: samples.map((ms) => Number(ms.toFixed(1))),
    coldMs: Number(samples[0]?.toFixed(1) ?? 0),
    warmMs: samples.length > 1 ? Number((samples.slice(1).reduce((a, b) => a + b, 0) / (samples.length - 1)).toFixed(1)) : null,
  });
}
if (options.json) console.log(JSON.stringify(outputs, null, 2));
else for (const out of outputs)
  console.log(`${path.basename(out.file)}: ${out.recognized} 题识别 / ${out.blank} 空 · 置信度 ${out.averageConfidence} · 冷启动 ${out.coldMs}ms${out.warmMs !== null ? ` · 平均 ${out.warmMs}ms` : ""}\n  ${out.answers}`);
process.exit(failed ? 1 : 0);
