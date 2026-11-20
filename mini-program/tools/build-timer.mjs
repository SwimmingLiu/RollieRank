import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const require = createRequire(new URL("docs/ui-exploration/ios-v3/ui/package.json", root));
const { build } = require("esbuild");
const output = new URL("mini-program/vendor/practice-timer.js", root);

// 开发者工具直接打开小程序目录，所以提交可直接运行的原稿计时模块。
const result = await build({
  absWorkingDir: fileURLToPath(root),
  stdin: {
    contents: `
      export {
        createPracticeTimer, createCustomPracticeTimer, restorePracticeTimer, resolveTimerLimit,
        timerSectionsForQuestions, timerView, setTimerMode, changeTimerPlan, balanceTimerModules,
        reorderTimerModules, startPracticeTimer, pausePracticeTimer, switchTimerModule,
        finishPracticeTimer, bindPracticeTimer, resumeEntryTimer, pauseEntryTimer, timingSummary, formatElapsed,
      } from "./src/practice-timer.js";
      export { timerCollections, timerPaperTitle, timerPaperSearchText } from "./docs/ui-exploration/ios-v3/ui/timer-paper-model.ts";
    `,
    resolveDir: fileURLToPath(root),
  },
  bundle: true,
  write: false,
  format: "cjs",
  target: "es2020",
  define: { structuredClone: "copyTimerData" },
  banner: { js: "// 由 mini-program/tools/build-timer.mjs 生成。计时数据是由数字、文本和普通对象构成的快照。\nfunction copyTimerData(value) { return JSON.parse(JSON.stringify(value)); }" },
});
const content = result.outputFiles[0].text;

if (process.argv.includes("--check")) {
  if (await readFile(output, "utf8") !== content) {
    throw new Error("计时原稿已变更，请运行 npm --prefix mini-program run build:timer 更新原生计时模块。");
  }
} else {
  await mkdir(new URL("./", output), { recursive: true });
  await writeFile(output, content);
}
