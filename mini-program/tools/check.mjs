// 小程序静态检查：语法、页面注册、事件绑定、组件声明，以及与网页端计时口径的一致性。
// 用法：node mini-program/tools/check.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const repo = path.resolve(root, "..");
const require = createRequire(path.join(root, "package.json"));
const problem = message => { console.log("✖ " + message); process.exitCode = 1; };

function checkMarkup(file, markup) {
  if (/\bwx:(?:if|elif)="(?!\{\{)/.test(markup)) problem(`${file} 的 wx:if 和 wx:elif 必须绑定表达式`);
  for (const [tag] of markup.matchAll(/<[a-z](?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)) {
    if (/\bwx:for=/.test(tag) && /\bwx:(?:else\b|elif=)/.test(tag)) {
      problem(`${file} 的条件分支需用 block 包住 wx:for，以通过微信编译`);
    }
    if (tag.startsWith("<scroll-view")) {
      if (!/show-scrollbar\s*=\s*"\{\{false\}\}"/.test(tag)) {
        problem(`${file} 的 scroll-view 必须隐藏视觉滚动条`);
      }
      if (!/\benhanced(?:\s*=\s*"\{\{true\}\}")?(?=[\s/>])/.test(tag)) {
        problem(`${file} 的 scroll-view 必须启用 enhanced 才能在各端隐藏滚动条`);
      }
    }
  }
}

for (const name of readdirSync(root, { recursive: true })) {
  if (!/^(?:app\.js|config\.js|(?:components|custom-tab-bar|pages|services|utils)\/.*\.js)$/.test(name)) continue;
  const fullPath = path.join(root, name);
  const result = spawnSync(process.execPath, ["--check", fullPath], { encoding: "utf8" });
  if (result.status !== 0) problem(result.stderr.trim() || name);
  const source = readFileSync(fullPath, "utf8");
  for (const match of source.matchAll(/\b(?:confirmText|cancelText)\s*:\s*["']([^"']+)["']/g)) {
    if ([...match[1]].length > 4) {
      problem(`${name} 的微信弹窗按钮文案「${match[1]}」超过 4 个字符，真机 wx.showModal 会直接失败`);
    }
  }
  for (const match of source.matchAll(/wx\.canvasToTempFilePath\s*\(\s*\{([\s\S]*?)\}\s*\)/g)) {
    if (!/\bdestWidth\b/.test(match[1]) || !/\bdestHeight\b/.test(match[1])) {
      problem(`${name} 的 wx.canvasToTempFilePath 必须显式传入 destWidth 与 destHeight，避免离屏 1px canvas 导出残图`);
    }
  }
}

const app = JSON.parse(readFileSync(path.join(root, "app.json"), "utf8"));
if (app.tabBar?.custom) {
  for (const ext of ["js", "json", "wxml", "wxss"]) {
    const file = path.join(root, `custom-tab-bar/index.${ext}`);
    if (!existsSync(file)) problem(`tabBar.custom 为 true 时缺少 custom-tab-bar/index.${ext}`);
  }
  const customTabBarJsonPath = path.join(root, "custom-tab-bar/index.json");
  if (existsSync(customTabBarJsonPath)) {
    const customTabBarJson = JSON.parse(readFileSync(customTabBarJsonPath, "utf8"));
    if (!customTabBarJson.component) problem("custom-tab-bar/index.json 必须声明 component: true");
  }
}
const pages = readdirSync(path.join(root, "pages"), { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => `pages/${entry.name}/${entry.name}`);

for (const page of app.pages) {
  if (!pages.includes(page)) problem(`app.json 注册的页面不存在：${page}`);
  for (const ext of ["js", "json", "wxml", "wxss"]) {
    if (!existsSync(path.join(root, `${page}.${ext}`))) problem(`缺少文件 ${page}.${ext}`);
  }
}
for (const page of pages) if (!app.pages.includes(page)) problem(`页面未在 app.json 注册：${page}`);

for (const page of pages) {
  const wxml = readFileSync(path.join(root, `${page}.wxml`), "utf8");
  const js = readFileSync(path.join(root, `${page}.js`), "utf8");
  const config = JSON.parse(readFileSync(path.join(root, `${page}.json`), "utf8"));
  checkMarkup(page + ".wxml", wxml);
  for (const match of wxml.matchAll(/(?:bind|catch):?(?:tap|input|confirm|blur|change|longpress|touchstart|touchmove|touchend|touchcancel)="([^"{}]*)"/g)) {
    const handler = match[1].split(":").pop();
    if (handler && !new RegExp(`\\b${handler}\\s*\\(`).test(js)) problem(`${page}.wxml 绑定的 ${handler} 在页面脚本中不存在`);
  }
  for (const component of new Set([...wxml.matchAll(/<(rr-[a-z-]+)/g)].map(m => m[1]))) {
    if (!config.usingComponents?.[component]) problem(`${page}.wxml 使用 ${component} 但未在 usingComponents 声明`);
  }
}

// Component scroll views have their own WXML files and follow the same hidden-scrollbar rule.
for (const name of readdirSync(path.join(root, "components"), { recursive: true })) {
  if (!name.endsWith(".wxml")) continue;
  const wxml = readFileSync(path.join(root, "components", name), "utf8");
  checkMarkup("components/" + name, wxml);
  if (wxml.includes("<scroll-view")) {
    const wxssPath = path.join(root, "components", name.replace(/\.wxml$/, ".wxss"));
    const wxss = existsSync(wxssPath) ? readFileSync(wxssPath, "utf8") : "";
    if (!/::-webkit-scrollbar/.test(wxss)) problem(`components/${name.replace(/\.wxml$/, ".wxss")} 必须隐藏 scroll-view 视觉滑动块`);
  }
}
const appWxss = readFileSync(path.join(root, "app.wxss"), "utf8");
if (!/(?:^|[\s,}]) ::-webkit-scrollbar|^\s*::-webkit-scrollbar/m.test(appWxss)) {
  problem("app.wxss 必须声明全局 ::-webkit-scrollbar 隐藏所有页面滑动块");
}

// 原生与网页端用同一份计时模型；直接打开小程序目录也能复现已提交的构建。
const timerBuild = spawnSync(process.execPath, [path.join(root, "tools/build-timer.mjs"), "--check"], { encoding: "utf8" });
if (timerBuild.status !== 0) problem(timerBuild.stderr.trim() || "原生计时模块校验失败");
const catalog = require(path.join(root, "utils/catalog.js"));
const format = require(path.join(root, "utils/format.js"));
const { IMPORTED_PAPERS } = await import(path.join(repo, "src/data/imported-papers.js"));

if (format.score(2595) !== "25.95") problem("分数格式化不正确");
if (format.score(10000) !== "100") problem(`满分应省略多余零：${format.score(10000)}`);
if (format.score(2590) !== "25.9") problem(`一位小数应省略末尾零：${format.score(2590)}`);
if (format.scoreCard(50) !== "0.50") problem("成绩卡按设计稿固定显示两位小数");
if (format.percent(0.2595) !== "26%") problem(`百分比格式化不正确：${format.percent(0.2595)}`);

const groups = catalog.groupByInstitution(IMPORTED_PAPERS.map(item => ({ ...item, id: `${item.id}:v1`, status: "published", questionCount: item.answerKey.length })));
if (!groups.length) problem("机构分组为空");
for (const group of groups) if (!group.projects.length) problem(`${group.name} 没有期数分组`);

// 模拟安卓微信精简 V8（无 Intl、无 ES2021+ 原型方法），确保所有入口模块加载期不报错并完成注册。
function verifyAndroidRuntimeBoot() {
  const store = new Map();
  const wxMock = {
    getStorageSync: key => store.get(key),
    setStorageSync: (key, value) => store.set(key, value),
    removeStorageSync: key => store.delete(key),
    getAccountInfoSync: () => ({ miniProgram: { envVersion: "release" } }),
    getWindowInfo: () => ({ statusBarHeight: 24, windowWidth: 360, screenTop: 0 }),
    getMenuButtonBoundingClientRect: () => ({ top: 30, height: 32, left: 260 }),
    loadFontFace: () => {},
    request: () => {},
  };
  const runEntry = (relPath, expectedGlobal) => {
    let registered = 0;
    const context = vm.createContext({
      console, setTimeout, clearTimeout, setInterval, clearInterval,
      wx: wxMock,
      App: () => { if (expectedGlobal === "App") registered += 1; },
      Page: () => { if (expectedGlobal === "Page") registered += 1; },
      Component: () => { if (expectedGlobal === "Component") registered += 1; },
      getApp: () => ({ globalData: { versions: [] } }),
    });
    vm.runInContext(
      "Object.defineProperty(globalThis, 'Intl', { value: undefined, configurable: true, writable: true }); delete Array.prototype.at; delete String.prototype.replaceAll;",
      context,
    );
    const cache = new Map();
    const loadModule = targetPath => {
      const abs = path.resolve(targetPath);
      if (cache.has(abs)) return cache.get(abs).exports;
      const mod = { exports: {} };
      cache.set(abs, mod);
      const source = readFileSync(abs, "utf8");
      const wrapper = vm.runInContext(
        `(function(exports, require, module, __filename, __dirname){\n${source}\n})`,
        context,
        { filename: abs },
      );
      wrapper(mod.exports, request => loadModule(path.resolve(path.dirname(abs), request)), mod, abs, path.dirname(abs));
      return mod.exports;
    };
    try {
      loadModule(path.join(root, relPath));
      if (registered !== 1) problem(`安卓无 Intl 沙箱加载 ${relPath} 未完成 ${expectedGlobal} 注册`);
    } catch (error) {
      problem(`安卓无 Intl 沙箱加载 ${relPath} 失败：${error.message}`);
    }
  };

  runEntry("app.js", "App");
  for (const page of app.pages) runEntry(`${page}.js`, "Page");
  for (const entry of readdirSync(path.join(root, "components"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    runEntry(`components/${entry.name}/${entry.name}.js`, "Component");
  }
  if (app.tabBar?.custom && existsSync(path.join(root, "custom-tab-bar/index.js"))) {
    runEntry("custom-tab-bar/index.js", "Component");
  }
}

verifyAndroidRuntimeBoot();

console.log(process.exitCode ? "检查未通过" : `检查通过：${pages.length} 个页面，${groups.length} 个机构`);
