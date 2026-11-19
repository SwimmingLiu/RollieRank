"""Drive the actual iOS gallery and its iframe, using an isolated real API."""
import argparse
import base64
import json
import os
import re
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent


def api(base, path, data=None):
    request = Request(base + "/api/" + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={"Content-Type": "application/json"} if data is not None else {})
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def snapshot(frame):
    return frame.locator("body").evaluate("() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(key => key.endsWith(':service:v1'))))")


def open_view(page, name):
    page.locator(f'.page-picker [data-page="{name}"]').click()
    frame = page.frame_locator("#phone")
    frame.locator(f'.view[data-page="{name}"]').wait_for(timeout=20000)
    return frame


def direct_view(page, name, **parameters):
    query = urlencode({"design": "paper-cards-1114-v3", "session": "easy-demo", "page": name, **parameters})
    page.locator("#phone").evaluate("(element, url) => {element.src = url}", "app.html?" + query)
    frame = page.frame_locator("#phone")
    frame.locator(f'.view[data-page="{name}"]').wait_for(timeout=20000)
    return frame


def assert_wechat_title(frame, expected):
    assert frame.locator("body").evaluate("element => element.ownerDocument.title") == expected
    heading = frame.locator("#top h1")
    if heading.count():
        assert heading.evaluate("element => element.getBoundingClientRect().height") <= 1


def assert_wechat_title_actions(page, frame, title, back_label, action_label=None):
    assert_wechat_title(frame, title)
    assert frame.locator("#top").evaluate("node => node.getBoundingClientRect().height") <= 1
    back = frame.get_by_role("button", name=back_label, exact=True)
    action = frame.get_by_role("button", name=action_label, exact=True) if action_label else None
    for width, height in [(320, 568), (390, 844), (430, 932)]:
        page.locator("#size").select_option(f"{width},{height}")
        expect(frame.locator("body")).to_have_js_property("clientWidth", width)
        expect(back).to_be_visible()
        if action:
            expect(action).to_be_visible()
        boxes = []
        buttons = [(back_label, back)] + ([(action_label, action)] if action else [])
        for label, button in buttons:
            box = button.evaluate("""node => {
                const rect = node.getBoundingClientRect();
                const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
                return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                    tappable: node.contains(target) };
            }""")
            assert box["width"] >= 43.5 and box["height"] >= 43.5, (width, label, box)
            assert box["x"] >= 0 and box["x"] + box["width"] <= width, (width, label, box)
            assert box["tappable"], (width, label, box)
            boxes.append(box)
        if len(boxes) == 2:
            left, right = boxes
            assert abs(left["y"] + left["height"] / 2 - right["y"] - right["height"] / 2) <= 1
            assert left["x"] + left["width"] + 8 < right["x"], (width, left, right)
    page.locator("#size").select_option("390,844")


def app_native_action(base, receiver):
    for _ in range(4):
        action = api(base, "miniprogram-web/listen", receiver)["action"]
        if action and action["kind"] != "title":
            return action
    raise AssertionError("The native action did not arrive")


def check_choice_sheet(frame, title):
    panel = frame.get_by_role("dialog", name=title, exact=True)
    expect(panel).to_be_visible()
    expect(panel.get_by_role("heading")).to_have_count(0)
    expect(panel.locator("#sheet-close,[data-slot='sheet-handle'],small")).to_have_count(0)
    expect(panel.locator("[aria-pressed='true']")).to_have_count(1)
    body = panel.locator("[data-slot='bottom-sheet-body']")
    assert body.evaluate("node => getComputedStyle(node).scrollbarWidth") == "none"
    return panel, body


def drag_sheet(page, panel, distance):
    box = panel.locator(".rr-options-drag-target").bounding_box()
    assert box is not None
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x, y + distance, steps=12)
    page.mouse.up()


def exercise_collection_picker(page, frame, output):
    frame.get_by_role("button", name="花生，选择套卷", exact=True).click()
    expect(frame.locator('.view[data-page="papers"]')).to_be_visible()
    picker = frame.locator("#period-picker")
    picker.click()
    panel, _ = check_choice_sheet(frame, "选择套卷")
    expect(panel.locator("[data-period]")).to_have_count(3)
    capture_phone_sizes(page, frame, output, "collection-picker")
    frame.get_by_role("button", name="关闭面板", exact=True).click(position={"x": 45, "y": 50})
    expect(panel).to_be_hidden()
    original = picker.get_attribute("aria-label")
    picker.click()
    panel.locator("[data-period][aria-pressed='false']").first.click()
    expect(panel).to_be_hidden()
    assert picker.get_attribute("aria-label") != original
    picker.click()
    panel.get_by_role("button", name=re.compile("第1期")).click()
    expect(picker).to_have_attribute("aria-label", original)
    frame.get_by_role("button", name="返回首页", exact=True).click()
    expect(frame.locator(".rr-brand")).to_be_visible()


def exercise_review_picker(page, frame, output):
    page.locator("#size").select_option("320,568")
    expect(frame.locator("body")).to_have_js_property("clientWidth", 320)
    trigger = frame.get_by_role("button", name="选择复盘板块", exact=True)
    trigger.click()
    panel, list_body = check_choice_sheet(frame, "选择复盘板块")
    expect(panel).to_have_attribute("data-expanded", "false")
    assert list_body.evaluate("node => node.scrollHeight > node.clientHeight")
    drag_sheet(page, panel, -105)
    expect(panel).to_have_attribute("data-expanded", "true")
    page.locator("#phone").screenshot(path=str(output / "review-picker-expanded-320.png"))
    drag_sheet(page, panel, 96)
    expect(panel).to_have_attribute("data-expanded", "false")
    list_body.hover()
    page.mouse.wheel(0, 350)
    expect(list_body).not_to_have_js_property("scrollTop", 0)
    panel.get_by_role("button").last.click()
    expect(panel).to_be_hidden()
    trigger.click()
    panel.get_by_role("button", name="复盘全部板块", exact=True).click()
    expect(panel).to_be_hidden()
    page.locator("#size").select_option("390,844")


def assert_visible_score(frame, attempt):
    expected = f'{attempt["report"]["totalCents"] / 100:.2f}'
    frame.locator("#score-ui").wait_for()
    expect(frame.locator("#score-ui")).to_contain_text(expected, timeout=10000)


def fill_and_submit(frame, option, prompt=False):
    frame.locator(".answer-row").first.wait_for()
    frame.locator(f'.choice[data-option="{option}"]').evaluate_all("buttons => buttons.forEach(button => button.click())")
    frame.locator('[data-action="confirm"]').click()
    if prompt:
        frame.locator('[data-position-action="skip-submit"]').wait_for()
        # The short reminder must dismiss without creating a server receipt.
        expect(frame.locator('.rr-position-prompt-actions button')).to_have_count(2)
        expect(frame.get_by_role("heading", name="选岗查看同岗排名", exact=True)).to_be_visible()
        expect(frame.locator('.rr-position-prompt p')).to_have_count(0)
        before = len(snapshot(frame)["attempts"])
        frame.get_by_role("dialog").get_by_role("button", name="关闭面板", exact=True).click()
        expect(frame.locator('.view[data-page="entry"]')).to_be_visible()
        assert len(snapshot(frame)["attempts"]) == before
        frame.locator('[data-action="confirm"]').click()
        frame.locator('[data-position-action="skip-submit"]').click()
    frame.locator('.view[data-page="report"]').wait_for(timeout=20000)
    attempt = snapshot(frame)["attempts"][0]
    assert_visible_score(frame, attempt)
    return attempt


def capture_phone_sizes(page, frame, output, name):
    # Keep the intrinsic phone pixels for UI review.
    frame.locator(".toast").wait_for(state="hidden", timeout=5000)
    page.set_viewport_size({"width": 1440, "height": 1200})
    for width, height in [(390, 844), (320, 568), (430, 932)]:
        page.locator("#size").select_option(f"{width},{height}")
        expect(frame.locator("body")).to_have_js_property("clientWidth", width)
        frame.locator("body").evaluate("() => document.querySelector('.view')?.scrollTo({top:0,behavior:'instant'})")
        assert frame.locator("body").evaluate("() => document.documentElement.scrollWidth <= innerWidth + 1"), name
        # Screenshotting the iframe preserves fixed sheet headers; cancelling presence animations can hide them.
        frame.locator("body").evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
        page.locator("#phone").screenshot(path=str(output / f"{name}-{width}.png"))
    page.locator("#size").select_option("390,844")


def capture(page, frame, output, name):
    capture_phone_sizes(page, frame, output, name)
    for width, height in [(1440, 900), (1280, 800)]:
        page.set_viewport_size({"width": width, "height": height})
        page.evaluate("window.scrollTo({top:0,behavior:'instant'})")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), name
        page.screenshot(path=str(output / f"{name}-outer-{width}.png"), full_page=True)
    page.set_viewport_size({"width": 1440, "height": 900})


def select_hierarchy(page, frame, output, category_index=0):
    # Follow real source IDs and breadcrumb resets through the official tree.
    exams = frame.get_by_role("group", name="报考考试", exact=True)
    expect(exams).to_be_visible()
    exams.get_by_role("button", name="省考", exact=True).click()
    expect(frame.get_by_text("暂无省考岗位表", exact=True)).to_be_visible()
    exams.get_by_role("button", name="国考", exact=True).click()
    frame.get_by_role("group", name="选择招考", exact=True).locator(".rr-position-option").first.click()
    group = frame.get_by_role("group", name="选择招录类别", exact=True)
    group.locator(".rr-position-option").first.wait_for()
    assert frame.locator(".rr-position-picker select").count() == 0
    # Headless Chromium hides scrollbars by default; the real painted mark and native drag must be exercised.
    frame.locator("body").evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
    geometry = group.evaluate("""el => ({width:el.offsetWidth-el.clientWidth, height:el.clientHeight, outerHeight:el.offsetHeight,
      border:parseFloat(getComputedStyle(el).borderTopWidth), full:el.scrollHeight,
      inset:parseFloat(getComputedStyle(el).getPropertyValue('--rr-scroll-y-inset'))})""")
    assert 0 < geometry["width"] <= 3, geometry
    track = geometry["height"] - 2 * geometry["inset"]
    assert 0 < track <= 56.5, geometry
    group.hover()
    page.mouse.wheel(0, 1000)
    expect(group).to_have_js_property("scrollTop", geometry["full"] - geometry["height"])
    rect = group.bounding_box()
    thumb = max(18, track * geometry["height"] / geometry["full"])
    # A short desktop preview scales the iframe; native pointer coordinates must use its painted bounds.
    scale = rect["height"] / geometry["outerHeight"]
    start = rect["y"] + (geometry["inset"] + geometry["border"]) * scale
    edge = rect["x"] + rect["width"] - geometry["width"] * scale / 2
    page.mouse.move(edge, start + (track - thumb / 2) * scale)
    page.mouse.down()
    page.mouse.move(edge, start + (thumb / 2 - 3) * scale, steps=8)
    page.mouse.up()
    expect(group).to_have_js_property("scrollTop", 0)
    (output / "native-scrollbar.json").write_text(json.dumps({"width": geometry["width"], "track": track,
        "wheelReached": geometry["full"] - geometry["height"], "dragReturned": 0, "previewScale": scale}, indent=2) + "\n")
    group.locator(".rr-position-option").nth(category_index).click()
    frame.get_by_role("group", name="选择招录部门", exact=True).locator(".rr-position-option").first.wait_for()
    # Compare real text bounds with both icon slots; typing and clearing must retain the same search scope.
    field = frame.get_by_role("searchbox", name="搜索部门", exact=True)
    expect(field).to_be_visible()
    for value in ["", "中央办公厅"]:
        field.fill(value)
        expect(frame.get_by_role("group", name="选择招录部门", exact=True)).to_have_attribute("aria-busy", "false")
        gaps = field.evaluate("""el => {
          const rect=el.getBoundingClientRect(), style=getComputedStyle(el), icons=el.parentElement.querySelectorAll(':scope > span');
          return {left:rect.left+parseFloat(style.paddingLeft)-icons[0].getBoundingClientRect().right,
            right:icons.length>1?icons[1].getBoundingClientRect().left-(rect.right-parseFloat(style.paddingRight)):null};
        }""")
        assert gaps["left"] >= 6 and (gaps["right"] is None or gaps["right"] >= 4), gaps
    frame.get_by_role("button", name="清空搜索", exact=True).click()
    expect(field).to_have_value("")
    frame.locator(".rr-position-path-item").first.click()
    frame.get_by_role("group", name="选择招录类别", exact=True).locator(".rr-position-option").nth(category_index).click()
    for label in ["选择招录部门", "选择用人单位"]:
        frame.get_by_role("group", name=label, exact=True).locator(".rr-position-option").first.click()
    leaf = frame.locator("[data-position-leaf]").first
    leaf.wait_for()
    job_id = leaf.get_attribute("data-position-leaf")
    capture(page, frame, output, "position-hierarchy")
    leaf.click()
    expect(frame.locator(".rr-position-picker")).to_have_count(0)
    return job_id


def run(base, output, token=None, check_only=False, wechat_host=False):
    checks = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, ignore_default_args=["--hide-scrollbars"])
        page = browser.new_page(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        if wechat_host:
            initial_requests = {}
            # Release the real server's responses only after checking both startup phases.
            page.route("**/api/miniprogram-web/redeem", lambda route: initial_requests.update(redeem=route), times=1)
            page.route("**/api/catalog", lambda route: initial_requests.update(catalog=route), times=1)
            profile_token = api(base, "miniprogram-profile/session", {})["token"]
            avatar = base64.b64encode((ROOT / "mini-program/assets/rollierank-logo.png").read_bytes()).decode()
            profile = api(base, "miniprogram-profile/profile", {"token": profile_token, "name": "纸卡卷友", "avatar": avatar})["profile"]
            identity = {"guestId": str(uuid4()), "name": profile["name"], "avatarId": profile["avatarId"], "drafts": [], "marks": []}
            native_launch = api(base, "miniprogram-web/bootstrap", identity)
            ticket = native_launch["ticket"]
            # Supply the real native launch URL. Chromium reads the same handoff as the native page.
            page.add_init_script(script="(" + """({ticket}) => {
                if (!location.pathname.endsWith('/ios-v3/app.html')) return;
                const url = new URL(location.href);
                url.searchParams.set('embed', 'wechat');
                url.searchParams.set('wxBottom', '34');
                if (!sessionStorage.getItem('rollierank:wechat:guest')) url.hash = 'rr=' + ticket;
                history.replaceState(history.state, '', url);
            }""" + ")(" + json.dumps({"ticket": ticket}) + ");")
        gallery = base + "/ios-v3/?design=paper-cards-1114-v3"
        if wechat_host:
            with page.expect_request("**/api/miniprogram-web/redeem"):
                page.goto(gallery, wait_until="commit")
            frame = page.frame_locator("#phone")
            skeleton = frame.locator(".rr-home-loading")
            expect(skeleton).to_be_visible(timeout=5000)
            expect(skeleton.locator(".rr-paper-skeleton")).to_have_count(1)
            expect(frame.locator(".rr-publishers")).to_have_count(0)
            expect(frame.locator(".rr-home-timer")).to_have_count(0)
            expect(frame.locator(".rr-brand-mark")).to_have_js_property("complete", True)
            with page.expect_request("**/api/catalog"):
                initial_requests["redeem"].continue_()
            expect(skeleton).to_be_visible()
            capture_phone_sizes(page, frame, output, "startup")
            initial_requests["catalog"].continue_()
            expect(skeleton).to_have_count(0)
            expect(frame.locator(".rr-publishers")).to_be_visible()
            expect(frame.locator(".rr-deck")).to_have_count(0)
            checks.append("the home paper card is visible during WeChat connection and catalog loading, then gives way to real paper selection")
        else:
            page.goto(gallery, wait_until="networkidle")
        frame = open_view(page, "me")
        if wechat_host:
            assert_wechat_title(frame, "练习记录")
            profile_card = frame.locator(".rr2-profile-identity")
            expect(profile_card.get_by_role("heading", name=identity["name"], exact=True)).to_be_visible()
            expect(profile_card.locator("img[src*='miniprogram-profile/avatar']")).to_be_visible()
            profile_card.get_by_role("button", name="编辑个人资料", exact=True).click()
            assert app_native_action(base, {"receiver": native_launch["receiver"]}) == {"kind": "profile"}
            checks.append("records display the locally saved WeChat profile and open the native profile through the bridge")
        expect(frame.get_by_role("button", name="选择报考岗位", exact=True)).to_be_visible()
        expect(frame.get_by_text("成长分析", exact=True)).to_be_visible()
        expect(frame.locator(".rr-practice-tool")).to_have_count(2)
        expect(frame.get_by_text("反馈与订正通知", exact=True)).to_have_count(0)
        expect(frame.get_by_role("searchbox", name="查询练习记录", exact=True)).to_have_count(0)
        initial_history_count = frame.locator(".rr6-record-card").count()
        frame.get_by_role("button", name="搜索练习记录", exact=True).click()
        frame.get_by_role("searchbox", name="查询练习记录", exact=True).fill("没有这份套卷")
        expect(frame.locator(".rr6-record-card")).to_have_count(0)
        frame.get_by_role("button", name="收起搜索", exact=True).click()
        expect(frame.locator(".rr6-record-card")).to_have_count(initial_history_count)
        assert api(base, "catalog")["versions"]
        assert api(base, "positions/hierarchy")["options"]
        capture(page, frame, output, "records-ready")
        checks.append("the actual iOS iframe has compact job/analysis cards and working lazy history search")
        if check_only:
            browser.close()
            return {"checks": checks, "errors": errors, "base": base}

        frame = open_view(page, "home")
        if wechat_host:
            assert frame.locator("body").evaluate("element => element.ownerDocument.title.trim()") == ""
            assert frame.locator("#top").evaluate("node => node.getBoundingClientRect().height") <= 1
            brand = frame.locator(".rr-brand")
            expect(brand).to_be_visible()
            expect(brand.locator(".rr-brand-title")).to_have_text("卷卷小榜")
            expect(brand.locator(".rr-brand-mark")).to_be_visible()
            for width, height in [(320, 568), (390, 844), (430, 932)]:
                page.locator("#size").select_option(f"{width},{height}")
                expect(frame.locator("body")).to_have_js_property("clientWidth", width)
                box = brand.evaluate("node => { const r=node.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; }")
                assert box["x"] >= 0 and box["x"] + box["width"] <= width
                assert box["y"] >= 0 and box["y"] + box["height"] <= 60
            page.locator("#size").select_option("390,844")
            checks.append("the original logo and title stay together directly below the WeChat capsule")
        capture(page, frame, output, "home")
        if wechat_host:
            exercise_collection_picker(page, frame, output)
            checks.append("the compact paper picker dismisses from the backdrop and applies the selected collection")

        # Fresh candidate data starts blank; all receipts are created by real answer buttons.
        frame = open_view(page, "entry")
        expect(frame.locator(".answer-row")).to_have_count(130)
        expect(frame.get_by_text("本机已存", exact=True)).to_have_count(0)
        expect(frame.get_by_role("button", name="查看套卷信息", exact=True)).to_have_count(0)
        expect(frame.locator(".identity #answer-count")).to_have_text(re.compile(r"0\s*/\s*130"))
        frame.get_by_role("button", name="答题卡", exact=True).click()
        expect(frame.locator(".ios-answer-sheet-cell")).to_have_count(130)
        expect(frame.locator('.ios-answer-sheet-cell[aria-current="true"]')).to_have_count(1)
        capture(page, frame, output, "answer-sheet")
        frame.get_by_role("dialog").get_by_role("button", name=re.compile(r"第 130 题")).click()
        expect(frame.get_by_role("dialog", name="答题卡", exact=True)).to_have_count(0)
        expect(frame.locator("#question-130")).to_be_in_viewport()
        capture(page, frame, output, "entry")
        first = fill_and_submit(frame, "A", True)
        assert first["isSample"] is False and first["report"]["rows"]
        guest = snapshot(frame)["guestId"]
        if wechat_host:
            assert guest == identity["guestId"]
            expect(frame.locator("html")).to_have_attribute("data-host", "wechat")
            assert_wechat_title_actions(page, frame, "练习估分", "返回首页", "重新练习本卷")
            frame.get_by_role("button", name="重新练习本卷", exact=True).click()
            expect(frame.get_by_role("dialog", name="再练一次", exact=True)).to_be_visible()
            frame.get_by_role("button", name="取消", exact=True).click()
            assert_visible_score(frame, first)
            checks.append("back and retry stay level and tappable at 320, 390 and 430 pixels")
        assert api(base, "attempts/sync", {"guestId": guest})["attempts"][0]["id"] == first["id"]
        expect(frame.locator(".ios-service-notice")).to_have_count(0)
        expect(frame.locator(".rr-score-verification")).to_have_count(0)
        expect(frame.locator(".ios-analysis-vs")).to_have_count(0)
        expect(frame.locator("form,textarea")).to_have_count(0)
        expect(frame.locator(".rr-discussion-entry")).to_be_visible()
        capture(page, frame, output, "real-report")
        checks.append("real submission, a cancellable two-button reminder and a clean first report use the actual server receipt")

        frame.locator(".rr-discussion-entry").click()
        expect(frame.locator('.view[data-page="discussion"]')).to_be_visible()
        expect(frame.locator(".rr-discussion-heading h2")).to_have_text("全部评论")
        expect(frame.locator("textarea")).to_have_count(0)
        frame.locator(".rr-discussion-compose").click()
        expect(frame.locator("#discussion-nickname")).to_have_count(0)
        expect(frame.locator(".rr-discussion-editor-identity")).to_have_count(0)
        frame.locator("#discussion-text").fill("资料分析部分值得再练一次。https://example.com/study")
        page.keyboard.press("Escape")
        expect(frame.locator(".rr-discussion-compose")).to_contain_text("继续编辑草稿")
        frame.locator(".rr-discussion-compose").click()
        expect(frame.locator("#discussion-text")).to_have_value("资料分析部分值得再练一次。https://example.com/study")
        expect(frame.locator('#discussion-links,[data-discussion-file="audio"]')).to_have_count(0)
        frame.locator('[data-discussion-file="images"]').set_input_files(str(ROOT / "docs/ui-exploration/ios-v3/assets/brand/rollierank-logo-transparent.png"))
        expect(frame.locator(".rr-discussion-selected-images figure")).to_have_count(1)
        # The mobile composer now publishes photos/text and connects reactions and threaded replies.
        expect(frame.get_by_role("button", name=re.compile("语音|录音"))).to_have_count(0)
        frame.get_by_role("button", name="发送", exact=True).click()
        expect(frame.locator(".rr-discussion-post")).to_have_count(1)
        expect(frame.locator('.rr-discussion-post [data-slot="discussion-avatar"]')).to_have_count(1)
        expect(frame.locator(".rr-discussion-post audio")).to_have_count(0)
        expect(frame.locator('.rr-discussion-post a[href="https://example.com/study"]')).to_have_count(1)
        root = frame.locator(".rr-discussion-thread").first
        root.locator(".rr-discussion-like").click()
        expect(root.locator(".rr-discussion-like")).to_have_attribute("aria-pressed", "true")
        root.locator(".rr-discussion-post-actions").get_by_role("button", name=re.compile("^回复")).click()
        expect(frame.locator(".rr-discussion-reply-context")).to_contain_text("回复")
        frame.locator("#discussion-text").fill("我也准备再练一遍。")
        frame.get_by_role("button", name="发送", exact=True).click()
        expect(root.locator(".rr-discussion-reply")).to_have_count(1)
        root.locator(".rr-discussion-thread-toggle").click()
        expect(root.locator(".rr-discussion-replies")).to_have_count(0)
        root.locator(".rr-discussion-thread-toggle").click()
        expect(root.locator(".rr-discussion-reply")).to_have_count(1)
        capture(page, frame, output, "discussion")
        frame.get_by_role("button", name="返回估分" if wechat_host else "返回", exact=True).click()
        expect(frame.locator(".rr-discussion-entry")).to_contain_text("2 条讨论")
        expect(frame.locator("form,textarea")).to_have_count(0)
        checks.append("mobile comments retain drafts/photos/auto-links, persist likes and expand or collapse real threaded replies")

        frame = open_view(page, "details")
        expect(frame.locator(".detail-table")).to_be_visible()
        if wechat_host:
            assert_wechat_title_actions(page, frame, "逐题对照", "返回估分", "反馈参考答案")
            exercise_review_picker(page, frame, output)
            checks.append("a long option list expands, collapses and scrolls on a short screen with scrollbars hidden")
        capture(page, frame, output, "details")
        frame = open_view(page, "share")
        capture(page, frame, output, "share")
        if wechat_host:
            assert_wechat_title_actions(page, frame, "成绩分享", "返回估分")
            receiver = {"receiver": native_launch["receiver"]}
            for mode, label in (("report", "长图"), ("score", "成绩卡"), ("sections", "题型"), ("radar", "雷达")):
                frame.get_by_role("tab", name=label, exact=True).click()
                expect(frame.locator(".rr-share-studio")).to_have_attribute("data-share-mode", mode)
                frame.locator('[data-action="save-poster"]').click()
                action = app_native_action(base, receiver)
                assert action and action["kind"] == "poster"
                with urlopen(base + "/api/miniprogram-web/poster?" + urlencode({"ticket": action["ticket"]}), timeout=10) as image:
                    png = image.read()
                assert png.startswith(bytes.fromhex("89504e470d0a1a0a"))
                assert int.from_bytes(png[16:20], byteorder="big") == 900
                (output / f"wechat-{mode}.png").write_bytes(png)
            frame.locator('[data-action="invite"]').click()
            invite = app_native_action(base, receiver)
            assert invite and invite["kind"] == "invite"
            assert set(invite) == {"kind", "institution", "period", "paper"}
            checks.append("four real PNG files and the same-paper invitation reach the native action boundary without private attempt data")
        else:
            with page.expect_download() as download:
                frame.locator('[data-action="save-poster"]').click()
            poster = output / "ios-score-poster.png"
            download.value.save_as(poster)
            assert poster.read_bytes().startswith(bytes.fromhex("89504e470d0a1a0a"))
        checks.append("the original details and share pages retain the actual result and export a real PNG")

        frame = open_view(page, "me")
        frame.get_by_role("button", name="选择报考岗位", exact=True).click()
        job_id = select_hierarchy(page, frame, output)
        expect(frame.locator(".rr-practice-tool.position")).not_to_contain_text("未选岗")
        assert api(base, "positions/profile?guestId=" + guest)["positionId"] == job_id
        checks.append("category/department/unit/job selection and breadcrumb backtracking persist real position IDs")

        frame = direct_view(page, "report", attempt=first["id"])
        frame.locator('[data-action="restart"]').click()
        frame.locator('[data-action="new-attempt"]').click()
        second = fill_and_submit(frame, "B")
        expect(frame.locator(".ios-analysis-vs")).to_contain_text("VS")
        expect(frame.locator(".ios-analysis-mini")).to_have_count(0)
        assert second["id"] != first["id"]
        capture(page, frame, output, "second-practice")
        checks.append("a second actual attempt retains its predecessor and renders compact native VS metrics")
        frame.locator('[data-action="restart"]').click()
        frame.locator('[data-action="new-attempt"]').click()
        third = fill_and_submit(frame, "C")
        expect(frame.locator(".ios-analysis-mini svg")).to_have_count(1)
        expect(frame.locator(".ios-analysis-mini circle")).to_have_count(3)
        capture(page, frame, output, "third-practice")
        checks.append("the third actual attempt adds a real three-point curve without a full form in the report")

        for institution, option in [("超格", "C"), ("粉笔", "D"), ("上岸村", "A")]:
            frame = direct_view(page, "papers", institution=institution, period=1, paper=1)
            if institution == "超格":
                capture(page, frame, output, "papers")
            frame.locator('.rr3-paper-cover .rr-card-hit').first.click()
            fill_and_submit(frame, option)
        frame = open_view(page, "stats")
        frame.get_by_role("button", name="筛选分析记录", exact=True).click()
        frame.get_by_role("dialog").get_by_role("button", name=re.compile("考试类别")).click()
        frame.get_by_role("dialog").get_by_role("button", name=re.compile("地市卷")).click()
        expect(frame.locator(".ios-analysis-records tbody tr")).to_have_count(6)
        expect(frame.locator(".ios-analysis-records")).to_contain_text("超格")
        expect(frame.locator(".ios-analysis-records")).to_contain_text("粉笔")
        expect(frame.locator(".ios-analysis-records")).to_contain_text("上岸村")
        frame.locator('.ios-analysis-dimension').click()
        frame.get_by_role("button", name="资料分析", exact=True).click()
        expect(frame.locator(".ios-analysis-dimension")).to_contain_text("资料分析")
        frame.get_by_role("tab", name="正确率", exact=True).click()
        expect(frame.get_by_role("tab", name="正确率", exact=True)).to_have_attribute("aria-selected", "true")
        capture(page, frame, output, "cross-paper-analysis")
        # The user-facing selector exposes the complete judgment subject and no separate subtypes.
        frame.locator('.ios-analysis-dimension').click()
        for subtype in ["逻辑判断", "类比推理", "图形推理", "定义判断"]:
            expect(frame.get_by_role("button", name=subtype, exact=True)).to_have_count(0)
        frame.get_by_role("button", name="判断推理", exact=True).click()
        expect(frame.locator(".ios-analysis-dimension")).to_contain_text("判断推理")
        capture(page, frame, output, "judgment-analysis")
        checks.append("all city-category receipts aggregate across publishers and distinct weights while each point retains its actual report metrics")

        # Exercise the themed filters on the actual app; no native date input or local-state seeding.
        frame.get_by_role("button", name="筛选分析记录", exact=True).click()
        capture(page, frame, output, "analysis-filter-cards")
        frame.get_by_role("dialog").get_by_role("button", name=re.compile("考试类别")).click()
        frame.get_by_role("button", name="计分说明", exact=True).click()
        expect(frame.get_by_role("dialog")).to_contain_text("每份成绩沿用自己的分值和满分")
        frame.get_by_role("button", name="返回筛选", exact=True).click()
        frame.get_by_role("dialog").get_by_role("button", name=re.compile("练习日期")).click()
        expect(frame.locator('input[type="date"]')).to_have_count(0)
        day = page.evaluate("timestamp => {const d=new Date(timestamp); return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;}", third["createdAt"])
        frame.get_by_role("button", name=day, exact=True).click()
        frame.get_by_role("button", name=day, exact=True).click()
        capture(page, frame, output, "analysis-themed-calendar")
        frame.get_by_role("button", name="应用", exact=True).click()
        expect(frame.locator(".ios-analysis-records tbody tr").first).to_be_visible()
        frame.get_by_role("button", name="筛选分析记录", exact=True).click()
        frame.get_by_role("dialog").get_by_role("button", name=re.compile("练习日期")).click()
        frame.get_by_role("button", name="清除", exact=True).click()
        checks.append("theme filter cards, scoring help and keyboard-ready calendar apply and clear actual date bounds")

        frame = direct_view(page, "report", attempt=first["id"])
        frame.locator('[data-action="restart"]').wait_for()
        frame.locator(".rr3-rank-link").click()
        if wechat_host:
            assert_wechat_title_actions(page, frame, "同卷榜", "返回估分", "榜单规则")
            frame.get_by_role("button", name="榜单规则", exact=True).click()
            expect(frame.get_by_role("dialog", name="榜单规则", exact=True)).to_be_visible()
            frame.get_by_role("button", name="知道了", exact=True).click()
            expect(frame.get_by_role("dialog", name="榜单规则", exact=True)).to_have_count(0)
        expect(frame.get_by_role("button", name="上榜设置", exact=True)).to_have_count(0)
        frame.locator('[data-position-action="scope-nationwide"]').click()
        assert api(base, "positions/profile?guestId=" + guest)["participation"]["attemptIds"]
        tabs = frame.locator(".rr2-rank-tab")
        expect(frame.get_by_role("tab", name="判断推理", exact=True)).to_have_count(1)
        for subtype in ["逻辑判断", "类比推理", "图形推理", "定义判断"]:
            expect(frame.get_by_role("tab", name=subtype, exact=True)).to_have_count(0)
        dimensions = tabs.evaluate_all("buttons=>buttons.map(button=>({left:button.getBoundingClientRect().left,right:button.getBoundingClientRect().right,scroll:button.scrollWidth,width:button.clientWidth}))")
        assert all(item["scroll"] <= item["width"] + 1 for item in dimensions)
        assert all(right["left"] >= left["right"] - 1 for left, right in zip(dimensions, dimensions[1:]))
        tabs.last.click()
        expect(tabs.last).to_have_attribute("aria-selected", "true")
        tabs.first.click()
        expect(tabs.first).to_have_attribute("aria-selected", "true")
        judgment = frame.get_by_role("tab", name="判断推理", exact=True)
        judgment.click()
        expect(judgment).to_have_attribute("aria-selected", "true")
        board = api(base, "positions/leaderboard?" + urlencode({"versionId": first["versionId"], "guestId": guest, "scope": "nationwide", "dimension": "judgment"}))
        metrics = []
        for attempt in snapshot(frame)["attempts"]:
            if attempt["versionId"] != first["versionId"]:
                continue
            rows = [row for row in attempt["report"]["rows"] if row["type"] == "判断推理"]
            metrics.append(sum(row["cents"] for row in rows) / sum(row["maxCents"] for row in rows))
        assert abs(board["self"]["rate"] - max(metrics)) < 1e-10
        expect(frame.locator(f'.rr6-winner-card[aria-label*="{board["self"]["rate"] * 100:.2f}%"]')).to_have_count(1)
        capture(page, frame, output, "judgment-ranking")
        tabs.first.click()
        capture(page, frame, output, "real-ranking")
        checks.append("the existing podium and paper ranking render actual voluntary scores and nationwide scope")

        frame = direct_view(page, "report", attempt=first["id"])
        assert_visible_score(frame, first)
        frame.locator('[data-action="details"]').click()
        frame.get_by_role("button", name="反馈参考答案", exact=True).click()
        expect(frame.get_by_role("dialog", name="选择反馈题目", exact=True)).to_be_visible()
        changed = [row for row in first["report"]["rows"] if row["answer"] != row["correctAnswer"]][:2]
        assert len(changed) == 2
        for index, question in enumerate(changed):
            if index:
                frame.locator('[data-correction-action="add-row"]').click()
            frame.get_by_role("button", name=f"反馈第 {question['question']} 题", exact=True).click()
            row = frame.locator("[data-correction-row]").last
            row.locator('[data-suggested-answer][value="A"]').check()
            row.locator('[name="evidence"]').fill("隔离 UI 回归：核对样例修订，建议为 A。")
        frame.locator('button[form="correction-feedback-form"]').click()
        frame.locator('[data-correction-action="preview"]').click()
        expect(frame.locator("[data-correction-preview]")).to_contain_text("试算")
        assert api(base, "attempts/sync", {"guestId": guest, "attemptIds": [first["id"]]})["attempts"][0]["report"]["totalCents"] == first["report"]["totalCents"]
        frame.locator('[data-correction-action="close"]').click()
        checks.append("the existing BottomSheet submits two-question feedback and previews without altering official grades")

        frame = open_view(page, "me")
        frame.locator('[data-ios-correction-action="admin"]').click()
        frame.locator('.view[data-page="admin"]').wait_for()
        frame.locator('[data-correction-action="unlock"]').click()
        frame.locator('[name="reviewToken"]').fill(token)
        frame.locator('button[form="correction-credential-form"]').click()
        frame.locator('[data-correction-action="review"]').click()
        frame.locator('textarea[name="reason"]').fill("隔离回归确认两题修订，重新计分。")
        frame.locator('button[form="correction-review-form"]').click()
        frame.locator('[data-correction-action="confirm-review"]').click()
        expect(frame.locator(".correction-count")).to_contain_text("0 待审核")
        capture(page, frame, output, "review")

        frame = direct_view(page, "report", attempt=first["id"])
        updated = next(attempt for attempt in snapshot(frame)["attempts"] if attempt["id"] == first["id"])
        assert updated["answerRevision"] == 1
        assert updated["report"]["totalCents"] > first["report"]["totalCents"]
        assert updated["answers"] == first["answers"] and updated["createdAt"] == first["createdAt"]
        assert_visible_score(frame, updated)
        expect(frame.locator('.rr3-score-card [data-feature="corrections-status"]')).to_contain_text("答案已订正")
        expect(frame.locator('[data-feature="corrections-status"]')).to_have_count(1)
        frame.locator('.ios-corrections-report-status').click()
        expect(frame.get_by_role("dialog")).to_be_visible()
        frame.get_by_role("dialog").get_by_role("button", name="关闭面板", exact=True).click()
        capture(page, frame, output, "corrected-report")
        checks.append("authorized iOS review updates the standard and synchronizes the original native report while preserving answers")

        frame = open_view(page, "me")
        expect(frame.get_by_text("报考岗位", exact=True)).to_be_visible()
        assert len(snapshot(frame)["attempts"]) == 6
        capture(page, frame, output, "records-restored")
        # The empty result card should not duplicate search reset controls or explanatory copy.
        frame.get_by_role("button", name="搜索练习记录", exact=True).click()
        frame.get_by_role("searchbox", name="查询练习记录", exact=True).fill("没有这份套卷的记录")
        expect(frame.locator(".rr2-profile-empty h3")).to_have_text("没有符合条件的记录")
        expect(frame.locator(".rr2-profile-empty p,.rr2-profile-empty button")).to_have_count(0)
        capture(page, frame, output, "records-no-results")
        frame.get_by_role("button", name="收起搜索", exact=True).click()

        frame = direct_view(page, "papers", institution="四海", period=102, paper=1)
        frame.locator('.rr3-paper-cover .rr-card-hit').first.click()
        expect(frame.locator(".answer-row")).to_have_count(135)
        # A real reload must recover the 135-question draft, not truncate it to the old preview length.
        page.locator("#phone").evaluate("element => {element.src = element.contentWindow.location.href}")
        frame.locator('.view[data-page="entry"]').wait_for(timeout=20000)
        expect(frame.locator(".answer-row")).to_have_count(135)
        frame.get_by_role("button", name="答题卡", exact=True).click()
        expect(frame.locator(".ios-answer-sheet-cell")).to_have_count(135)
        page.locator("#size").select_option("320,568")
        last = frame.get_by_role("dialog").get_by_role("button", name=re.compile(r"第 135 题"))
        last.scroll_into_view_if_needed()
        last.click()
        expect(frame.locator("#question-135")).to_be_in_viewport()
        page.locator("#size").select_option("390,844")
        province = fill_and_submit(frame, "A")
        assert len(province["report"]["rows"]) == 135
        capture(page, frame, output, "province-report")
        checks.append("the original UI records and restores 135-question papers and renders their actual server result")
        assert not errors, errors
        browser.close()
    return {"checks": checks, "errors": errors, "base": base}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base")
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--wechat-host", action="store_true")
    parser.add_argument("--output", type=Path, default=ROOT / "test-results/ios-features")
    args = parser.parse_args(); output = args.output.resolve(); output.mkdir(parents=True, exist_ok=True)
    if args.base:
        if not args.check_only or args.wechat_host:
            raise ValueError("Existing services support read-only checks; full journeys use an isolated service")
        result = run(args.base.rstrip("/"), output, check_only=True)
    else:
        with tempfile.TemporaryDirectory(prefix="rollierank-ios-qa-") as directory:
            with socket.socket() as sock:
                sock.bind(("127.0.0.1", 0)); port = sock.getsockname()[1]
            token = str(uuid4()); base = f"http://127.0.0.1:{port}"
            env = dict(os.environ, PORT=str(port), ROLLIERANK_DATA_DIR=directory, ROLLIERANK_REVIEW_TOKEN=token)
            with (output / "server.log").open("w") as log:
                process = subprocess.Popen([shutil.which("node"), "scripts/serve.mjs"], cwd=ROOT, env=env, stdout=log, stderr=log)
                try:
                    for _ in range(150):
                        if process.poll() is not None: raise RuntimeError("iOS QA service exited; inspect server.log")
                        try:
                            api(base, "catalog"); break
                        except OSError: time.sleep(.1)
                    else: raise RuntimeError("iOS QA service did not start")
                    result = run(base, output, token, wechat_host=args.wechat_host)
                finally:
                    process.terminate(); process.wait(timeout=10)
    (output / "results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"passed": len(result["checks"]), "results": str(output / "results.json")}, ensure_ascii=False))


if __name__ == "__main__": main()
