"""答题卡识别（OMR）回归：真实服务 + 三张不同版式的答题卡照片。

只走真实接口，不 mock 算法：识别失败、耗时退化都要在这里暴露。
运行：python3 scripts/verify-omr.py [--repeat 3] [--output test-results/omr]
"""

import argparse
import base64
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "test/fixtures/omr"
SHEETS = ["sheet-a.jpg", "sheet-b.jpg", "sheet-c.jpg"]
ANSWER_KEY = FIXTURES


def accuracy(name, answers):
    key = json.loads((ANSWER_KEY / f"{Path(name).stem}.answers.json").read_text(encoding="utf-8"))["answers"]
    correct = wrong = missed = extra = 0
    for index, answer in enumerate(answers, start=1):
        truth = key.get(str(index))
        if truth and answer == truth:
            correct += 1
        elif truth and not answer:
            missed += 1
        elif truth and answer:
            wrong += 1
        elif not truth and answer:
            wrong += 1
            extra += 1
    return {"correct": correct, "wrong": wrong, "missed": missed, "extra": extra}
QUESTION_COUNT = 140
# 识别下限来自实测基线（减 12 题容差）。这是回归门禁，不是能力目标：
# 三张样张本身都有真实的空格/漏涂，无法都达到 125 题。
RECOGNITION_FLOOR = {
    "sheet-a.jpg": 99,
    "sheet-b.jpg": 123,
    "sheet-c.jpg": 101,
}
# 正确率门禁：与 test/fixtures/omr/*.answers.json 的人工转录答案逐题比对。
# 下限同样取实测值留余量；wrong 是错判上限（把空格读成答案也算错判），
# 因为错判比漏读更不可接受。
ACCURACY_FLOOR = {
    "sheet-a.jpg": {"correct": 118, "wrong": 6},
    "sheet-b.jpg": {"correct": 132, "wrong": 2},
    "sheet-c.jpg": {"correct": 110, "wrong": 6},
}


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def api(base, path, data=None, timeout=120):
    body = json.dumps(data).encode() if data is not None else None
    headers = {"Content-Type": "application/json"} if body else {}
    request = Request(base + "/api/" + path, data=body, headers=headers)
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        return error.code, json.load(error)


def wait_for_server(base, process, seconds=60):
    deadline = time.time() + seconds
    while time.time() < deadline:
        if process.poll() is not None:
            raise RuntimeError("服务提前退出，请检查 node 与依赖。")
        try:
            with urlopen(base + "/api/omr/health", timeout=2) as response:
                if response.status == 200:
                    return
        except (URLError, HTTPError):
            time.sleep(0.25)
    raise RuntimeError("服务未能在 60 秒内就绪。")


def start_server(data_dir):
    port = free_port()
    environment = dict(os.environ)
    environment["PORT"] = str(port)
    environment["ROLLIERANK_DATA_DIR"] = str(data_dir)
    process = subprocess.Popen(
        ["node", "scripts/serve.mjs"], cwd=ROOT, env=environment,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    base = f"http://127.0.0.1:{port}"
    wait_for_server(base, process)
    return base, process


def recognize(base, path, expected=QUESTION_COUNT):
    payload = base64.b64encode(path.read_bytes()).decode()
    started = time.time()
    status, body = api(base, "omr/recognize", {"image": payload, "expectedQuestions": expected})
    elapsed = (time.time() - started) * 1000
    return status, body, elapsed


def make_negative_jpegs(directory):
    """用项目自带的 jpeg-js 生成典型非答题卡图片，验证服务端必须 422 拒绝、不能硬凑答案。"""
    script = """
    const fs = require("node:fs");
    const path = require("node:path");
    const jpeg = require("jpeg-js");
    const dir = process.argv[1];
    function write(name, w, h, fn) {
      const data = Buffer.alloc(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const [r, g, b] = fn(x, y);
          const p = (y * w + x) * 4;
          data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255;
        }
      }
      fs.writeFileSync(path.join(dir, name), jpeg.encode({ width: w, height: h, data }, 85).data);
    }
    let seed = 42;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const book = [];
    for (let row = 0; row < 45; row++) {
      const y = 120 + row * 34;
      let x = 100;
      while (x < 1150) {
        const w = 15 + Math.floor(rand() * 35), h = 10 + Math.floor(rand() * 8);
        if (rand() < 0.7) book.push([x, y, x + w, y + h]);
        x += w + 8 + Math.floor(rand() * 20);
      }
    }
    write("neg-book-text.jpg", 1280, 1710, (x, y) => {
      for (const b of book) if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return [45, 45, 45];
      return [232, 232, 228];
    });
    write("neg-grid.jpg", 1280, 1710, (x, y) => {
      const gx = x % 48, gy = y % 36;
      return gx >= 10 && gx <= 36 && gy >= 8 && gy <= 24 ? [40, 42, 45] : [210, 212, 215];
    });
    """
    subprocess.run(["node", "-e", script, str(directory)], cwd=ROOT, check=True)
    cases = [
        ("neg-book-text.jpg", directory / "neg-book-text.jpg"),
        ("neg-grid.jpg", directory / "neg-grid.jpg"),
    ]
    qrcode = ROOT / "assets/miniprogram-qrcode.jpg"
    if qrcode.exists():
        cases.append(("miniprogram-qrcode.jpg", qrcode))
    return cases


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repeat", type=int, default=3, help="每张图重复识别的次数")
    parser.add_argument("--output", default="test-results/omr")
    parser.add_argument("--max-average-ms", type=float, default=8000, help="单张图平均耗时的上限")
    args = parser.parse_args()

    output = ROOT / args.output
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    missing = [name for name in SHEETS if not (FIXTURES / name).exists()]
    assert not missing, f"缺少测试图片: {missing}"

    data_dir = Path(tempfile.mkdtemp(prefix="rollierank-omr-"))
    results = {"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "sheets": [], "negatives": [], "failures": []}
    process = None
    try:
        base, process = start_server(data_dir)
        for name in SHEETS:
            path = FIXTURES / name
            timings, last = [], None
            for _ in range(max(1, args.repeat)):
                status, body, elapsed = recognize(base, path)
                if status != 200:
                    results["failures"].append({"sheet": name, "status": status, "error": body.get("error")})
                    break
                timings.append(round(elapsed, 1))
                last = body
            if not last or status != 200:
                continue
            answers = [q["answer"] for q in last["questions"]]
            scored = accuracy(name, answers)
            entry = {
                "sheet": name,
                "accuracy": scored,
                "recognized": last["recognized"],
                "blank": last["blank"],
                "averageConfidence": last["averageConfidence"],
                "elapsedMs": last["elapsedMs"],
                "requestMs": timings,
                "averageRequestMs": round(sum(timings) / len(timings), 1),
                "answers": answers,
                "layout": last.get("layout"),
                "warnings": last.get("warnings", []),
            }
            results["sheets"].append(entry)
            floor = RECOGNITION_FLOOR.get(name, QUESTION_COUNT - 15)
            if last["recognized"] < floor:
                results["failures"].append({
                    "sheet": name, "error": f"只识别出 {last['recognized']} 题，少于 {floor} 题的下限。"})
            if entry["averageRequestMs"] > args.max_average_ms:
                results["failures"].append({
                    "sheet": name, "error": f"平均耗时 {entry['averageRequestMs']}ms 超过 {args.max_average_ms}ms。"})
            limit = ACCURACY_FLOOR.get(name)
            if limit:
                if scored["correct"] < limit["correct"]:
                    results["failures"].append({
                        "sheet": name,
                        "error": f"与人工答案只对上 {scored['correct']} 题，少于 {limit['correct']} 题的下限。"})
                if scored["wrong"] > limit["wrong"]:
                    results["failures"].append({
                        "sheet": name,
                        "error": f"错判 {scored['wrong']} 题，超过 {limit['wrong']} 题的上限。"})

        # 三张图版式相同但作答不同：识别结果必须彼此不同，否则说明在读版式而不是读涂黑。
        signatures = {name: tuple(entry["answers"]) for name, entry in
                      ((entry["sheet"], entry) for entry in results["sheets"])}
        unique = {sig for sig in signatures.values()}
        if len(signatures) > 1 and len(unique) == 1:
            results["failures"].append({"error": "三张答题卡识别出完全相同的答案，疑似没有真正判读涂黑。"})

        # 非答题卡图片必须被 422 拒收，绝不能返回 200 或硬凑假答案。
        for neg_name, neg_path in make_negative_jpegs(data_dir):
            neg_status, neg_body, neg_ms = recognize(base, neg_path)
            results["negatives"].append({
                "name": neg_name,
                "status": neg_status,
                "elapsedMs": round(neg_ms, 1),
                "error": neg_body.get("error") if isinstance(neg_body, dict) else None,
                "recognized": neg_body.get("recognized", 0) if isinstance(neg_body, dict) else 0,
            })
            if neg_status != 422:
                results["failures"].append({
                    "sheet": neg_name,
                    "error": f"非答题卡图片应返回 422 拒收，实际返回 HTTP {neg_status}（识别 {neg_body.get('recognized', 0)} 题）。",
                })

        results["summary"] = {
            "sheets": len(results["sheets"]),
            "recognized": [entry["recognized"] for entry in results["sheets"]],
            "correct": [entry["accuracy"]["correct"] for entry in results["sheets"]],
            "wrong": [entry["accuracy"]["wrong"] for entry in results["sheets"]],
            "negativesRejected": sum(1 for item in results["negatives"] if item["status"] == 422),
            "negativesTotal": len(results["negatives"]),
            "averageRequestMs": round(
                sum(entry["averageRequestMs"] for entry in results["sheets"]) / len(results["sheets"]), 1)
            if results["sheets"] else None,
        }
    finally:
        if process is not None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
        shutil.rmtree(data_dir, ignore_errors=True)

    (output / "omr.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    for entry in results["sheets"]:
        (output / f"{entry['sheet']}.answers.txt").write_text(
            "\n".join(f"{i + 1}. {answer or '—'}" for i, answer in enumerate(entry["answers"])) + "\n",
            encoding="utf-8")
    print(json.dumps(results.get("summary"), ensure_ascii=False, indent=2))
    for failure in results["failures"]:
        print("失败:", json.dumps(failure, ensure_ascii=False))
    sys.exit(1 if results["failures"] else 0)


if __name__ == "__main__":
    main()
