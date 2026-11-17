import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Window } from "happy-dom";

test("managed action labels follow answer progress and submitting state", async () => {
  const window = new Window({ url: "http://localhost" });
  // The real page scopes utilities on body; this must not make native controls look React-owned.
  window.document.body.classList.add("beui-island");
  window.document.body.innerHTML = '<div id="actions"><button id="confirm" class="primary" data-action="confirm" aria-label="确认答案">继续录入 · 还差 5 题</button></div>';
  window.eval(await readFile(new URL("../vendor/beui.js", import.meta.url), "utf8"));
  const api = window.RollieUI;
  const container = window.document.querySelector("#actions");
  try {
    api.mountButtons(container);
    const button = container.querySelector("button");
    assert.equal(button.id, "confirm");
    assert.equal(button.dataset.action, "confirm");
    assert.equal(button.getAttribute("aria-label"), "确认答案");
    assert.equal(button.textContent, "继续录入 · 还差 5 题");

    assert.equal(api.updateButton(button, { labelHtml: "继续录入 · 还差 4 题" }), true);
    assert.equal(button.textContent, "继续录入 · 还差 4 题");
    assert.equal(api.updateButton(button, { labelHtml: "提交估分" }), true);
    assert.equal(button.textContent, "提交估分");
    assert.equal(api.updateButton(button, { labelHtml: "正在估分", disabled: true }), true);
    assert.equal(button.textContent, "正在估分");
    assert.equal(button.disabled, true);
    assert.equal(api.updateButton(button, { labelHtml: "提交估分", disabled: false }), true);
    assert.equal(button.disabled, false);

    let action;
    container.addEventListener("click", (event) => { action = event.target.closest("button")?.dataset.action; });
    button.click();
    assert.equal(action, "confirm");
    api.cleanup(container);
    api.cleanup(container);
    const restored = container.querySelector("button");
    assert.equal(restored.textContent, "提交估分");
    assert.equal(api.updateButton(restored, { labelHtml: "未托管" }), false);
  } finally {
    api.cleanup(container);
    await window.happyDOM.close();
  }
});

// 翻页后的第一次主动打开曾被动画计时锁吞掉；以 DOM 换卡完成作为操作时机，不能靠延迟掩盖。
test("current recent card opens immediately after keyboard paging", { timeout: 3000 }, async () => {
  const window = new Window({ url: "http://localhost" });
  window.document.body.innerHTML = '<div id="home"></div>';
  window.eval(await readFile(new URL("../vendor/beui.js", import.meta.url), "utf8"));
  const api = window.RollieUI;
  const container = window.document.querySelector("#home");
  const opened = [];
  try {
    api.mountHome(container, {
      recents: [
        { institution: "四海", period: 1, paper: 3, answered: 125, complete: false },
        { institution: "四海", period: 1, paper: 1, answered: 130, complete: true, score: 72.5 },
      ],
      onOpen: (index) => opened.push(index),
      onPublisher: () => {},
    });
    const changed = new Promise((resolve) => {
      const observer = new window.MutationObserver(() => {
        // The pager is intentionally absent; wait for the actual current paper action instead.
        if (!container.querySelector('[data-distance="0"] button')?.getAttribute("aria-label")?.includes("第1期第1套")) return;
        observer.disconnect();
        resolve();
      });
      observer.observe(container, { childList: true, characterData: true, attributes: true, subtree: true });
    });
    container.querySelector(".rr-deck").dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await changed;
    container.querySelector('[data-distance="0"] button').click();
    assert.deepEqual(opened, [1]);
  } finally {
    api.cleanup(container);
    await window.happyDOM.close();
  }
});
