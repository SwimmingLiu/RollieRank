# 岗位模块接入

四项功能已在公共入口接入，组合流程、构建验收及运行边界见 [公共集成 PR 草稿](pr-feature-integration.md)。

## 服务端

`const handlePositions = await createPositionsService({readCatalog, mutateCatalog, dataDirectory})`，返回处理函数。调用 `await handlePositions({request,response,pathname,method,input,query,send})`，已处理返回 `true`，不匹配返回 `false`，错误带 `statusCode`。`readCatalog()` 同步返回 `{versions,receipts,audit,features}`；所有 catalog 写入仅调用同步回调 `mutateCatalog(store => result)`。

内置目录位于 `data/positions/guokao-2027.json`，工厂从服务端模块的相对路径读取。该文件及 `scripts/import-positions.py` 应随本地服务保留，不需要暴露给浏览器。`features.positions` 使用 `{members:{[guestId]:{positionId,name,attemptIds,updatedAt}},catalogs:{[sourceId]:dataset}}`，其他命名空间不会被修改。

| 接口 | 参数与结果 |
| --- | --- |
| GET `/api/positions/catalog` | `q,year,exam,region,page,pageSize`；返回 `items,total,page,pageSize,pages,facets,sources`，默认 20 条，最多 100 条。 |
| GET `/api/positions/profile` | `guestId`；返回 `positionId,position,participation:{name,attemptIds},updatedAt`。 |
| POST `/api/positions/selection` | `{guestId,positionId}`，`null` 清除选岗；返回完整 profile。 |
| POST `/api/positions/participation` | `{guestId,name,attemptIds,versionId?}`；提供 versionId 时只替换该版本的参与选择，省略时替换该身份全部参与选择。只接受服务端拥有的真实答卷 ID。 |
| POST `/api/positions/withdraw` | `{guestId}`，撤回全部公共参与，保留私人答卷和岗位。 |
| GET `/api/positions/leaderboard` | `versionId,dimension,guestId?,scope=selected\|nationwide\|position,positionId?,page,pageSize`；返回 `rows,self,count,scope,position,selectionMissing,page,pages,asOf`。 |
| POST `/api/positions/import` | `{dataset}`，原子校验与导入规范化目录。单个请求仍遵守公共 1 MB 限制。 |
| POST `/api/positions/import/start` | `{guestId,fileName,size,metadata?}`；返回 `uploadId,chunkSize`。Excel 需要 metadata，JSON 使用文件中的来源。 |
| POST `/api/positions/import/chunk` | `{guestId,uploadId,index,chunk}`，chunk 是标准 Base64，原始每块最多 192 KiB，重复同块可重试。 |
| POST `/api/positions/import/finish` | `{guestId,uploadId}`，完整解析成功后才发布。 |
| POST `/api/positions/import/cancel` | `{guestId,uploadId}`，取消未完成的上传。 |

Excel metadata 包含 `id,label,exam,year,region,publisher,sourceType,sourcePage,downloadUrl,retrievedAt`，可附 `announcementPage`。`sourceType=published` 需要来源与下载 URL；`user-file` 可留空 URL，明确显示用户提供文件，不能取得官方来源标识。新增来源 ID 不得覆盖既有目录，同年同地区同部门同编码重复也拒绝整批导入。

Excel 导入使用 `POSITIONS_PYTHON` 指定的 Python，默认 `python3`。依赖安装命令为 `python3 -m pip install -r scripts/positions-requirements.txt`。目录查询、选岗和排行榜及规范化 JSON 导入不需要 Python。文件最多 20 MB，分块过程保存在内存，15 分钟失效，最多同时 3 个上传；解析临时文件放入 dataDirectory 的 positions-imports 子目录并在完成或失败后删除。

排行榜严格按 versionId 比较，总分和题型分别取参与答卷最佳，零分有效，同分并列并跳号。每次读取当前 receipts，订正重算后无需单独刷新缓存。公共响应不含 guestId、答案或完整报告。未选岗时默认返回全国并标记 selectionMissing，所有人数都是当前服务中自愿参与的真实身份。

## 浏览器

`createPositionsFeature(ctx)` 已实现，返回 `afterRender,onRoute,beforeSubmit,afterSubmit,rankView,openPicker,openParticipation,withdraw,destroy`。个人记录及管理页分别需要 `[data-feature="positions-profile"]`、`[data-feature="positions-admin"]`。CSS 从 `src/features/positions.css` 接入。工厂在 document 注册一次专用委托事件，重复渲染不重复注册，`destroy()` 解除监听。

公共入口需导入 `createPositionsFeature` 并将实例加入 features，CSS 加入 `@import url("./src/features/positions.css")`。`rankView` 将替代旧演示榜；`onRoute` 从其他页面进入排行时默认选择个人岗位。`openPicker()` 打开个人选岗，`openPicker("browse")` 只浏览其他岗位榜。`openParticipation()` 可替换已有的同卷参与弹窗；`withdraw()` 同步撤回全部参与并刷新视图，也可在退出身份时直接使用对应服务接口。

`await beforeSubmit()` 应在正式 API 提交及切换提交按钮状态之前调用，返回 false 时结束本轮提交。选岗提示的继续按钮会再次调用 `ctx.submitAttempt()`，原提交弹窗已经被替换，因此提交函数应允许 `#submit-attempt`、`#submit-error` 和 `#participate-submit` 不存在。模块会记住进入选岗提示前的参与勾选并在 `afterSubmit` 同步。`afterSubmit(attempt)` 应在保存服务端答卷到 state 后调用；已选择参与时它会同步真实答卷 ID。同步失败时答卷已保存，模块会清除本机参与标记并抛出错误；公共入口应以 `Promise.allSettled` 汇总后续操作，提示参与同步失败并继续进入成绩页。

保留现有 `#rank-paper` 和 `data-action="dimension"` 的公共套卷、维度处理。岗位与参与的新操作使用 `data-position-action`。旧演示参与/撤回入口应切到模块返回的参与操作，避免只修改本地 participate 却未通知服务端。服务端退出身份前也应调用模块撤回方法；仅清除本地状态不会撤回服务端榜单。

模块从服务端恢复岗位，并把 `{positionId,position}` 写入 `state.positions` 作为本地展示缓存。重新加载时以服务端读取为准，状态恢复器即使未保留该扩展字段也不会丢失已保存选岗。参与选择会同步本地 attempt 的 participate，公开状态以服务端为准。

公共 `api()` 若统一设置 15 秒超时，建议对 `positions/import/finish` 延长到 75 秒。服务端 Excel 解析最多执行 60 秒；超时取消浏览器请求不一定停止已经进行的导入，刷新目录可查看实际结果。完整原始国考表的 CLI 重导入已实测通过。

## 验证状态

岗位专项共 23 项测试已通过，涵盖真实文件写入和失败回滚、服务重启、凭证归属、并列、维度最佳、零分、跨年度与地区、省考列映射与合并单元格、完整官方 XLS 重导入，以及真实 XLSX 分块上传解析。

独立 Chromium 页面使用实际模块、公共 createApi、临时 catalog.json、真实核分的验收答卷及官方目录，验证首交提示与跳过、选岗刷新恢复、搜索与翻页、失败保留输入后重试、参与与撤回、其他岗位隔离、JSON/Excel 导入和服务重启。1440×900、1280×800、390×844、320×844 的个人岗位、排行榜、管理区域和弹窗均无横向溢出，320px 弹窗最后一行、键盘搜索及 Escape 后焦点返回均已操作。选岗弹窗保留顶部关闭与 Escape，分页始终位于可见区域。证据位于 `.beauye/tasks/positions/evidence/browser-validation.json` 及同目录截图。

全仓回归日志为 `full-test.log`，构建日志为同目录 `build.log`，属于共享工作区对应运行时的结果。本任务 23 项专项均执行并通过，没有跳过。

浏览器证据记录了岗位模块、服务模块、导入脚本及实际引用的 UI/CSS 文件 SHA-256，交接前逐一核对一致，且真实 XLSX 上传通过、页面错误为零。并行验收会生成 `test-results/features/*`，这些产物也参与 Beauye 的全目录指纹，曾在本任务记录写入期间使检查器将观察标为过期。该标记与模块源码变化分别核对，公共集成完成后应重新执行最终全站检查。

本任务独立证据已归档至 `.beauye/tasks/positions/frozen/`，其中 `source-hashes.json` 固定归属文件、数据和引用样式的哈希，`evidence/` 保存实际测试日志、浏览器结果及截图。后续公共回归可能更新活动证据目录，冻结归档用于核对本次独立交付。

公共页面最终接入、原提交弹窗与其他三个功能的组合交互、完整生产入口回归由协调对话验证。独立模块验收不代替这些验证。Python 依赖与 Playwright 缺失时相应可选测试会显示跳过，不能计作通过。
