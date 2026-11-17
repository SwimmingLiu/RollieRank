# 行测小助理 — 小程序全页面扒包报告

- AppID: `wxd74bddd3fe422729`
- 包版本: **v78**
- 页面数: 18（无分包）
- 入口: `pages/index/index.html`
- 导航标题: 行测小助理

> 本文件由 `tools/gen-pages.py` 从 `source/app-service.js` 的 `Page()` 定义自动生成，
> 覆盖全部 18 个页面的 data 默认值与方法清单。
> 交互截图见 `screenshots/`，设计分析见 `UI-DESIGN.md`，版本变更见 `CHANGELOG-v76-to-v78.md`。

## 阅读顺序建议

1. 先看 `UI-DESIGN.md` 的「视觉语言」和「可复用的交互模式」两节 —— 建立整体印象
2. 再看下面「页面清单」了解全貌
3. 需要具体实现细节时，按页面查 data 字段与 methods
4. `source/app-service.js` 里搜 `__wxRoute = 'pages/xxx/xxx'` 可以定位到该页的完整实现

## 页面清单

| # | 路由 | 标题 |
|---|---|---|
| 1 | `pages/index/index` | — |
| 2 | `pages/support/support` | 支持开发者 |
| 3 | `pages/exam/exam` | 正在答题 |
| 4 | `pages/result/result` | — |
| 5 | `pages/set-history/set-history` | — |
| 6 | `pages/timer-setup/timer-setup` | 备考计时器 |
| 7 | `pages/timer-records/timer-records` | 本地计时记录 |
| 8 | `pages/timer/timer` | 备考计时器 |
| 9 | `pages/timer-report/timer-report` | 训练分析报告 |
| 10 | `pages/letter/letter` | — |
| 11 | `pages/user-list/user-list` | 所有用户 |
| 12 | `pages/admin/report-list/report-list` | 错误反馈列表 |
| 13 | `pages/math-tools/menu/menu` | 数学计算 |
| 14 | `pages/math-tools/percentage/percentage` | 百化分训练 |
| 15 | `pages/percentage-result/percentage-result` | 练习结果 |
| 16 | `pages/fb-tool/fb-tool` | FB排版工具获取 |
| 17 | `pages/idiom/idiom` | 官媒搜索 |
| 18 | `pages/idiom-reader/idiom-reader` | 阅读正文 |

## 逐页结构与数据

### `pages/index/index`

- 标题: （无）
- window: `{"enablePullDownRefresh": true}`
- data 字段 (34): `questionBankEnabled`, `supportDeveloperEnabled`, `supportDeveloperButtonText`, `answerCardDownloading`, `categories`, `categoryLimit`, `hasMoreCategories`, `activeCategory`, `periods`, `floatingPoints`, `expandedExams`, `cloudExams`, `activeLibrary`, `showMotivationOverlay`, `motivationTitle`, `motivationParagraphs`, `motivationAudioUrl`, `motivationAudioLocalPath`, `isMotivationAudioPlaying`, `motivationScrollIntoView`, `motivationContentHeightPx`, `wheelImagePath`, `wheelSizePx`, `wheelRotation`, `wheelTransitionMs`, `isPredictingScore`, `showSmsBanner`, `smsTopPx`, `statusBarPx`, `navBarPx`, `navHeightPx`, `smsTitle`, `smsBodyLine1`, `smsBodyLine2`
- 方法 (58): onSupportDeveloperTap, filterCategories, onLoadMoreCategories, onCollapseCategories, onSwitchLibrary, noop, onLoad, refreshCatalog, onPullDownRefresh, preloadFirstExamLeaderboard, onLetterTap, onShow, onUnload, initWheelSize, computeNavMetrics, computeSmsTop, initMotivationAudio, refreshMotivationAudioUrl, ensureMotivationAudioLocalPath, maybeShowMotivationOverlay, openMotivationOverlay, closeMotivationOverlay, ensureWheelImageReady, drawScoreWheel, vibrateDoubleStrong, onPredictScoreTap, showSmsNotification, onMotivationFabTap, onMotivationMaskTap, onMotivationCloseTap, playMotivationAudio, onMotivationToggleAudioTap, loadHistoryForPeriods, onToggleExamExpand, onGlobalClick, onCategoryTap, onMathToolsTap, onTimerSetupTap, onFbToolTap, onIdiomTap, onExamTap, closeAnswerChoice, onDownloadChoiceAnswerCard, hideAnswerCardLoading, onHide, keepAnswerChoiceOpen, onManualAnswer, onScanAnswer, openChosenExam, onBtnTouchStart, onHistoryScoreTap, onGetMaterialTap, onMaterialModalClose, onShareAppMessage, onShareTimeline, onAuthorLongPress, showAdminMenu, exportStaticData

默认值:
```json
{
 "supportDeveloperButtonText": "打赏开发者",
 "answerCardDownloading": false,
 "categories": [],
 "categoryLimit": 3,
 "hasMoreCategories": false,
 "activeCategory": null,
 "periods": [],
 "floatingPoints": [],
 "expandedExams": {},
 "cloudExams": [],
 "activeLibrary": "peanut",
 "showMotivationOverlay": false,
 "motivationTitle": "致决战省考的你：",
 "motivationParagraphs": [
  "<5 items>"
 ],
 "motivationAudioUrl": "",
 "motivationAudioLocalPath": "",
 "isMotivationAudioPlaying": false,
 "motivationScrollIntoView": "",
 "motivationContentHeightPx": 520,
 "wheelImagePath": "",
 "wheelSizePx": 0,
 "wheelRotation": 0,
 "wheelTransitionMs": 0,
 "isPredictingScore": false,
 "showSmsBanner": false,
 "smsTopPx": 0,
 "statusBarPx": 24,
 "navBarPx": 44,
 "navHeightPx": 64,
 "smsTitle": "【公务员平台】",
 "smsBodyLine1": "同学你好，你以160分（第一名）的成绩入围面试，",
 "smsBodyLine2": "请于3.25日前确认你是否参加面试。"
}
```

### `pages/support/support`

- 标题: 支持开发者
- data 字段 (16): `loading`, `available`, `testBuild`, `notice`, `products`, `selectedId`, `selectedPrice`, `checkingOrder`, `retryAvailable`, `busy`, `isIOS`, `isSimulator`, `paymentFailureCode`, `paymentFailureDetail`, `paymentFailureHint`, `receipt`
- 方法 (9): onLoad, onShow, copyTestOpenId, copyPaymentDiagnostic, chooseProduct, pay, checkOrder, refreshOrder, clearPendingOrder

默认值:
```json
{
 "loading": true,
 "available": false,
 "testBuild": false,
 "notice": "赞赏暂未开放。",
 "products": [],
 "selectedId": "",
 "selectedPrice": "",
 "checkingOrder": false,
 "retryAvailable": false,
 "busy": false,
 "isIOS": false,
 "isSimulator": false,
 "paymentFailureCode": "",
 "paymentFailureDetail": "",
 "paymentFailureHint": "",
 "receipt": ""
}
```

### `pages/exam/exam`

- 标题: 正在答题
- window: `{"backgroundTextStyle": "dark", "enablePullDownRefresh": true}`
- data 字段 (38): `dataReady`, `scanSupported`, `scanMessage`, `reviewMap`, `reviewQuestions`, `isSubmitting`, `answerCardDownloading`, `answeredCount`, `blankCount`, `editQuestion`, `gridScrollInto`, `entryMode`, `scanStage`, `scanAdStage`, `scanAdError`, `scanner`, `scanStructureKey`, `examId`, `title`, `mainTitle`, `subTitle`, `structure`, `currentSectionIndex`, `currentQuestions`, `answers`, `totalQuestions`, `showConfirmModal`, `windowHeight`, `cloudExamData`, `mode`, `currentGlobalIndex`, `singleCurrentQuestion`, `isSheetVisible`, `allQuestions`, `swiperCurrent`, `listScrollTop`, `sheetHeight`, `isDragging`
- 方法 (60): onLoad, loadExamData, rebuildStructureFromCloud, mountContinuousScanner, fitScannerGuide, disposeLiveScanner, onLiveCameraReady, onLiveCameraError, pauseLiveScan, toggleScanTorch, captureScanPhoto, copyScanPhotoDiagnostics, changeScanCaptureMode, resumeLiveScan, useSystemScanCamera, onDownloadAnswerCard, hideAnswerCardLoading, agreeLivePrivacy, rejectLivePrivacy, openLivePrivacy, livePermissionsChanged, updateAnswerCounts, useManual, editAnswer, closeEditor, keepEditorOpen, editOption, editBlank, openScanner, cancelScanner, onScanComplete, onShow, onHide, onUnload, resetScanSubmitAd, scanSubmissionUnlocked, resolveReview, leaveBlank, onReviewTap, generateQuestions, toggleMode, onSectionTap, onPrevSection, onNextSection, switchSection, onOptionTap, onSingleOptionTap, toggleSheet, onSwiperChange, onNextSingle, onSheetItemTap, hasCompleteAnswerKey, onSubmitTap, calculateAndFinish, onDragStart, onDragMove, onDragEnd, onShareAppMessage, onShareTimeline, onPullDownRefresh

默认值:
```json
{
 "dataReady": false,
 "scanSupported": false,
 "scanMessage": "",
 "reviewMap": {},
 "reviewQuestions": [],
 "isSubmitting": false,
 "answerCardDownloading": false,
 "answeredCount": 0,
 "blankCount": 0,
 "editQuestion": null,
 "gridScrollInto": "",
 "entryMode": "manual",
 "scanStage": false,
 "scanAdStage": "idle",
 "scanAdError": "",
 "scanner": "{...}",
 "scanStructureKey": "",
 "examId": "",
 "title": "",
 "mainTitle": "",
 "subTitle": "",
 "structure": [],
 "currentSectionIndex": 0,
 "currentQuestions": [],
 "answers": {},
 "totalQuestions": 0,
 "showConfirmModal": false,
 "windowHeight": 0,
 "cloudExamData": null,
 "mode": "list",
 "currentGlobalIndex": 1,
 "singleCurrentQuestion": "{...}",
 "isSheetVisible": true,
 "allQuestions": [],
 "swiperCurrent": 0,
 "listScrollTop": 0,
 "sheetHeight": 350,
 "isDragging": false
}
```

### `pages/result/result`

- 标题: （无）
- data 字段 (58): `score`, `correctCount`, `wrongCount`, `unansweredCount`, `totalQuestions`, `sectionResults`, `historySaved`, `saveStatus`, `detailsUnavailable`, `resultPanel`, `radarReady`, `radarBands`, `radarBand`, `radarLabels`, `radarImage`, `sharePreviewOpen`, `shareStyles`, `shareStyle`, `sharePreviewPath`, `sharePreviewState`, `shareSaving`, `radarSample`, `radarReference`, `radarHasReference`, `radarUnavailable`, `leaderboardList`, `leaderboardLoading`, `leaderboardLoadError`, `rankLoadError`, `showFullLeaderboard`, `currentUserOpenId`, `currentUserProfile`, `showLoginModal`, `tempAvatar`, `tempNickname`, `showDetailModal`, `selectedUser`, `currentDetailIndex`, `examTitle`, `mainTitle`, `subTitle`, `percent`, `canvasWidth`, `canvasHeight`, `showReportModal`, `reportDesc`, `rank`, `totalSubmissions`, `hasCalculatedRank`, `isAdvancedMode`, `questionStats`, `sectionCollapsed`, `rawStats`, `filteredQuestionStats`, `currentScoreFilter`, `fullQuestionStats`, `scoreFilterOptions`, `rankStatsRepairTried`
- 方法 (47): onFilterChange, recalcStats, setAdvancedMode, toggleAdvancedMode, onViewModeTap, onResultPanelTap, onRadarBandTap, refreshAbilityRadar, removeRadarImage, onResize, toggleSection, loadQuestionStats, onReportError, onCloseReportModal, onReportInput, onContactInput, onSubmitReport, onSaveImage, onShareStyleTap, retrySharePreview, closeSharePreview, releaseSharePreview, showFullSharePreview, saveSharePreview, generateShareImage, copyDiagnostics, absorbPreviewTouch, onHide, onUnload, onMemoryPressure, roundRect, onLoad, retryHistorySave, onShow, loadLeaderboard, formatDate, handleProfileUpdate, onProfileUpdate, calculateRankPercent, retryRankingLoad, applyRankSnapshot, updateLocalCache, showUnavailableHistory, calculateScore, onHomeTap, onShareAppMessage, onShareTimeline

默认值:
```json
{
 "score": 0,
 "correctCount": 0,
 "wrongCount": 0,
 "unansweredCount": 0,
 "totalQuestions": 0,
 "sectionResults": [],
 "historySaved": false,
 "saveStatus": "",
 "detailsUnavailable": false,
 "resultPanel": "ability",
 "radarReady": false,
 "radarBands": [],
 "radarBand": null,
 "radarLabels": [],
 "radarImage": "",
 "sharePreviewOpen": false,
 "shareStyle": "long",
 "sharePreviewPath": "",
 "sharePreviewState": "",
 "shareSaving": false,
 "radarSample": "",
 "radarReference": "",
 "radarHasReference": false,
 "radarUnavailable": "",
 "leaderboardList": [],
 "leaderboardLoading": false,
 "leaderboardLoadError": false,
 "rankLoadError": false,
 "showFullLeaderboard": false,
 "currentUserOpenId": "",
 "currentUserProfile": null,
 "showLoginModal": false,
 "tempAvatar": "",
 "tempNickname": "",
 "showDetailModal": false,
 "selectedUser": null,
 "currentDetailIndex": -1,
 "examTitle": "",
 "mainTitle": "",
 "subTitle": "",
 "percent": null,
 "canvasWidth": 385,
 "canvasHeight": 667,
 "showReportModal": false,
 "reportDesc": "",
 "rank": null,
 "totalSubmissions": null,
 "hasCalculatedRank": false,
 "isAdvancedMode": true,
 "questionStats": null,
 "sectionCollapsed": {},
 "rawStats": [],
 "filteredQuestionStats": null,
 "currentScoreFilter": 0,
 "fullQuestionStats": null,
 "rankStatsRepairTried": false
}
```

### `pages/set-history/set-history`

- 标题: （无）
- data 字段 (16): `title`, `examId`, `historyList`, `loading`, `leaderboardList`, `leaderboardLoading`, `leaderboardLoadError`, `currentUserOpenId`, `currentUserProfile`, `fullRankList`, `totalExamCount`, `historyOffset`, `hasMoreHistory`, `loadingMore`, `deletingRecordId`, `deleteError`
- 方法 (19): onLoad, onUnload, onShow, initPageData, loadRankingData, retryRankingLoad, fetchHistoryList, fetchLeaderboardData, onLoadMoreHistory, calculateHistoryRanks, onPullDownRefresh, onRecordTap, navigateToResult, copyDiagnostics, visibleHistory, onDeleteRecord, patchLeaderboardList, handleProfileUpdate, onProfileUpdate

默认值:
```json
{
 "title": "答题记录",
 "examId": "",
 "historyList": [],
 "loading": true,
 "leaderboardList": [],
 "leaderboardLoading": false,
 "leaderboardLoadError": false,
 "currentUserOpenId": "",
 "currentUserProfile": null,
 "fullRankList": [],
 "totalExamCount": 0,
 "historyOffset": 0,
 "hasMoreHistory": true,
 "loadingMore": false,
 "deletingRecordId": "",
 "deleteError": ""
}
```

### `pages/timer-setup/timer-setup`

- 标题: 备考计时器
- window: `{"navigationBarBackgroundColor": "#2C3E50", "navigationBarTextStyle": "white", "backgroundColor": "#F5F7FA"}`
- data 字段 (15): `maxModules`, `modules`, `isDragging`, `dragIndex`, `targetIndex`, `movableAreaHeight`, `itemHeightPx`, `totalTime`, `presets`, `showNameModal`, `presetNameDraft`, `showAddModal`, `moduleNameDraft`, `defaultMode`, `displayModes`
- 方法 (39): onShareAppMessage, onShareTimeline, onLoad, onLocalRecords, onReady, onUnload, initRewardedVideoAd, noop, generatePresetName, onSavePreset, onPresetNameInput, onCancelNameModal, onConfirmNameModal, calculateItemHeight, initModules, calculateTotalTime, saveModules, updateModulesPosition, onManualDragStart, onManualDragMove, onManualDragEnd, onSliderChange, onSliderChanging, increaseTime, decreaseTime, updateDuration, fetchPresets, savePresetToCloud, onApplyPreset, onDeletePreset, deleteModule, showAddModuleModal, showLetterModal, closeLetterModal, onModuleNameInput, onCancelAddModal, onConfirmAddModal, onModeSelect, startTimer

默认值:
```json
{
 "maxModules": 15,
 "modules": [],
 "isDragging": false,
 "dragIndex": -1,
 "targetIndex": -1,
 "movableAreaHeight": 0,
 "itemHeightPx": 0,
 "totalTime": 0,
 "presets": [],
 "showNameModal": false,
 "presetNameDraft": "",
 "showAddModal": false,
 "moduleNameDraft": "",
 "defaultMode": 2,
 "displayModes": [
  "<3 items>"
 ]
}
```

### `pages/timer-records/timer-records`

- 标题: 本地计时记录
- window: `{"navigationBarBackgroundColor": "#2C3E50", "navigationBarTextStyle": "white", "backgroundColor": "#F5F7FA"}`
- data 字段 (3): `drafts`, `reports`, `maxRecords`
- 方法 (2): onShow, onOpenRecord

默认值:
```json
{
 "drafts": [],
 "reports": []
}
```

### `pages/timer/timer`

- 标题: 备考计时器
- window: `{"pageOrientation": "landscape", "navigationStyle": "custom", "backgroundColor": "#000000"}`
- data 字段 (12): `timeStr`, `totalTimeStr`, `seconds`, `totalSeconds`, `timeDisplayMode`, `localBackupFailed`, `isRunning`, `showTip`, `timerId`, `modules`, `currentModuleIndex`, `scrollTop`
- 方法 (25): onShareAppMessage, onShareTimeline, onLoad, onShow, onHide, onUnload, startTimer, accountElapsedTime, persistBackup, switchModule, onSubmitTouchStart, onSubmitTouchEnd, handleLongPressSuccess, onSubmitTap, finishExam, openSavedReport, nextModule, scrollToModule, stopTimer, toggleTimer, updateTimeStr, onMainTap, toggleDisplayMode, cancelSubmission, preventBubble

默认值:
```json
{
 "timeStr": "00:00:00",
 "totalTimeStr": "00:00:00",
 "seconds": 0,
 "totalSeconds": 0,
 "timeDisplayMode": 2,
 "localBackupFailed": false,
 "isRunning": false,
 "showTip": false,
 "timerId": null,
 "modules": [],
 "currentModuleIndex": 0,
 "scrollTop": 0
}
```

### `pages/timer-report/timer-report`

- 标题: 训练分析报告
- window: `{"navigationBarBackgroundColor": "#2C3E50", "navigationBarTextStyle": "white", "backgroundColor": "#F5F7FA"}`
- data 字段 (14): `reportTitle`, `reportDate`, `localReportSaved`, `totalActualTime`, `totalPlannedTime`, `timeDeviation`, `deviationText`, `completionRate`, `overtimeCount`, `totalModules`, `complianceRate`, `modules`, `canvasWidth`, `canvasHeight`
- 方法 (12): onLoad, generateReport, formatTime, getTimeParts, onUnload, onHide, onMemoryPressure, onPrint, drawShadowRect, drawRoundedRect, onRestart, onEditTitle

默认值:
```json
{
 "reportTitle": "模考训练分析报告",
 "reportDate": "",
 "localReportSaved": false,
 "totalActualTime": 0,
 "totalPlannedTime": 0,
 "timeDeviation": 0,
 "deviationText": "",
 "completionRate": 0,
 "overtimeCount": 0,
 "totalModules": 0,
 "complianceRate": 0,
 "modules": [],
 "canvasWidth": 750,
 "canvasHeight": 1334
}
```

### `pages/letter/letter`

- 标题: （无）
- data 字段 (0): 
- 方法 (1): goBack

### `pages/user-list/user-list`

- 标题: 所有用户
- window: `{"enablePullDownRefresh": true, "backgroundColor": "#F9F9F9"}`
- data 字段 (5): `users`, `loading`, `page`, `pageSize`, `hasMore`
- 方法 (4): onLoad, loadUsers, onReachBottom, onPullDownRefresh

默认值:
```json
{
 "users": [],
 "loading": false,
 "page": 0,
 "pageSize": 20,
 "hasMore": true
}
```

### `pages/admin/report-list/report-list`

- 标题: 错误反馈列表
- window: `{"enablePullDownRefresh": true}`
- data 字段 (5): `reports`, `loading`, `hasMore`, `page`, `limit`
- 方法 (5): onLoad, loadReports, onPullDownRefresh, onReachBottom, onCopyContact

默认值:
```json
{
 "reports": [],
 "loading": false,
 "hasMore": true,
 "page": 0,
 "limit": 20
}
```

### `pages/math-tools/menu/menu`

- 标题: 数学计算
- data 字段 (0): 
- 方法 (1): onPercentageTap

### `pages/math-tools/percentage/percentage`

- 标题: 百化分训练
- window: `{"navigationBarBackgroundColor": "#ffffff", "navigationBarTextStyle": "black", "disableScroll": true}`
- data 字段 (14): `question`, `denominator`, `inputValue`, `logs`, `startTime`, `timeString`, `timer`, `isRunning`, `correctCount`, `totalCount`, `showHistory`, `mode`, `questionPercentage`, `questionQueue`
- 方法 (14): onLoad, onUnload, onToggleHistory, onRestart, onReversePractice, startSession, generateQuestionQueue, getQuestionPool, startTimer, stopTimer, nextQuestion, setQuestionData, onKeyTap, onSubmit

默认值:
```json
{
 "question": "",
 "denominator": 0,
 "inputValue": "",
 "logs": [],
 "startTime": 0,
 "timeString": "00:00",
 "timer": null,
 "isRunning": false,
 "correctCount": 0,
 "totalCount": 0,
 "showHistory": true,
 "mode": "forward",
 "questionPercentage": "",
 "questionQueue": []
}
```

### `pages/percentage-result/percentage-result`

- 标题: 练习结果
- window: `{"navigationBarBackgroundColor": "#ffffff", "navigationBarTextStyle": "black"}`
- data 字段 (3): `logs`, `timeString`, `score`
- 方法 (3): onLoad, onBack, onRetry

默认值:
```json
{
 "logs": [],
 "timeString": "",
 "score": 0
}
```

### `pages/fb-tool/fb-tool`

- 标题: FB排版工具获取
- data 字段 (2): `guideUrl`, `pricing`
- 方法 (2): onCopyGuide, copyFailTip

默认值:
```json
{
 "pricing": [
  "<2 items>"
 ]
}
```

### `pages/idiom/idiom`

- 标题: 官媒搜索
- data 字段 (6): `keyword`, `hots`, `loading`, `error`, `searchedWord`, `sites`
- 方法 (6): onLoad, onInput, onHotTap, onSearch, doSearch, onExampleTap

默认值:
```json
{
 "keyword": "",
 "hots": [
  "<3 items>"
 ],
 "loading": false,
 "error": "",
 "searchedWord": "",
 "sites": []
}
```

### `pages/idiom-reader/idiom-reader`

- 标题: 阅读正文
- data 字段 (10): `url`, `q`, `loading`, `loadingText`, `error`, `mode`, `title`, `html`, `encoding`, `paragraphs`
- 方法 (3): onLoad, loadText, onViewOriginal

默认值:
```json
{
 "url": "",
 "q": "",
 "loading": true,
 "loadingText": "正在加载正文…",
 "error": "",
 "mode": "text",
 "title": "",
 "html": "",
 "encoding": "utf-8",
 "paragraphs": []
}
```
