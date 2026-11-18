"""Verify RollieRank user journeys against an isolated real Node service and Chromium."""

import argparse
from io import BytesIO
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import struct
import tempfile
import time
import wave
import zlib
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from playwright.sync_api import sync_playwright, expect


ROOT = Path(__file__).resolve().parent.parent
TEST_REVIEW_TOKEN = "review-for-isolated-feature-verification"


def api(base, path, data=None):
    body = json.dumps(data, ensure_ascii=False).encode() if data is not None else None
    headers = {"Content-Type": "application/json"} if body else {}
    # Test fixture creation uses the same authenticated admin endpoint as the deployed app.
    if path.startswith("admin/"):
        headers["Authorization"] = f"Bearer {TEST_REVIEW_TOKEN}"
    request = Request(base + "/api/" + path, data=body, headers=headers)
    try:
        with urlopen(request, timeout=30) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        return error.code, json.load(error)


def import_paper(base, title, institution="联调甲", csv=None):
    status, version = api(base, "admin/import", {
        "title": title, "institution": institution, "project": "隔离回归",
        "period": "一期", "variant": "通用",
        "csv": csv or "题号,题型,答案,分值\n1,言语理解,A,1\n2,言语理解,B,1\n3,资料分析,C,2\n4,资料分析,D,2",
    })
    assert status == 200, version
    status, published = api(base, "admin/status", {"versionId": version["id"], "status": "published"})
    assert status == 200, published
    return published


def check_width(page, width):
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), \
        f"Horizontal overflow at {width}px: {page.url}"


def capture(page, output, name, widths=(1440, 1280, 390)):
    captures = []
    if page.locator("#toast").count():
        page.locator("#toast").wait_for(state="hidden", timeout=5000)
    for width in widths:
        page.set_viewport_size({"width": width, "height": 844 if width < 700 else 800 if width == 1280 else 900})
        page.evaluate("window.scrollTo({top: 0, behavior: 'instant'})")
        check_width(page, width)
        path = output / f"{name}-{width}.png"
        page.screenshot(path=str(path), full_page=True, animations="disabled")
        captures.append(str(path))
    page.set_viewport_size({"width": 1440, "height": 900})
    return captures


def png_bytes():
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 40, 20, 8, 2, 0, 0, 0)) + \
        chunk(b"IDAT", zlib.compress((b"\0" + b"\x95\x72\xaf" * 40) * 20)) + chunk(b"IEND", b"")


def wav_bytes():
    buffer = BytesIO()
    with wave.open(buffer, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        audio.writeframes(b"\0\0" * 8000)
    return buffer.getvalue()


def local_state(page):
    return page.evaluate("JSON.parse(localStorage.getItem('rollierank:prototype:v2')) ?? {attempts: []}")


def submit_paper(page, base, version, answers, participate=False, expect_prompt=False):
    page.goto(base + "#/practice/" + quote(version["id"], safe=""), wait_until="networkidle")
    for number, answer in enumerate(answers, start=1):
        page.locator('.answer-sheet [data-action="question"][data-question="%d"]' % number).click()
        page.get_by_role("button", name="选择 " + answer, exact=True).click()
    page.locator('[data-action="confirm-submit"]').click()
    expect(page.locator("#participate-submit")).to_have_count(0)
    page.locator("#submit-attempt").click()
    if expect_prompt:
        expect(page.locator('[data-position-action="skip-submit"]')).to_be_visible()
        try:
            page.locator('[data-position-action="skip-submit"]').click(timeout=8000)
        except Exception:
            page.screenshot(path=str(ROOT / "test-results/skip-submit-failure.png"), full_page=True)
            print(page.locator('[data-position-action="skip-submit"]').evaluate("""async element => {
              const samples=[];for(let i=0;i<8;i++){await new Promise(resolve=>requestAnimationFrame(resolve));samples.push({button:element.getBoundingClientRect().toJSON(),modal:element.closest('dialog').getBoundingClientRect().toJSON(),animations:element.getAnimations().map(animation=>({state:animation.playState,timing:animation.effect.getTiming()}))})}return samples
            }"""))
            raise
    expect(page.locator(".score-number")).to_be_visible(timeout=20000)
    page.wait_for_load_state("networkidle")
    return local_state(page)["attempts"][0]


def run(base, output):
    checks, artifacts, errors = [], [], []
    paper = import_paper(base, "四题复盘卷")
    peer_paper = import_paper(base, "另一机构同规则卷", "联调乙")
    different_paper = import_paper(base, "不同权重卷", "联调乙",
        "题号,题型,答案,分值\n1,言语理解,A,2\n2,言语理解,B,1\n3,资料分析,C,2\n4,资料分析,D,2")
    route_id = quote(paper["id"], safe="")
    with sync_playwright() as playwright:
        # Keep native scrollbars visible so full-page captures prove their actual theme and dimensions.
        browser = playwright.chromium.launch(headless=True, ignore_default_args=["--hide-scrollbars"])
        context = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        page = context.new_page()
        # Authorize the isolated page's catalog management request. The correction form still verifies its own credential.
        page.route(base + "/api/admin", lambda route: route.continue_(
            headers={**route.request.headers, "Authorization": f"Bearer {TEST_REVIEW_TOKEN}"}))
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(base, wait_until="networkidle")
        expect(page.locator(".paper-card")).to_have_count(12)
        page.locator("#paper-search").fill("不存在的联调套卷")
        expect(page.locator(".paper-card")).to_have_count(0)
        page.locator("#paper-search").fill("")
        artifacts += capture(page, output, "home", (1440, 1280, 390, 320))
        checks.append("existing catalog search and responsive home")

        page.locator('[data-action="sample"]').click()
        expect(page.locator(".score-number")).to_be_visible()
        expect(page.locator(".report-bottom")).to_contain_text("示例作答不计入个人练习记录")
        expect(page.locator('[data-correction-action="feedback"]')).to_be_disabled()
        expect(page.locator("form[data-discussions-form]")).to_have_count(0)
        assert len(local_state(page)["attempts"]) == 0
        checks.append("existing sample report stays outside actual attempts, feedback and discussion")

        page.goto(base + "#/paper/" + route_id, wait_until="networkidle")
        expect(page.locator("h1")).to_contain_text("四题复盘卷")
        artifacts += capture(page, output, "paper")
        page.goto(base + "#/practice/" + route_id, wait_until="networkidle")
        page.get_by_role("button", name="选择 A", exact=True).click()
        page.reload(wait_until="networkidle")
        expect(page.locator(".practice-progress")).to_contain_text("1 / 4")
        artifacts += capture(page, output, "practice")
        checks.append("existing keyboard-ready answer entry and persistent independent draft")

        page.goto(base + "#/me", wait_until="networkidle")
        page.locator('.profile-card [data-action="login"]').click()
        page.locator("#profile-name").fill("联调考生甲")
        page.locator('#login-form button[type="submit"]').click()
        expect(page.locator(".profile-details h2")).to_contain_text("联调考生甲")
        first = submit_paper(page, base, paper, "ABDB", True, True)
        assert first["report"]["totalCents"] == 200
        guest_id = local_state(page)["guestId"]
        profile = api(base, "positions/profile?guestId=" + guest_id)[1]
        assert first["id"] in profile["participation"]["attemptIds"]
        checks.append("real submission prompts for missing job and automatically ranks the receipt after explicit skip")

        page.goto(base + "#/me", wait_until="networkidle")
        page.locator('[data-feature="positions-profile"] [data-position-action="choose"]').click()
        picker = page.locator('[data-position-action="pick-position"]').first
        expect(picker).to_be_visible()
        selected_job = picker.get_attribute("data-position-id")
        picker.click()
        expect(page.locator(".positions-job-title")).to_be_visible()
        page.reload(wait_until="networkidle")
        assert api(base, "positions/profile?guestId=" + guest_id)[1]["positionId"] == selected_job
        artifacts += capture(page, output, "me")
        checks.append("job selection persists through the shared app and reload")

        second = submit_paper(page, base, paper, "BBCB", True)
        assert second["report"]["totalCents"] == 300
        expect(page.locator(".analytics-comparison")).to_be_visible()
        expect(page.locator(".analytics-vs-metric").first.locator(".analytics-change")).to_have_text("进步 1 分")
        comparison_capture = output / "second-practice-vs.png"
        page.locator("#toast").wait_for(state="hidden", timeout=5000)
        page.locator(".analytics-comparison").screenshot(path=str(comparison_capture))
        artifacts.append(str(comparison_capture))
        third = submit_paper(page, base, paper, "ABCD", False)
        assert third["report"]["totalCents"] == 600
        expect(page.locator(".analytics-report [data-analytics-chart]")).to_be_visible()
        checks.append("second practice shows VS and third practice shows a real multi-attempt chart")

        peer = submit_paper(page, base, peer_paper, "ABCD")
        different = submit_paper(page, base, different_paper, "ABCD")
        page.goto(base + "#/stats", wait_until="networkidle")
        expect(page.locator("h1")).to_have_text("成长分析")
        expect(page.locator('[data-analytics-control="ruleSignature"]')).to_have_count(0)
        category = f'custom-{len(first["report"]["rows"])}-{first["report"]["maxCents"]}'
        other_format = f'custom-{len(different["report"]["rows"])}-{different["report"]["maxCents"]}'
        expect(page.locator(f'[data-analytics-control="examCategory"] option[value="{category}"]')).to_contain_text("4 次")
        expect(page.locator(f'[data-analytics-control="examCategory"] option[value="{other_format}"]')).to_contain_text("1 次")
        page.locator('[data-analytics-control="examCategory"]').select_option(category)
        type_select = page.locator('[data-analytics-control="dimension"]')
        type_select.select_option(label="资料分析")
        expect(page.locator(".analytics-table:visible")).to_contain_text("另一机构同规则卷")
        artifacts += capture(page, output, "stats")
        checks.append("a single category selector groups publishers while genuinely different custom full-mark formats remain separate; type values use each report")

        page.goto(base + "#/report/" + first["id"], wait_until="networkidle")
        expect(page.locator("#discussions-nickname")).to_have_value("联调考生甲")
        message = '<img src=x onerror="window.__featureXss=1"> 这套卷的资料分析值得复盘。'
        page.locator("#discussions-text").fill(message)
        page.locator(".discussions-links-editor summary").click()
        page.locator("#discussions-links").fill("https://example.com/study?question=4")
        page.locator('[data-discussions-file="images"]').set_input_files({"name": "笔记.png", "mimeType": "image/png", "buffer": png_bytes()})
        expect(page.locator(".discussions-draft-image")).to_have_count(1)
        page.locator('[data-discussions-file="audio"]').set_input_files({"name": "复盘.wav", "mimeType": "audio/wav", "buffer": wav_bytes()})
        expect(page.locator(".discussions-draft-audio")).to_be_visible()
        page.route("**/api/discussions", lambda route: route.abort())
        page.locator('form[data-discussions-form] button[type="submit"]').click()
        expect(page.locator(".discussions-error")).to_be_visible()
        expect(page.locator("#discussions-text")).to_have_value(message)
        expect(page.locator(".discussions-draft-image")).to_have_count(1)
        page.unroute("**/api/discussions")
        page.locator('form[data-discussions-form] button[type="submit"]').click()
        expect(page.locator(".discussions-comment")).to_have_count(1)
        page.reload(wait_until="networkidle")
        expect(page.locator(".discussions-comment")).to_contain_text(message)
        expect(page.locator(".discussions-comment audio")).to_have_count(1)
        assert page.locator(".discussions-comment img").evaluate("img => img.complete && img.naturalWidth > 0")
        assert not page.evaluate("Boolean(window.__featureXss)")
        page.locator(".discussions-comment audio").evaluate("async audio => { await audio.play(); audio.pause(); }")
        checks.append("result discussion publishes text, image, audio and URL; failed requests retain edits; reload restores safe content and avatars")

        with page.expect_download() as csv_download:
            page.locator('[data-action="export-csv"]').click()
        csv_path = output / "answer-comparison.csv"
        csv_download.value.save_as(csv_path)
        assert len(csv_path.read_text(encoding="utf-8-sig").strip().splitlines()) == 5
        page.locator('[data-action="poster"]').click()
        expect(page.locator("#poster-canvas")).to_be_visible()
        poster_bytes = []
        for style in ("score", "grid", "answers"):
            page.locator(f'[data-action="poster-style"][data-value="{style}"]').click()
            with page.expect_download() as poster_download:
                page.locator('[data-action="save-poster"]').click()
            poster_path = output / f"poster-{style}.png"
            poster_download.value.save_as(poster_path)
            content = poster_path.read_bytes()
            assert content.startswith(b"\x89PNG\r\n\x1a\n") and len(content) > 2000
            poster_bytes.append(content)
        assert len(set(poster_bytes)) == 3
        page.locator('#modal [data-action="close-modal"]').click()
        checks.append("existing CSV export and three distinct PNG poster styles still produce real downloadable files")

        page.evaluate("""() => {
          navigator.mediaDevices.getUserMedia = async () => {
            const audio = new AudioContext();
            const destination = audio.createMediaStreamDestination();
            const oscillator = audio.createOscillator();
            oscillator.connect(destination); oscillator.start();
            window.__featureRecording = { audio, oscillator, stream: destination.stream };
            return destination.stream;
          };
        }""")
        page.locator('[data-discussions-action="record"]').click()
        expect(page.locator('[data-discussions-action="stop-recording"]')).to_be_visible()
        page.route("**/api/**", lambda route: route.abort())
        page.evaluate("location.hash = '#/me'")
        page.wait_for_function("window.__featureRecording.stream.getTracks().every(track => track.readyState === 'ended')")
        page.evaluate("window.__featureRecording.oscillator.stop(); window.__featureRecording.audio.close()")
        page.unroute("**/api/**")
        page.goto(base + "#/report/" + first["id"], wait_until="networkidle")
        expect(page.locator(".discussions-comment")).to_have_count(1)
        checks.append("leaving the result releases active native recording tracks even when score synchronization fails")

        for question in (1, 4):
            if question == 1:
                page.locator('[data-correction-action="feedback"]').click()
            else:
                page.locator('[data-correction-action="add-row"]').click()
            row = page.locator("[data-correction-row]").last
            row.locator('[name="question"]').fill(str(question))
            row.locator('[name="suggestedAnswer"]').select_option("B")
            row.locator('[name="evidence"]').fill(f"隔离回归样例：第 {question} 题核对后建议为 B。")
        page.locator('button[form="correction-feedback-form"]').click()
        page.locator('[data-correction-action="preview"]').click()
        expect(page.locator("[data-correction-preview]")).to_contain_text("试算")
        assert api(base, "attempts/sync", {"guestId": guest_id, "attemptIds": [first["id"]]})[1]["attempts"][0]["report"]["totalCents"] == 200
        page.locator('[data-correction-action="close"]').click()
        expect(page.locator('[data-feature="corrections-report"] [data-correction-action="feedback"]')).to_be_focused()
        artifacts += capture(page, output, "report")
        page.goto(base + "#/details/" + first["id"], wait_until="networkidle")
        artifacts += capture(page, output, "details")
        checks.append("multi-question feedback persists and hypothetical regrading leaves the official score unchanged")

        other_guest = "guest-integrated-second-1234"
        status, other_attempt = api(base, "submit", {"guestId": other_guest, "attemptId": "attempt-integrated-second-1234", "versionId": paper["id"], "answers": list("ABCD")})
        assert status == 200, other_attempt
        assert api(base, "positions/selection", {"guestId": other_guest, "positionId": selected_job})[0] == 200
        assert api(base, "positions/participation", {"guestId": other_guest, "name": "联调考生乙", "attemptIds": [other_attempt["id"]]})[0] == 200
        page.goto(base + "#/rank/" + route_id, wait_until="networkidle")
        expect(page.locator(".positions-board-row")).to_have_count(2)
        expect(page.locator(".positions-self-rank")).to_contain_text("1")
        page.locator('[data-position-action="scope-nationwide"]').click()
        expect(page.locator(".positions-board-meta")).to_contain_text("全国")
        page.locator('[data-position-action="browse"]').click()
        browse_buttons = page.locator('[data-position-action="pick-position"]')
        expect(browse_buttons.first).to_be_visible()
        browse_buttons.nth(1).click()
        expect(page.locator(".positions-board-row")).to_have_count(0)
        assert api(base, "positions/profile?guestId=" + guest_id)[1]["positionId"] == selected_job
        page.locator('[data-position-action="scope-selected"]').click()
        expect(page.locator(".positions-board-row")).to_have_count(2)
        artifacts += capture(page, output, "rank")
        checks.append("selected job, nationwide and arbitrary job scopes use actual users without changing the personal selection")

        page.goto(base + "#/admin", wait_until="networkidle")
        expect(page.locator(".correction-count")).to_contain_text("1 待审核")
        page.locator('[data-correction-action="unlock"]').click()
        page.locator('[name="reviewToken"]').fill("incorrect-test-credential")
        page.locator('button[form="correction-credential-form"]').click()
        expect(page.locator("[data-correction-modal-error]")).to_contain_text("凭证")
        page.locator('[name="reviewToken"]').fill(TEST_REVIEW_TOKEN)
        page.locator('button[form="correction-credential-form"]').click()
        page.locator('[data-correction-action="review"]').click()
        expect(page.locator('input[name="questionNumbers"]')).to_have_count(2)
        page.locator('textarea[name="reason"]').fill("隔离回归审核：确认两道样例题答案，按统一标准重新计分。")
        page.locator('button[form="correction-review-form"]').click()
        expect(page.locator("#modal-title")).to_have_text("确认订正并重算")
        assert page.evaluate("document.getElementById('modal').contains(document.activeElement)")
        page.locator('[data-correction-action="confirm-review"]').click()
        expect(page.locator("#modal")).not_to_be_visible()
        page.wait_for_function("document.getElementById('main').contains(document.activeElement) || document.activeElement.id === 'main'")
        expect(page.locator(".correction-count")).to_contain_text("0 待审核")
        artifacts += capture(page, output, "admin")
        checks.append("review reminder and server credential checks work; two-question approval updates the standard atomically")

        page.goto(base + "#/report/" + first["id"], wait_until="networkidle")
        first_updated = next(a for a in local_state(page)["attempts"] if a["id"] == first["id"])
        assert first_updated["answerRevision"] == 1
        assert first_updated["report"]["totalCents"] == 300
        assert first_updated["answers"] == first["answers"] and first_updated["createdAt"] == first["createdAt"]
        assert len(first_updated["correctionHistory"]) == 1
        expect(page.locator('[data-feature="corrections-report"]')).to_contain_text("标准答案已订正")
        page.goto(base + "#/rank/" + route_id, wait_until="networkidle")
        expect(page.locator(".positions-self-rank")).to_contain_text("1")
        expect(page.locator(".positions-self-value")).to_contain_text("6")
        page.goto(base + "#/stats/" + route_id, wait_until="networkidle")
        expect(page.locator(".analytics-table:visible")).to_contain_text("100%")
        future = submit_paper(page, base, paper, "BBCB")
        assert future["answerRevision"] == 1 and future["report"]["totalCents"] == 600
        page.reload(wait_until="networkidle")
        assert local_state(page)["attempts"][0]["answerRevision"] == 1
        checks.append("approval synchronizes old reports, notification, VS/trend and rank; later submissions use the new standard")

        page.goto(base + "#/me", wait_until="networkidle")
        with page.expect_download() as download:
            page.locator('[data-action="export-data"]').click()
        backup_path = output / "practice-backup.json"
        download.value.save_as(backup_path)
        backup = json.loads(backup_path.read_text())
        assert len(backup["attempts"]) == 6
        page.locator('[data-action="restore-data"]').click()
        page.locator("#restore-file").set_input_files(str(backup_path))
        expect(page.locator("#restore-confirm")).to_be_enabled()
        page.locator("#restore-confirm").click()
        expect(page.locator("#modal")).not_to_be_visible()
        expect(page.locator(".history-row")).to_have_count(6)
        assert len(next(a for a in local_state(page)["attempts"] if a["id"] == first["id"])["correctionHistory"]) == 1
        artifacts += capture(page, output, "me-corrected", (1440, 1280, 390, 320))
        checks.append("existing JSON backup and restore preserve corrected scores and associated metadata")
        browser.close()
    assert not errors, errors
    return {"checks": checks, "artifacts": artifacts, "consoleErrors": errors,
            "fixtures": {"paper": paper["id"], "peerPaper": peer_paper["id"],
                         "differentPaper": different_paper["id"]}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "test-results/features")
    parser.add_argument("--dist", action="store_true", help="Serve the built browser assets")
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js is required for browser verification")
    with tempfile.TemporaryDirectory(prefix="rollierank-feature-qa-") as data_directory:
        with socket.socket() as port_socket:
            port_socket.bind(("127.0.0.1", 0))
            port = port_socket.getsockname()[1]
        base = f"http://127.0.0.1:{port}"
        env = dict(os.environ, PORT=str(port), ROLLIERANK_DATA_DIR=data_directory,
                   ROLLIERANK_REVIEW_TOKEN=TEST_REVIEW_TOKEN)
        command = [node, "scripts/serve.mjs"] + (["--dist"] if args.dist else [])
        with (output / "server.log").open("w") as log:
            process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=log)
            try:
                deadline = time.monotonic() + 30
                while True:
                    if process.poll() is not None:
                        raise RuntimeError("Isolated service failed to start; inspect server.log")
                    try:
                        api(base, "catalog")
                        break
                    except (URLError, ConnectionError):
                        if time.monotonic() > deadline:
                            raise
                        time.sleep(0.05)
                results = run(base, output)
                results["runtime"] = {"base": base, "dist": args.dist,
                                      "data": "temporary isolated catalog"}
                (output / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
                print(json.dumps({"passed": len(results["checks"]), "results": str(output / "results.json")}, ensure_ascii=False))
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


if __name__ == "__main__":
    main()
