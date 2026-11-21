# 卷卷小榜 · 页面与组件

[体验原型](index.html?design=paper-cards-1114-v3&assets=8737887c490c) · [独立手机页面](app.html?design=paper-cards-1114-v3&fresh=1) · [交互 GIF](motion/interaction-current.gif?v=8737887c490c)

白色、深灰与局部浅珊瑚粉贯穿各页。首页卷卡使用花生的浅杏色、超格的浅橙色；估分与分享使用淡珊瑚色，机构入口与逐题对照保持白底。中文使用本地阿里妈妈方圆体VF，英文和数据使用Nunito，展示数字使用Fraunces。最近练习的上下邻卡带透视弯转，前卡保持平展；按钮保持成熟组件的表面与短促按压。

## 页面与行为

<!-- 原页面仅连接固定设计数据；当前地址已接入同源核分和四项业务模块，说明按实际行为更新。 -->
| 页面 | 内容与操作 |
| --- | --- |
| 首页 | 三张最近练习上下切换，整卡继续或看成绩；机构使用本稿绘制的 SVG 标识，进入后记住各自期数。首次使用直接选择机构。 |
| 机构套卷 | 具名套卷选择与双列卷卡，兼容有期数和无期数的系列；新卷直接录入、草稿直接续录、已提交直接看成绩。返回保留期数与位置。 |
| 录答案 | 按已发布版本呈现实际题量，支持 120／130／135 题；新答自动定位下一题，回改保留位置，草稿恢复，提交后由服务核分。 |
| 成绩 | 真实总分、正误和同卷位置、板块雷达；二刷 VS、多刷曲线、文字／照片评论、自动链接、点赞与回复、答案反馈与试算。重练保留旧成绩。 |
| 分享 | 总分、完整试卷身份、六大板块得分率与同卷名次；可保存 900 × 1440 PNG。 |
| 逐题对照 | 答案列头和当前题型；可筛选错题或对应板块，无错题时禁用复制。切换保持键盘焦点，返回原报告。 |
| 练习榜 | 原有前三名纸卡、头像和连续列表；真实参与人数与分数、全国／个人岗位／其他岗位范围、动态题型、参与和撤回。 |
| 练习记录 | 个人选岗与提醒、成长分析入口、历史查询、真实成绩与订正通知；同卷多次作答分别保留。 |
| 成长分析 | 按评分规则分组的整体和题型趋势、跨机构套卷、时间与来源筛选、曲线及逐次数据表。 |
| 反馈审核 | 维护者凭证、待审核数量、批量核对、确认订正与重算、处理记录和通知。 |

常驻导航为首页和练习记录。同卷榜、错题复盘和分享围绕当前答卷展开。开始、续录和查看成绩采用同一状态判断；页面及浏览器返回恢复实际来源。好友链接只包含套卷身份，接收者打开自己的对应记录或空白答卷。

## 真实使用的组件

[beUI](https://beui.dev/) 的 Card、CardHeader、CardContent、CardFooter、Button、Tabs、BottomSheet、TiltCard、Avatar、AnimatedBadge、Input 与 NumberTicker 在实际页面中调用。Card 负责槽位和按压，Button 用于主次操作与录答选项，Tabs 保留键盘与选择指示器，BottomSheet 负责拖动、Escape、焦点约束与关闭恢复。业务状态仍由现有模块维护。Base UI 的 Progress 和 ScrollArea 补充进度与完整历史浏览，基础 Card、Button 等继续使用 beUI。

官方源码按 MIT 许可保留；出处、版本与 SHA 见 [原有组件清单](ui/beui-sources.json)、[表面与弹层清单](ui/modern-component-sources.json)及[本轮组件清单](ui/refined-component-sources.json)。只在 `ui/` 隔离 React、Motion 与编译输出。

参考 [BoardUI](https://www.boardui.com/components) 的信息层级与状态，[Fluid Functionalism](https://www.fluidfunctionalism.com/docs) 的反馈节奏，[Watermelon UI](https://ui.watermelon.sh/components/card) 与 [HeroUI Pro](https://v2.heroui.pro/components/application/cards) 的卡片组合，以及 [ThreeUI](https://threeui.com/browse) 的真实三维材质。这些是已查看的设计参考，未将它们全部安装进工程；HeroUI Pro 只查看公开演示。

各板块满分不同，以 Progress 的统一比例条比较，并保留原始得分／满分。估分页使用连续条目，分享页用单张白边、立体厚边的卡面承载六条得分率图，避免重复彩色底座。榜单前三名使用 Card 和 TiltCard 组合成有厚度的成绩卡；全员使用本地 SVG 头像，准确分数保留为可读文字。分享 PNG 由同一 React 成绩单的静态模式生成，尺寸为 900 × 1440。

中文与数据的[字体来源和授权](assets/fonts/sources.json)随字体保存。产品 [Logo 原图](assets/brand/rollierank-logo-v4.png)由内置 imagegen 生成，以错落卷页和卷边表达纸卷。透明 PNG、256px 页面版本及 64px favicon 均保留；[最终提示词](assets/brand/rollierank-v4-prompt.txt)和[生成记录](assets/brand/rollierank-v4-source.json)可核对。通用功能图标与本轮机构标识使用 SVG；花生和超格识别图形为本稿绘制，[来源记录](assets/logo-sources.json)可核对。Fraunces 来自 Google Fonts，OFL 许可保存在 fonts 目录。分享卡的[原创奖杯插画](assets/illustrations/score-keepsake-v1.png)由内置 imagegen 单独生成，[提示词](assets/illustrations/score-keepsake-v1-prompt.txt)与[来源记录](assets/illustrations/score-keepsake-v1-source.json)随图保存。

## 本机检查

```sh
node --check docs/ui-exploration/ios-v3/app.js
npm --prefix docs/ui-exploration/ios-v3/ui run typecheck
npm --prefix docs/ui-exploration/ios-v3/ui run test:bridge
npm --prefix docs/ui-exploration/ios-v3/ui run test:ui-data
node --test docs/ui-exploration/ios-v3/practice-model.test.mjs
```

组件变更后，在 `ui/` 运行 `npm run build` 更新 vendor 文件。该界面现通过同源 API 使用真实核分、选岗、讨论、分析和审核服务。预览地址继续为 `http://127.0.0.1:4781/ios-v3/`；启动方式为：

```sh
npm run dev:ios
```

初次打开只展示真实套卷，已有真实练习与草稿继续恢复。已知设计样例迁到浏览器可恢复档案。完成本卷练习并提交后，系统自动计分，即可使用真实成绩讨论、排行和纠错。外层页面切换不再清空用户记录。

Excel 解析可使用项目的 `.local/positions-python` 环境，服务会自动识别；也可用 `POSITIONS_PYTHON` 指定其他已安装依赖的解释器。安装方法见根目录的岗位导入说明。

维护者审核需在启动时配置 `ROLLIERANK_REVIEW_TOKEN`，未配置时显示审核未启用。微信身份与正式小程序回流仍未接入。服务数据位于项目的 `.local/catalog.json`，浏览器草稿与本机凭证保留在当前地址的本地存储中。

完整验证使用实际外层页面、iframe、正式启动脚本和真实 API：

```sh
python3 scripts/verify-ios-features.py
python3 scripts/verify-ios-features.py --base http://127.0.0.1:4781 --check-only
```

需要 Playwright 与 Chromium。完整流程使用临时端口和数据目录；已有服务只执行只读入口检查。

## 本轮视觉参考

[Easy Lang](https://dribbble.com/shots/27152189-Easy-Lang-learning-app)用于字体与单张主卡的阅读顺序；[Illustrated Cards Feed](https://dribbble.com/shots/27741997-Illustrated-Cards-Feed-Mobile-UI-Design)用于上下曲转的卡片关系；[Seenery](https://www.behance.net/gallery/198313669/Seenery-A-Road-Trip-Card-Game-Card-Box-App-Design)用于分享卡的实物边框和线稿组织。原作品图像未作为产品贴图使用。

目录使用已有机构、系列和试卷身份：花生保留期次与地市／副省，超格、粉笔和上岸村按系列与实际卷名展示。只有一个系列时直接显示试卷。原有数字选择键映射到已发布版本，实际分值和参考答案由同一核分服务维护。

榜单头像使用 [DiceBear Lorelei](https://www.dicebear.com/styles/lorelei/) 的本地 SVG，作者 Lisa Wischofsky，CC0 1.0；[头像来源记录](assets/avatars/sources.json)保留每张图的地址与摘要。能力雷达采用 Chart.js 4.6.1，按各板块得分／满分归一到 0–100%。

判断推理由图形、定义、类比、逻辑四项合计，得分率为合计得分／合计满分。当前样例17.8／28.5，约62.5%；雷达、报告、分享和榜单统一按此六大板块展示。报告保留较小的原始分值，分享以得分率图为主，总分和排名仍为重点。练习记录沿用同套纸卡、头像与大分数设计。

首页提供独立计时：选择套卷或自定义，再开始整卷或按模块记录。单题录答支持左右滑题、选择后自动下一题，列表和单题均可标记。正式成绩自动上榜，多次取最高；复盘直接显示全国答对率和同错率。分享四种图自动适配，评论输入使用轻量编辑条。
