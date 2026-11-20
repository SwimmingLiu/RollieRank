"""Drive the real prototype in Chromium using an isolated local service and data directory."""
import argparse
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.request import urlopen

from playwright.sync_api import sync_playwright, expect


ROOT = Path(__file__).resolve().parent.parent


def check_width(page, width):
    # Hidden native scrollbars reserve no gutter; content may be narrower, never wider than the viewport.
    if page.evaluate('document.documentElement.scrollWidth') > width:
        page.screenshot(path=str(ROOT / 'test-results' / f'overflow-{width}.png'), full_page=True)
        print(page.evaluate('''() => [...document.querySelectorAll('body *')].map(el => ({tag: el.tagName, class: el.className?.toString(), right: el.getBoundingClientRect().right, text: el.textContent.slice(0,70)})).filter(el => el.right > innerWidth + 1).slice(0,15)'''))
    assert page.evaluate('document.documentElement.scrollWidth') <= width, f'Horizontal overflow at {width}px: {page.url}'


def settled_screenshot(page, path, **options):
    # Transient success toasts obscure controls in full-page review evidence.
    if page.locator('#toast').count():
        page.locator('#toast').wait_for(state='hidden', timeout=5000)
    page.screenshot(path=path, **options)


def run(base, output):
    output.mkdir(exist_ok=True, parents=True)
    checks = []
    errors = []
    with sync_playwright() as p:
        # Keep browser scrollbars unmasked so the hidden contract is truthful.
        browser = p.chromium.launch(headless=True, ignore_default_args=["--hide-scrollbars"])
        context = browser.new_context(viewport={'width': 1440, 'height': 1024}, reduced_motion='reduce')
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base, wait_until='networkidle')
        # The default period owns the visible card subset; compare filter transitions to this rendered state.
        cards = page.locator('.paper-card')
        expect(cards.first).to_be_visible()
        initial_count = cards.count()
        assert initial_count > 0
        settled_screenshot(page, str(output / 'home-desktop.png'), full_page=True)
        for width in [320, 390, 768, 1024, 1440]:
            page.set_viewport_size({'width': width, 'height': 844 if width < 761 else 1024})
            check_width(page, width)
        page.set_viewport_size({'width': 1440, 'height': 1024})
        page.locator('[data-action="institution"][data-value="花生十三"]').click()
        expect(page.get_by_text('这里还没有套卷')).to_be_visible()
        page.locator('[data-action="reset-filters"]').click()
        page.locator('#paper-search').fill('12')
        expect(page.locator('.paper-card')).to_have_count(1)
        page.locator('#paper-search').fill('')
        expect(page.locator('.paper-card')).to_have_count(initial_count)
        checks.append('catalog filters, empty state, search and five viewport widths')

        # The sample must never disclose an unsubmitted real paper's reference key.
        page.locator('[data-action="sample"]').click()
        expect(page.locator('.score-number')).to_be_visible()
        assert '示例卷' in page.locator('.page-title').inner_text()
        assert page.evaluate("JSON.parse(localStorage.getItem('rollierank:prototype:v2') || '{\"attempts\":[]}').attempts.length") == 0
        page.goto(base + '#/home', wait_until='networkidle')
        page.locator('.paper-card .button').first.click()
        first_route = page.url
        expect(page.locator('.answer-choices')).to_be_visible()
        page.get_by_role('button', name='选择 A', exact=True).click()
        page.keyboard.press('B')
        page.locator('[data-action="mark"]').click()
        page.reload(wait_until='networkidle')
        expect(page.locator('.practice-progress')).to_contain_text('2 / 130')
        expect(page.locator('[data-action="mark"]')).to_contain_text('已标记')
        page.locator('#auto-next').uncheck()
        page.get_by_role('button', name='选择 C', exact=True).click()
        expect(page.locator('.question-focus h2')).to_contain_text('03')
        page.locator('#auto-next').check()
        settled_screenshot(page, str(output / 'practice-desktop.png'), full_page=True)
        checks.append('draft reload, review marks, keyboard and auto-advance toggle')

        page.set_viewport_size({'width': 390, 'height': 844})
        assert not page.locator('.mobile-nav').count()
        page.locator('[data-action="sheet"]').click()
        expect(page.locator('dialog .q-cell')).to_have_count(130)
        settled_screenshot(page, str(output / 'answer-sheet-mobile.png'))
        page.locator('dialog [data-action="question"][data-question="130"]').click()
        expect(page.locator('.question-focus h2')).to_contain_text('130')
        page.locator('.mobile-sheet-actions [data-action="bulk"]').click()
        page.locator('#bulk-start').fill('1')
        page.locator('#bulk-input').fill('A' * 131)
        expect(page.locator('#bulk-confirm')).to_be_disabled()
        page.locator('#bulk-input').fill('ABCD-' * 26)
        expect(page.locator('#bulk-confirm')).to_be_enabled()
        page.locator('#bulk-confirm').click()
        expect(page.locator('.practice-progress')).to_contain_text('104 / 130')
        settled_screenshot(page, str(output / 'practice-mobile.png'), full_page=True)
        page.locator('[data-action="confirm-submit"]').click()
        expect(page.locator('#modal-title')).to_contain_text('26')
        page.locator('[data-action="fill-missing"]').first.click()
        expect(page.locator('.question-focus h2')).to_contain_text('05')
        page.locator('[data-action="confirm-submit"]').click()
        # Force a request failure and verify retry retains the original answers and token.
        page.route('**/api/submit', lambda route: route.abort())
        page.locator('#submit-attempt').click()
        # The first formal submission also exercises the explicit job prompt before the simulated network failure.
        expect(page.locator('[data-position-action="skip-submit"]')).to_be_visible()
        page.locator('[data-position-action="skip-submit"]').click()
        # The short reminder replaces the dialog, so failure returns to the draft and announces the error there.
        expect(page.locator('.toast')).to_be_visible()
        stored_answers = page.evaluate("Object.values(JSON.parse(localStorage.getItem('rollierank:prototype:v2')).drafts)[0].answers.filter(Boolean).length")
        assert stored_answers == 104
        page.unroute('**/api/submit')
        page.locator('[data-action="confirm-submit"]').click()
        expect(page.locator('#submit-attempt')).to_be_enabled()
        page.locator('#submit-attempt').evaluate('(button) => { button.click(); button.click(); }')
        expect(page.locator('.score-number')).to_be_visible()
        report_route = page.url
        expect(page.locator('.score-number')).to_contain_text('17.35')
        assert page.evaluate("JSON.parse(localStorage.getItem('rollierank:prototype:v2')).attempts.length") == 1
        settled_screenshot(page, str(output / 'report-mobile.png'), full_page=True)
        checks.append('mobile answer sheet, bulk validation, blank confirmation, failed submit retry and double-click protection')

        page.locator('[data-action="poster"]').click()
        for style in ['score', 'grid', 'answers']:
            page.locator(f'[data-action="poster-style"][data-value="{style}"]').click()
            expect(page.locator('#poster-canvas')).to_be_visible()
            with page.expect_download() as download:
                page.locator('[data-action="save-poster"]').click()
            path = output / f'poster-{style}.png'
            download.value.save_as(str(path))
            assert path.stat().st_size > 10000
            if style == 'answers':
                expect(page.locator('#poster-copy-link')).to_be_disabled()
        page.locator('[data-action="close-modal"]').click()
        page.get_by_role('link', name='逐题答案对照', exact=False).click()
        expect(page.locator('.detail-row')).to_have_count(130)
        page.locator('[data-action="detail-filter"][data-value="wrong"]').click()
        expect(page.locator('.detail-row')).to_have_count(81)
        with page.expect_download() as download:
            page.get_by_role('button', name='导出 CSV', exact=True).click()
        path = output / 'scores.csv'
        download.value.save_as(str(path))
        assert len(path.read_text(encoding='utf-8-sig').splitlines()) == 131
        checks.append('three downloadable PNG posters, private answer export, detail filters and complete CSV')

        page.goto(base + '#/me', wait_until='networkidle')
        expect(page.locator('.history-row')).to_have_count(1)
        page.get_by_role('button', name='设置体验身份', exact=False).click()
        page.locator('#profile-name').fill('每天多一分')
        page.get_by_role('button', name='开始体验', exact=True).click()
        page.goto(base + '#/rank', wait_until='networkidle')
        # Formal submissions already participate; the board derives each user's best real receipt.
        expect(page.locator('.positions-board-row')).to_have_count(1)
        expect(page.get_by_role('button', name='上榜设置', exact=True)).to_have_count(0)
        settled_screenshot(page, str(output / 'rank-mobile.png'), full_page=True)
        checks.append('experience identity, automatic real ranking and independent subject best')

        # Start another attempt and prove the first submitted report remains frozen.
        page.goto(first_route, wait_until='networkidle')
        page.locator('[data-action="answer"][data-answer="A"]').click()
        page.locator('[data-action="confirm-submit"]').click()
        page.locator('#submit-attempt').click()
        expect(page.locator('[data-position-action="skip-submit"]')).to_be_visible()
        page.locator('[data-position-action="skip-submit"]').click()
        expect(page.locator('.score-number')).to_be_visible()
        page.goto(report_route, wait_until='networkidle')
        expect(page.locator('.score-number')).to_contain_text('17.35')
        page.get_by_role('link', name='查看同卷趋势', exact=False).click()
        expect(page.locator('.analytics-chart circle')).to_have_count(2)
        settled_screenshot(page, str(output / 'stats-mobile.png'), full_page=True)
        page.goto(base + '#/me', wait_until='networkidle')
        with page.expect_download() as download:
            page.locator('[data-action="export-data"]').click()
        backup = output / 'backup.json'
        download.value.save_as(str(backup))
        page.locator('[data-action="restore-data"]').click()
        page.locator('#restore-file').set_input_files(str(backup))
        expect(page.locator('#restore-confirm')).to_be_enabled()
        page.locator('#restore-confirm').click()
        expect(page.locator('.history-row')).to_have_count(2)
        checks.append('immutable prior report, two-attempt trend and data backup/restore')

        # Import a short paper through the visible management UI and grade it end to end.
        page.set_viewport_size({'width': 1440, 'height': 1024})
        page.goto(base + '#/admin', wait_until='networkidle')
        page.locator('.admin-tabs [data-action="admin-tab"][data-value="import"]').click()
        page.locator('input[name="title"]').fill('原型验收 · 六题练习')
        page.locator('#import-csv').fill('题号,题型,答案,分值\n1,政治理论,A,0.5\n2,政治理论,B,0.5\n3,言语理解,C,0.8\n4,言语理解,D,0.8\n5,数量关系,A,1\n6,资料分析,B,1')
        page.locator('[data-action="validate-import"]').click()
        expect(page.locator('#import-preview')).to_contain_text('整卷校验通过')
        page.locator('#save-import').click()
        row = page.locator('.admin-table-row').filter(has_text='原型验收 · 六题练习')
        expect(row).to_have_count(1)
        row.locator('[data-action="admin-status"]').click()
        page.locator('[data-action="confirm-admin-status"]').click()
        expect(row.locator('.tag')).to_have_text('已发布')
        settled_screenshot(page, str(output / 'admin-desktop.png'), full_page=True)
        page.goto(base + '#/home', wait_until='networkidle')
        card = page.locator('.paper-card').filter(has_text='原型验收 · 六题练习')
        card.locator('.button').click()
        page.locator('.answer-sheet [data-action="bulk"]').click()
        page.locator('#bulk-input').fill('ABCDAB')
        page.locator('#bulk-confirm').click()
        page.locator('[data-action="confirm-submit"]').click()
        page.locator('#submit-attempt').click()
        expect(page.locator('[data-position-action="skip-submit"]')).to_be_visible()
        page.locator('[data-position-action="skip-submit"]').click()
        expect(page.locator('.score-number')).to_contain_text('4.6')
        custom_report_route = page.url
        page.goto(base + '#/admin', wait_until='networkidle')
        row = page.locator('.admin-table-row').filter(has_text='原型验收 · 六题练习')
        row.locator('[data-action="admin-status"]').click()
        page.locator('[data-action="confirm-admin-status"]').click()
        expect(row.locator('.tag')).to_have_text('已下线')
        page.locator('.admin-tabs [data-value="audit"]').click()
        expect(page.locator('.audit-list')).to_contain_text('发布套卷')
        expect(page.locator('.audit-list')).to_contain_text('下线套卷')
        page.goto(custom_report_route, wait_until='networkidle')
        expect(page.locator('.score-number')).to_contain_text('4.6')
        checks.append('CSV management import, independent score trial, publish, variable-length grading, offline status and retained snapshot')

        for width in [320, 390, 768, 1024, 1440]:
            page.set_viewport_size({'width': width, 'height': 844 if width < 761 else 1024})
            for route in ['home', 'me', 'rank', 'admin', report_route.split('#')[1].lstrip('/')]:
                page.goto(base + '#/' + route, wait_until='networkidle')
                check_width(page, width)
                if width == 390 and route in ['home', 'me']:
                    settled_screenshot(page, str(output / f'{route}-mobile.png'), full_page=True)
        assert not errors, errors
        checks.append('final responsive route sweep without browser runtime errors')
        browser.close()
    result = {'passed': len(checks), 'checks': checks, 'browser_errors': errors}
    (output / 'verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', help='Use an existing service; management changes will affect that service.')
    parser.add_argument('--output', default=str(ROOT / 'test-results' / 'prototype'))
    args = parser.parse_args()
    if args.base_url:
        run(args.base_url.rstrip('/') + '/', Path(args.output))
        return
    with tempfile.TemporaryDirectory(prefix='rollierank-browser-') as data:
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        env = {**os.environ, 'PORT': str(port), 'ROLLIERANK_DATA_DIR': data}
        server = subprocess.Popen([shutil.which('node') or 'node', str(ROOT / 'scripts/serve.mjs')], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            base = f'http://127.0.0.1:{port}/'
            deadline = time.monotonic() + 15
            while True:
                try:
                    with urlopen(base, timeout=1) as response:
                        assert response.status == 200
                    break
                except Exception:
                    if server.poll() is not None:
                        raise RuntimeError(server.stderr.read().decode())
                    if time.monotonic() > deadline:
                        raise RuntimeError('Local server did not start within 15 seconds')
                    time.sleep(0.1)
            run(base, Path(args.output))
        finally:
            server.terminate()
            server.wait(timeout=5)


if __name__ == '__main__':
    main()
