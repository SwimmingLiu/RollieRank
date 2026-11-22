# 岗位层级接口接入

`GET /api/positions/hierarchy` 与原有 catalog/profile/selection/leaderboard 并存。参数为 `sourceId/categoryId/departmentId/unitId/q/page/pageSize`，或单独使用 `positionId` 恢复路径。ID 均视为不透明字符串，逐层使用响应中的 option.id，不自行拼接或解析。

`createPositionsService` 的工厂参数及返回处理函数保持不变。协调对话重启 Node 服务后即可加载新增接口与内置目录；既有 catalog.json、已选岗位和参与状态不需要迁移。纯层级查询可用模块导出的 `positionHierarchy(datasets,query)`，数据集元素使用 `{source,positions}`，query 为 URLSearchParams。

响应为 `{level,source,breadcrumbs,options,total,page,pages,autoAdvance}`。source 是当前来源元信息，尚未选来源时为 null。level 为本轮显示的选项层：

| 请求父条件 | level | options |
| --- | --- | --- |
| 无父条件 | source | 招考来源项目。 |
| sourceId | category | 真实机构类别与考试类别的组合。 |
| sourceId、categoryId | department | 当前类别下的招录部门。 |
| 再加 departmentId | unit | 当前部门下的用人单位。 |
| 再加 unitId | position | 当前单位下的具体岗位。 |

普通选项为 `{id,label}`，末级为 `{id,label,positionId,code,position}`。positionId 是原岗位 ID，position 是包含新增分类字段的原岗位对象。类别标签由真实机构类别与规范考试类别组成，部门和单位标签来自原表。

breadcrumbs 按 source→category→department→unit 排列，包含已经选定的父条件，每项 `{level,id,label}`。自然过渡节点额外有 `automatic:true`，label 为空，前端不把它渲染成类别或单位名称。选岗保存使用末级 option.positionId，不能用层级节点 ID 代替。

没有有效分类或单位的旧导入返回一个 `{id,label:"",automatic:true}` 的过渡选项，此时 autoAdvance 为 true；选择该 ID 后继续请求下一层。来源总计只有一项时也返回 autoAdvance:true。正常真实类别或单位即使只有一项也不自动跳过。若同一来源混有缺失分类与真实分类，automatic 过渡项仅承载缺失记录，客户端可直接展开该分支，不能给它补造类别标签。

positionId 恢复请求不与其他父 ID 混用。响应 level 为 position，包含完整五级 breadcrumbs（最后一项为已选岗位），options 为原单位内的同级岗位。未显式提供 page 且无搜索词时，服务定位到已选岗位所在页；保留相同 ID，前端可直接高亮它。该请求不改变个人岗位。

q 只搜索当前父节点内的本层名称或编码，不跨层搜索或跨来源扩展。pageSize 默认 40，只接受 40 或 100。无效 ID、跨父级 ID、缺少中间父条件、重复参数或未知参数均返回错误，不自动退回全部目录。

岗位字段新增 `institutionCategory`（原机构性质）、`examCategory`（原考试类别）、`examCategoryLabel`（规范名称）。缺少字段的 SchemaVersion 1 仍可导入，原 sourceSheet 继续保留为溯源信息。不能从 sourceSheet、学历或专业补猜类别。

官方目录已从保留的原 XLS 重导入，真实机构类别有 6 种，机构与考试组合有 10 种。副省级 1,423 个、地市级 3,995 个、行政执法类 14,008 个，合计 19,426 个岗位、35,691 个名额。所有既有岗位字段与 ID 均已逐条比较保持不变，原 source 元信息及 XLS SHA-256 也保持不变；来源清单只更新派生 JSON 的 normalizedSha256。

22 项层级、导入及原服务回归测试全部通过，没有跳过。原 XLS 的机构性质、考试类别与重导入后的每一行使用独立摘要核对一致；测试同时固定重导入前的完整岗位 ID 摘要。HTTP 测试覆盖五级路径、跨父级拒绝、空目录、缺失层自动过渡、混合旧字段、当前层搜索、40/100 条分页、定位已选岗位所在页、重启后 ID 稳定，以及原 catalog/profile/selection/leaderboard 不受只读层级访问影响。

验证命令为 `POSITIONS_PYTHON=/tmp/rollierank-positions-venv/bin/python node --test test/positions-hierarchy.test.js test/positions-import.test.js test/positions.test.js`。实际日志与重导入对比在 `.beauye/tasks/positions-hierarchy/evidence/`，交付源码哈希见 `docs/position-hierarchy-source-lock.json`。前端层级控件、路径返回效果与实际 4781 入口由协调对话接入和复验。
