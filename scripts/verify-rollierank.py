#!/usr/bin/env python3
"""Build, launch, drive and inspect RollieRank through its real user surfaces."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
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
DEFAULT_OUTPUT = ROOT / "test-results" / "verification"
SCENARIOS = {
    "miniprogram-ui": ("test/miniprogram-layout.test.js", "test/miniprogram-web.test.js", "test/miniprogram-timer.test.js", "test/wechat-profile.test.js"),
    "core": ("test/feature-integration.test.js",),
    "catalog-admin": ("test/imported-papers.test.js", "test/booklet-time-limits.test.js", "test/positions-import.test.js"),
    "practice-history": ("test/prototype-state.test.js", "test/model.test.js", "test/ios-entry.test.js", "test/ios-preview-cleanup.test.js", "test/preview-history-recovery.test.js"),
    "positions-rank": ("test/positions.test.js", "test/leaderboard.test.js", "test/positions-hierarchy.test.js", "test/ios-positions-browser.test.js", "test/positions-feature.test.js", "test/miniprogram-layout.test.js"),
    "discussion": ("test/discussions.test.js", "test/discussions-client.test.js", "test/discussions-interactions.test.js", "test/ios-discussions.test.js", "test/ios-discussions-interactions-browser.test.js", "test/ios-discussion-links.test.js"),
    "analytics": ("test/analytics.test.js", "test/ios-analytics.test.js", "test/ios-analytics-components.test.js", "test/ios-analytics-browser.test.js"),
    "corrections": ("test/corrections-service.test.js", "test/corrections-api.test.js", "test/ios-corrections-browser.test.js", "test/ios-question-feedback-browser.test.js", "test/miniprogram-layout.test.js"),
    "sharing": ("test/ios-analytics-components.test.js", "test/ios-share-modes.test.js", "test/ios-sharing-browser.test.js"),
    "insights": ("test/positions-insights.test.js", "test/ios-insights-browser.test.js"),
    "timing-practice": ("test/practice-timer.test.js", "test/timer-paper-picker.test.js", "test/timer-configuration.test.js", "test/miniprogram-timer.test.js", "test/booklet-time-limits.test.js", "test/ios-timer-entry-feedback-browser.test.js", "test/ios-timer-latest-feedback-browser.test.js", "test/ios-practice-session-browser.test.js"),
}


class VerificationError(RuntimeError):
    """A user-visible reason the verification run is not usable."""


def command_exists(name: str) -> bool:
    return shutil.which(name) is not None


def python_module(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def doctor() -> dict:
    node = shutil.which("node")
    version = ""
    if node:
        version = subprocess.run([node, "-e", "process.stdout.write(process.versions.node)"], cwd=ROOT, text=True, capture_output=True, check=False).stdout
    node_major = int(version.split(".", 1)[0]) if version.split(".", 1)[0].isdigit() else 0
    required = {
        "node": bool(node and node_major >= 20),
        "npm": command_exists("npm"),
        "python": sys.version_info >= (3, 10),
        "playwright-python": python_module("playwright"),
        "playwright-node": False,
        "excel-python": python_module("openpyxl") and python_module("xlrd"),
        "chromium": False,
        "beui-dependencies": (ROOT / "docs/ui-exploration/ios-v3/ui/node_modules").is_dir(),
        "source": (ROOT / "scripts/serve.mjs").is_file() and (ROOT / "docs/ui-exploration/ios-v3/app.html").is_file(),
    }
    # Browser tests used to skip when only Python's Playwright was installed.
    if node:
        required["playwright-node"] = subprocess.run([node, "--input-type=module", "-e", "import { chromium } from 'playwright'; const browser = await chromium.launch({headless:true}); await browser.close();"], cwd=ROOT, capture_output=True, check=False).returncode == 0
    if required["playwright-python"]:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as playwright:
            try:
                browser = playwright.chromium.launch(headless=True)
                required["chromium"] = True
                browser.close()
            except Exception:
                required["chromium"] = False
    report = {"ok": all(required.values()), "root": str(ROOT), "node": version or None, "checks": required}
    if not report["ok"]:
        report["remediation"] = {
            "node": "Install Node.js 20 or newer.",
            "npm": "Install npm with Node.js.",
            "python": "Install Python 3.10 or newer.",
            "playwright-python": "Run uv sync --frozen, or pip install -r scripts/verification-requirements.txt.",
            "playwright-node": "Run npm ci and npx playwright install --with-deps chromium.",
            "excel-python": "Run uv sync --frozen to install the locked Excel verification dependencies.",
            "chromium": "Run python -m playwright install --with-deps chromium.",
            "beui-dependencies": "Run npm ci --prefix docs/ui-exploration/ios-v3/ui.",
            "source": "Run from a complete RollieRank checkout.",
        }
    return report


def source_lock() -> dict:
    """Bind evidence to the verification contract and scenarios without relying on commit state."""
    paths = [
        ROOT / "AGENTS.md",
        ROOT / "README.md",
        ROOT / "package.json",
        ROOT / "test/miniprogram-layout.test.js",
        ROOT / "test/miniprogram-timer.test.js",
        ROOT / "mini-program/tools/build-timer.mjs",
        ROOT / "mini-program/tools/flow.mjs",
        ROOT / "mini-program/vendor/practice-timer.js",
        ROOT / "mini-program/utils/timing.js",
        ROOT / "mini-program/pages/home/home.js",
        ROOT / "mini-program/pages/practice/practice.js",
        *sorted((ROOT / "mini-program/components/rr-timer-sheet").glob("rr-timer-sheet.*")),
        ROOT / "test/miniprogram-web.test.js",
        ROOT / "mini-program/tools/build-shared.mjs",
        ROOT / "mini-program/pages/web/web.js",
        ROOT / "mini-program/pages/web/web.wxml",
        ROOT / "mini-program/pages/web/web.wxss",
        ROOT / "mini-program/pages/home/home.wxml",
        ROOT / "mini-program/pages/home/home.wxss",
        ROOT / "mini-program/templates/startup-card.wxml",
        ROOT / "mini-program/templates/startup-card.wxss",
        ROOT / "mini-program/pages/web-action/web-action.js",
        ROOT / "server/miniprogram-web.mjs",
        ROOT / "server/wechat-profile.mjs",
        ROOT / "test/wechat-profile.test.js",
        ROOT / "mini-program/config.js",
        ROOT / "mini-program/services/profile.js",
        *sorted((ROOT / "mini-program/pages/profile").glob("profile.*")),
        *sorted((ROOT / "mini-program/pages/settings").glob("settings.*")),
        *sorted((ROOT / "mini-program/components/rr-option-sheet").glob("rr-option-sheet.*")),
        ROOT / "docs/ui-exploration/ios-v3/wechat-webview.js",
        ROOT / "mini-program/app.js",
        ROOT / "mini-program/app.wxss",
        ROOT / "mini-program/tools/check.mjs",
        ROOT / "mini-program/utils/navigation.js",
        ROOT / "pyproject.toml",
        ROOT / "scripts/verify-rollierank.py",
        ROOT / "scripts/record-ios-preview.mjs",
        ROOT / "docs/ui-exploration/ios-v3/ui/refresh-preview-assets.mjs",
        ROOT / "docs/ui-exploration/ios-v3/motion/interaction-current.gif",
        ROOT / "docs/ui-exploration/ios-v3/motion/interaction-current.json",
        ROOT / "src/subjects.js",
        ROOT / "src/analytics.js",
        ROOT / "src/practice-timer.js",
        ROOT / "src/data/papers.js",
        ROOT / "src/data/imported-papers.js",
        ROOT / "scripts/import-papers.py",
        ROOT / "uv.lock",
        ROOT / "src/prototype-state.js",
        ROOT / "server/api.mjs",
        ROOT / "server/insights.mjs",
        ROOT / "docs/ui-exploration/ios-v3/app.js",
        ROOT / "docs/ui-exploration/ios-v3/app.html",
        ROOT / "docs/ui-exploration/ios-v3/vendor/beui.js",
        ROOT / "docs/ui-exploration/ios-v3/vendor/beui.css",
        ROOT / "data/booklet-time-limits.json",
        ROOT / "docs/ui-exploration/ios-v3/ui/home.tsx",
        ROOT / "docs/ui-exploration/ios-v3/ui/records.tsx",
        ROOT / "docs/ui-exploration/ios-v3/ui/catalog.tsx",
        ROOT / "docs/ui-exploration/ios-v3/ui/single-answer.tsx",
        ROOT / "docs/ui-exploration/ios-v3/features/single-answer.css",
        ROOT / "docs/ui-exploration/ios-v3/features/timer-configuration.css",
        ROOT / "docs/ui-exploration/ios-v3/preview-history.js",
        ROOT / "test/ios-preview-cleanup.test.js",
        ROOT / "test/preview-history-recovery.test.js",
        ROOT / "test/ios-discussion-links.test.js",
        ROOT / "docs/ui-exploration/ios-v3/assets/brand/rollierank-logo-transparent.png",
        ROOT / "docs/ui-exploration/ios-v3/ui/insights.tsx",
        ROOT / "docs/ui-exploration/ios-v3/features/insights.js",
        ROOT / "docs/ui-exploration/ios-v3/features/insights.css",
        ROOT / "docs/ui-exploration/ios-v3/ui/share-studio.tsx",
        ROOT / "docs/ui-exploration/ios-v3/features/sharing.css",
        ROOT / "docs/ui-exploration/ios-v3/ui/practice-session.tsx",
        ROOT / "docs/ui-exploration/ios-v3/ui/timer-paper-model.ts",
        ROOT / "docs/ui-exploration/ios-v3/features/practice-session.css",
        ROOT / "test/positions-insights.test.js",
        ROOT / "test/ios-insights-browser.test.js",
        ROOT / "test/practice-timer.test.js",
        ROOT / "test/timer-configuration.test.js",
        ROOT / "test/timer-paper-picker.test.js",
        ROOT / "test/booklet-time-limits.test.js",
        ROOT / "test/ios-practice-session-browser.test.js",
        ROOT / "test/ios-timer-entry-feedback-browser.test.js",
        ROOT / "test/ios-timer-latest-feedback-browser.test.js",
        ROOT / "test/ios-question-feedback-browser.test.js",
        ROOT / "src/features/corrections.js",
        ROOT / "docs/ui-exploration/ios-v3/features/corrections.js",
        ROOT / "docs/ui-exploration/ios-v3/features/correction-feedback.js",
        ROOT / "docs/ui-exploration/ios-v3/features/corrections.css",
        ROOT / "test/ios-share-modes.test.js",
        ROOT / "test/ios-sharing-browser.test.js",
        ROOT / "src/app.js",
        ROOT / "src/features/positions.js",
        ROOT / "server/positions.mjs",
        ROOT / "docs/ui-exploration/ios-v3/service-client.js",
        ROOT / "docs/ui-exploration/ios-v3/features/base.css",
        ROOT / "docs/ui-exploration/ios-v3/features/positions.js",
        ROOT / "docs/ui-exploration/ios-v3/ui/ranking.tsx",
        # Mobile analytics and discussions use the same reviewable source evidence as positions.
        ROOT / "docs/ui-exploration/ios-v3/ui/analytics.tsx",
        ROOT / "docs/ui-exploration/ios-v3/ui/results.tsx",
        ROOT / "docs/ui-exploration/ios-v3/ui/discussions.tsx",
        ROOT / "server/discussions.mjs",
        ROOT / "test/discussions-interactions.test.js",
        ROOT / "test/ios-discussions-interactions-browser.test.js",
        ROOT / "docs/ui-exploration/ios-v3/ui/components/motion/bottom-sheet.tsx",
        ROOT / "docs/ui-exploration/ios-v3/ui/package.json",
        ROOT / "docs/ui-exploration/ios-v3/ui/package-lock.json",
        ROOT / "docs/ui-exploration/ios-v3/ui/styles.css",
        ROOT / "docs/ui-exploration/ios-v3/features/analytics.js",
        ROOT / "docs/ui-exploration/ios-v3/features/analytics.css",
        ROOT / "docs/ui-exploration/ios-v3/features/discussions.js",
        ROOT / "docs/ui-exploration/ios-v3/features/discussions.css",
        ROOT / "test/ios-analytics-browser.test.js",
        ROOT / "test/ios-discussions.test.js",
        ROOT / "src/scrollbars.js",
        ROOT / "src/scrollbars.css",
        ROOT / "docs/ui-exploration/ios-v3/features/position-dialog.js",
        ROOT / "docs/ui-exploration/ios-v3/ui/position-picker.tsx",
        ROOT / "test/subjects.test.js",
        ROOT / "scripts/verify-prototype.py",
        ROOT / "scripts/verify-features.py",
        ROOT / "scripts/verify-ios-features.py",
        ROOT / "scripts/verification-requirements.txt",
        ROOT / "test/verification-cli.test.js",
        ROOT / ".agents/skills/verify-rollierank/SKILL.md",
        ROOT / ".agents/skills/verify-rollierank/scripts/verify.sh",
        ROOT / ".github/workflows/verification.yml",
        *sorted((ROOT / ".agents/skills/verify-rollierank/features").glob("*.md")),
    ]
    files = {}
    # New UI styles and test fixtures used to escape the hand-maintained list; bind all shipped runtime inputs too.
    runtime_paths = []
    for directory in (ROOT / "src", ROOT / "server", ROOT / "test"):
        runtime_paths.extend(path for path in directory.rglob("*") if path.is_file() and path.suffix in {".js", ".mjs", ".ts", ".css"})
    native = ROOT / "mini-program"
    runtime_paths.append(native / "app.json")
    for name in ("components", "pages"):
        runtime_paths.extend(path for path in (native / name).rglob("*")
                             if path.is_file() and path.suffix in {".js", ".json", ".wxml", ".wxss"})
    ios = ROOT / "docs/ui-exploration/ios-v3"
    runtime_paths.extend(path for path in ios.iterdir() if path.is_file() and path.suffix in {".js", ".css", ".html"})
    for directory in (ios / "features", ios / "ui"):
        runtime_paths.extend(path for path in directory.rglob("*") if path.is_file() and "node_modules" not in path.parts and path.suffix in {".js", ".mjs", ".ts", ".tsx", ".css"})
    for path in dict.fromkeys([*paths, *sorted(runtime_paths)]):
        relative = path.relative_to(ROOT).as_posix()
        files[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    digest = hashlib.sha256()
    for relative, value in files.items():
        digest.update(relative.encode() + b"\0" + value.encode() + b"\0")
    return {"sha256": digest.hexdigest(), "files": files}


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def request_json(base: str, path: str) -> tuple[int, object]:
    request = Request(base.rstrip("/") + "/api/" + path.lstrip("/"))
    try:
        with urlopen(request, timeout=10) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        return error.code, json.load(error)


def wait_ready(process: subprocess.Popen, base: str, deadline: float) -> dict:
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise VerificationError(f"Service exited before becoming usable (exit {process.returncode}); inspect server.log.")
        try:
            status, catalog = request_json(base, "catalog")
            if status == 200 and isinstance(catalog, dict) and catalog.get("versions"):
                status, hierarchy = request_json(base, "positions/hierarchy")
                if status == 200 and isinstance(hierarchy, dict) and hierarchy.get("level") == "source" and hierarchy.get("options"):
                    return {"catalogVersions": len(catalog["versions"]), "positionSources": len(hierarchy["options"])}
        except (OSError, URLError, ValueError, json.JSONDecodeError):
            pass
        time.sleep(0.1)
    raise VerificationError("Service did not reach a usable catalog and official position source within 30 seconds.")


def run_command(command: list[str], output: Path, label: str, env: dict | None = None, require_test_summary: bool = False) -> dict:
    output.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    with output.open("w") as log:
        result = subprocess.run(command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, text=True, check=False)
    evidence = {"label": label, "command": command, "exitCode": result.returncode, "durationMs": round((time.monotonic() - started) * 1000), "log": str(output)}
    if result.returncode:
        raise VerificationError(f"{label} failed (exit {result.returncode}); inspect {output}.")
    # A zero process exit can still contain skipped browser tests; those cannot certify the full gate.
    if require_test_summary:
        summary = {key: int(value) for key, value in re.findall(r"(?:#|ℹ)\s+(tests|pass|fail|cancelled|skipped|todo)\s+(\d+)", output.read_text())}
        evidence["testSummary"] = summary
        if summary.get("tests", 0) == 0 or any(summary.get(key, -1) != 0 for key in ("fail", "cancelled", "skipped", "todo")):
            raise VerificationError(f"{label} did not complete every test (summary {summary}); inspect {output}.")
    return evidence


def in_uv() -> bool:
    return sys.prefix != sys.base_prefix or bool(os.environ.get("VERIFY_IN_UV"))


def venv_python() -> Path:
    return ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def clean_venv_environment() -> dict:
    # A source launcher may inherit an unrelated active prefix; the project venv owns verification dependencies.
    environment = {key: value for key, value in os.environ.items() if key not in {"VIRTUAL_ENV", "PYTHONHOME", "CONDA_PREFIX"}}
    environment["PATH"] = os.pathsep.join(path for path in environment.get("PATH", "").split(os.pathsep) if "/.venv/" not in path)
    environment.update({"VERIFY_IN_UV": "1", "PYTHONNOUSERSITE": "1"})
    return environment


def reexec_in_venv() -> None:
    python = venv_python()
    if not python.is_file():
        raise VerificationError("Verification virtual environment is missing; run `uv sync --frozen --group verify`.")
    os.chdir(ROOT)
    os.execve(str(python), [str(python), *sys.argv], clean_venv_environment())


def ensure_python_runtime(scenario: str, timeout: int) -> None:
    required = scenario != "doctor"
    if not required or in_uv():
        return
    if not command_exists("uv"):
        raise VerificationError("Playwright-dependent verification needs uv; run doctor for remediation.")
    reexec_in_venv()


def visual_probe(base: str, output: Path) -> dict:
    from playwright.sync_api import sync_playwright
    shots = output / "visual"
    shots.mkdir(parents=True, exist_ok=True)
    pages = [("home", "home"), ("papers", "papers"), ("entry", "entry"), ("report", "report"), ("details", "details"), ("rank", "rank"), ("me", "me"), ("stats", "stats"), ("admin", "admin"), ("discussion", "discussion"), ("share", "share")]
    findings, captures, runtime_errors = [], [], []
    with sync_playwright() as playwright:
        # Headless Chromium paints native scrollbars only when the page leaves them visible.
        browser = playwright.chromium.launch(headless=True, ignore_default_args=["--hide-scrollbars"])
        page = browser.new_page(viewport={"width": 1440, "height": 1200}, reduced_motion="reduce")
        page.on("pageerror", lambda error: runtime_errors.append(str(error)))
        page.goto(base + "/ios-v3/?design=paper-cards-1114-v3&session=visual-verify", wait_until="networkidle")
        frame = page.frame_locator("#phone")
        body = page.frames[1].locator("body")
        # Fresh installs contain no fake history. Create a genuine receipt through the shipped answer UI.
        page.locator('.page-picker [data-page="entry"]').click()
        frame.locator('.view[data-page="entry"]').wait_for()
        frame.locator('.choice[data-option="A"]').evaluate_all("buttons => buttons.forEach(button => button.click())")
        frame.locator('[data-action="confirm"]').click()
        frame.get_by_role("button", name="先提交", exact=True).click()
        frame.locator('.view[data-page="report"] .rr3-score-card').wait_for()
        for page_id, label in pages:
            if page_id == "entry":
                page.locator('.page-picker [data-page="papers"]').click()
                frame.locator('.rr3-paper-cover.new .rr-card-hit').first.click()
            else:
                page.locator(f'.page-picker [data-page="{page_id}"]').click()
            frame.locator(f'.view[data-page="{page_id}"]').wait_for(timeout=20000)
            for width, height in [(1440, 900), (390, 844), (320, 568), (430, 932)]:
                if width > 430:
                    page.set_viewport_size({"width": width, "height": height})
                    target = page
                else:
                    # The gallery fits the phone to desktop height; keep enough room for the selected intrinsic width.
                    page.set_viewport_size({"width": 1440, "height": 1200})
                    page.locator("#size").select_option(f"{width},{height}")
                    target = page.locator("#phone")
                frame.locator("body").evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
                geometry = body.evaluate("""() => {
                  const visible=[...document.querySelectorAll('button,input,textarea,select,a')].filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0});
                  const small=visible.filter(el=>{const r=el.getBoundingClientRect();return (el.matches('button,a,input,textarea,select')&&(r.width<32||r.height<32))&&!el.classList.contains('sr-only')}).map(el=>({tag:el.tagName,name:el.getAttribute('aria-label')||el.textContent.trim().slice(0,50),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));
                  const clipped=el=>{for(let node=el.parentElement;node&&node!==document.body;node=node.parentElement){const s=getComputedStyle(node);if(['hidden','clip','auto','scroll'].includes(s.overflowX))return true}return false};
                  const overflow=[...document.querySelectorAll('#app *')].filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0&&el.scrollWidth>el.clientWidth+2&&s.overflowX==='visible'&&!clipped(el)}).slice(0,12).map(el=>({tag:el.tagName,className:String(el.className).slice(0,100)}));
                  const wrapping=[...document.querySelectorAll('.rr3-paper-score')].flatMap(el=>{const unit=el.querySelector('small');if(!unit||!el.firstChild)return [];const range=document.createRange();range.selectNode(el.firstChild);const number=range.getBoundingClientRect(),u=unit.getBoundingClientRect();return u.top>=number.bottom-1||u.left<number.right-1?[{kind:'score-unit-wrap',text:el.textContent}]:[]});
                  const visualScrollbars=[...document.querySelectorAll('*')].filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1)&&[s.overflowY,s.overflowX].some(value=>['auto','scroll'].includes(value))}).map(el=>getComputedStyle(el).scrollbarWidth).filter(value=>value!=='none');
                  return {innerWidth,scrollWidth:document.documentElement.scrollWidth,font:getComputedStyle(document.body).fontFamily,bodyColor:getComputedStyle(document.body).color,sheetScrollbar:getComputedStyle(document.body,'::-webkit-scrollbar').width,visualScrollbars,small,overflow,wrapping};
                }""")
                if geometry["scrollWidth"] > geometry["innerWidth"] + 1:
                    findings.append({"page": page_id, "viewport": width, "kind": "horizontal-overflow", "geometry": geometry})
                if geometry["small"]:
                    findings.append({"page": page_id, "viewport": width, "kind": "small-controls", "controls": geometry["small"]})
                if geometry["wrapping"]:
                    findings.append({"page": page_id, "viewport": width, "kind": "score-unit-wrap", "controls": geometry["wrapping"]})
                if geometry["overflow"]:
                    findings.append({"page": page_id, "viewport": width, "kind": "visible-overflowing-boxes", "elements": geometry["overflow"]})
                if geometry["visualScrollbars"]:
                    findings.append({"page": page_id, "viewport": width, "kind": "visible-scrollbar", "values": geometry["visualScrollbars"]})
                image = shots / f"{label}-{width}.png"
                if width > 430:
                    target.screenshot(path=str(image), full_page=True)
                else:
                    # Capture the iframe body directly; outer-gallery fitting must not shrink visual evidence.
                    body.screenshot(path=str(image))
                captures.append(str(image))
        theme = body.evaluate("""() => ({background:getComputedStyle(document.querySelector('#app')).backgroundColor,font:getComputedStyle(document.body).fontFamily,scrollbar:getComputedStyle(document.body,'::-webkit-scrollbar').width})""")
        assert theme["scrollbar"] == "0px", theme
        browser.close()
    result = {"passed": not findings and not runtime_errors, "theme": theme, "findings": findings, "runtimeErrors": runtime_errors, "screenshots": captures}
    (output / "visual-results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    if not result["passed"]:
        raise VerificationError("Visual probe found layout, target-size, overflow or runtime problems; inspect visual-results.json and retained screenshots.")
    return result


def run_visual(base: str, output: Path) -> dict:
    result = visual_probe(base, output)
    return {"checks": ["real iOS pages at four viewports without overflow, undersized controls or runtime errors", "theme fonts remain and all visual scrollbars are hidden"], "visual": result}


def run_journeys(output: Path) -> dict:
    journeys = output / "journeys"
    journeys.mkdir(parents=True, exist_ok=True)
    python = sys.executable
    env = dict(os.environ, ROLLIERANK_BROWSER_PYTHON=python, ROLLIERANK_BROWSER_TEST="1", POSITIONS_PYTHON=os.environ.get("POSITIONS_PYTHON") or sys.executable, ROLLIERANK_CORRECTIONS_OUTPUT=str(journeys / "corrections"))
    commands = [
        run_command([python, "scripts/verify-prototype.py", "--output", str(journeys / "prototype")], journeys / "prototype.log", "base-app-user-journey"),
        run_command([python, "scripts/verify-features.py", "--output", str(journeys / "features")], journeys / "features.log", "connected-feature-journey"),
        run_command([python, "scripts/verify-ios-features.py", "--output", str(journeys / "mobile")], journeys / "mobile.log", "mobile-user-journey"),
        run_command([python, "scripts/verify-ios-features.py", "--wechat-host", "--output", str(journeys / "wechat")], journeys / "wechat.log", "wechat-hosted-ui-journey"),
    ]
    try:
        commands.append(run_command(["npm", "test"], journeys / "unit-and-service.log", "unit-and-service-suite", env, require_test_summary=True))
    finally:
        # Browser tests own isolated servers; retain their original screenshots even when a test fails in CI.
        for source, name in [
            (ROOT / "test-results/insights-browser", "insights-browser"),
            (ROOT / "test-results/practice-session", "practice-session"),
            (ROOT / "test-results/sharing-browser", "sharing-browser"),
            (ROOT / ".beauye/tasks/share-four-modes/evidence", "share-modes"),
            (ROOT / ".beauye/tasks/ios-analytics-refinement/evidence", "analytics-panels"),
            (ROOT / "test-results/discussion-interactions", "discussion-interactions"),
            (ROOT / "test-results/feedback-reaudit", "feedback-reaudit"),
        ]:
            if source.is_dir():
                shutil.copytree(source, journeys / name, dirs_exist_ok=True)
    return {"checks": [item["label"] for item in commands], "commands": commands}


def run_all(output: Path) -> dict:
    report = doctor()
    (output / "doctor.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    if not report["ok"]:
        raise VerificationError("Doctor failed; run `npm run verify -- doctor` for exact setup steps.")
    build = [
        run_command(["npm", "run", "build"], output / "build.log", "browser-build"),
        run_command(["npm", "--prefix", "mini-program", "run", "check"], output / "miniprogram-check.log", "miniprogram-check"),
        run_command(["npm", "--prefix", "docs/ui-exploration/ios-v3/ui", "run", "typecheck"], output / "typecheck.log", "mobile-types"),
        run_command(["npm", "--prefix", "docs/ui-exploration/ios-v3/ui", "run", "build"], output / "mobile-build.log", "mobile-components"),
        run_command(["npm", "--prefix", "docs/ui-exploration/ios-v3/ui", "run", "test:bridge"], output / "bridge.log", "mobile-bridge", require_test_summary=True),
        run_command(["npm", "--prefix", "docs/ui-exploration/ios-v3/ui", "run", "test:ui-data"], output / "ui-data.log", "mobile-data", require_test_summary=True),
        run_command(["npm", "--prefix", "docs/ui-exploration/ios-v3/ui", "run", "test:practice"], output / "practice-model.log", "mobile-practice-model", require_test_summary=True),
    ]
    with tempfile.TemporaryDirectory(prefix="rollierank-verify-") as directory:
        port = free_port()
        base = f"http://127.0.0.1:{port}"
        env = dict(os.environ, PORT=str(port), ROLLIERANK_DATA_DIR=directory, ROLLIERANK_REVIEW_TOKEN="verify-isolated-review-token", POSITIONS_PYTHON=os.environ.get("POSITIONS_PYTHON") or sys.executable)
        log = output / "visual-server.log"
        with log.open("w") as stream:
            process = subprocess.Popen([shutil.which("node") or "node", "scripts/serve.mjs"], cwd=ROOT, env=env, stdout=stream, stderr=subprocess.STDOUT)
            try:
                ready = wait_ready(process, base, time.monotonic() + 30)
                visual = run_visual(base, output)
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
    journeys = run_journeys(output)
    return {"checks": ["doctor", "build", "isolated-real-server", "visual"] + journeys["checks"], "doctor": report, "build": build, "server": ready, "visual": visual["visual"], "journeys": journeys}


def run_unit(scenario: str, output: Path) -> dict:
    paths = SCENARIOS[scenario]
    log = output / f"{scenario}.log"
    env = dict(os.environ, ROLLIERANK_BROWSER_PYTHON=sys.executable, ROLLIERANK_BROWSER_TEST="1", POSITIONS_PYTHON=os.environ.get("POSITIONS_PYTHON") or sys.executable)
    result = run_command(["node", "--test", *paths], log, scenario, env, require_test_summary=True)
    web_host = ["--wechat-host"] if scenario == "miniprogram-ui" else []
    live = run_command([sys.executable, "scripts/verify-ios-features.py", *web_host, "--output", str(output / f"{scenario}-live")], output / f"{scenario}-live.log", f"{scenario}-live-user-journey", env)
    commands = [result, live]
    # Catalog administration and backup/claim flows exist on the foundation surface too.
    if scenario in {"core", "catalog-admin", "practice-history", "sharing"}:
        commands.append(run_command([sys.executable, "scripts/verify-prototype.py", "--output", str(output / f"{scenario}-foundation")], output / f"{scenario}-foundation.log", f"{scenario}-foundation-user-journey", env))
    if scenario in {"core", "positions-rank", "discussion", "analytics", "corrections", "sharing"}:
        commands.append(run_command([sys.executable, "scripts/verify-features.py", "--output", str(output / f"{scenario}-connected")], output / f"{scenario}-connected.log", f"{scenario}-connected-user-journey", env))
    return {"checks": [item["label"] for item in commands], "commands": commands}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    scenarios = ["all", *SCENARIOS, "journeys", "visual", "doctor", "feature"]
    parser.add_argument("scenario", choices=scenarios, nargs="?", default="all")
    parser.add_argument("feature", nargs="?", help="Feature-map id used with the `feature` scenario.")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--timeout", type=int, default=1800)
    args = parser.parse_args()
    output = (args.output or Path(os.environ.get("VERIFY_OUTPUT", DEFAULT_OUTPUT))).resolve()
    output.mkdir(parents=True, exist_ok=True)
    try:
        if args.scenario == "doctor" and not in_uv() and venv_python().is_file():
            reexec_in_venv()
        if args.scenario == "doctor":
            result = doctor()
            (output / "doctor.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
            print(json.dumps(result, ensure_ascii=False))
            return 0 if result["ok"] else 1
        wrapped = ensure_python_runtime(args.scenario, args.timeout)
        if args.scenario == "feature":
            if args.feature not in SCENARIOS:
                raise VerificationError(f"Unknown feature {args.feature!r}; choose one listed in .agents/skills/verify-rollierank/features/README.md.")
            args.scenario = args.feature
        started = time.monotonic()
        if args.scenario == "all":
            result = run_all(output)
        elif args.scenario == "journeys":
            result = run_journeys(output)
        elif args.scenario == "visual":
            report = doctor()
            if not report["ok"]:
                raise VerificationError("Doctor failed; run `npm run verify -- doctor` for exact setup steps.")
            with tempfile.TemporaryDirectory(prefix="rollierank-verify-visual-") as directory:
                port = free_port(); base = f"http://127.0.0.1:{port}"
                env = dict(os.environ, PORT=str(port), ROLLIERANK_DATA_DIR=directory)
                with (output / "visual-server.log").open("w") as log:
                    process = subprocess.Popen([shutil.which("node") or "node", "scripts/serve.mjs"], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
                    try:
                        server = wait_ready(process, base, time.monotonic() + 30); result = run_visual(base, output); result["server"] = server
                    finally:
                        process.terminate(); process.wait(timeout=10)
        else:
            result = run_unit(args.scenario, output)
        result.update({"scenario": args.scenario, "durationSeconds": round(time.monotonic() - started, 1), "startedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "doctor": result.get("doctor", doctor())})
        result["sourceLock"] = source_lock()
        (output / "results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2, default=str) + "\n")
        (output / "source-lock.json").write_text(json.dumps(result["sourceLock"], ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({"passed": len(result["checks"]), "scenario": args.scenario, "results": str(output / "results.json")}, ensure_ascii=False))
        return 0
    except VerificationError as error:
        failure = {"scenario": args.scenario, "ok": False, "error": str(error), "output": str(output)}
        (output / "results.json").write_text(json.dumps(failure, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps(failure, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
