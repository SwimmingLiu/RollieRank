# 套卷目录与管理

验证用户从入口完成操作后的真实结果，并核对持久化的业务状态。

## Sub-features

机构、项目、期数、卷别、卷名及练习状态筛选；套卷详情；CSV校验、四类试算、草稿、发布、下线、修订和审计。

## How to get to it (user POV)

手机首页进入机构与套卷列表；基础入口侧栏的套卷管理进入导入、版本和审计。

## Driving it with verification CLI

Preconditions: 已按主Skill安装依赖；CLI启动隔离服务并通过doctor；不复用4781的日常数据。

运行 `npm run verify -- feature catalog-admin`。进入手机机构卡和套卷卡，检查实际题量；在基础管理页导入六题CSV，先试算再发布，提交后下线并确认旧报告仍可读。

证据保存在输出目录的日志、浏览器截图、ARIA快照和结果JSON中。命令非零退出即为未通过，不能把缺少依赖记成成功。

## Gotchas

公开目录不包含参考答案。手机审核页负责岗位导入，`/#/admin` 的套卷管理负责套卷 CSV。独立运营后台 `/admin/` 提供管理员登录、运营总览、评论审查、用户、积分、答案纠错和操作日志。套卷维护 API 仍供维护者调用。运行 `node --test test/admin-console.test.js` 检查独立后台。
