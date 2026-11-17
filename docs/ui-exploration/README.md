# 卷卷小榜移动端界面

当前界面采用 `paper-cards-1114-v3` 纸卡主题。入口为 [交互预览](ios-v3/index.html?design=paper-cards-1114-v3)，各页面、组件、素材和启动方法见 [界面说明](ios-v3/README.md)。

界面以米白纸面、墨色正文、浅杏色成绩卡和局部珊瑚色状态呈现。中文使用阿里妈妈方圆体，数据使用 Nunito，展示分数使用 Fraunces。移动端保留主要数据和动作，筛选、计分规则与评论通过面板展开。

本机启动：

```sh
npm run dev:ios
```

打开 `http://127.0.0.1:4781/ios-v3/?design=paper-cards-1114-v3`。当前截图保存在 [screens/ios-refinement-2](ios-v3/screens/ios-refinement-2/)，交互动画为 [interaction-b94c64753f8c.gif](ios-v3/motion/interaction-b94c64753f8c.gif)。

重新截取页面后更新预览资源标识：

```sh
npm --prefix docs/ui-exploration/ios-v3/ui run preview:assets
```

完整功能与视觉验证运行 `npm run verify -- all`，验证入口见 [项目验证技能](../../.agents/skills/verify-rollierank/SKILL.md)。
