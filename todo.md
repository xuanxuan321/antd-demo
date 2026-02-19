# TODO (Primary Entry for New Sessions)

Last Updated: 2026-02-17
Owner: Codex + User

## 0. 文档关系（先读）

`todo.md` 是新开会话窗口时的主入口文件，优先级最高。

- `todo.md`：任务执行面板（做什么、做到哪、下一步做什么）。
- `MasterPlan.md`：总目标与验收标准（为什么做、做到什么算完成）。
- `handoff-protocol.md`：跨窗口协作协议（如何安全接力）。

新会话启动顺序：

1. 先读 `todo.md`
2. 再按需读 `MasterPlan.md` 对齐范围
3. 开工前读 `handoff-protocol.md` 的“会话启动检查”

## 1. 状态说明

- `Todo` 未开始
- `Doing` 进行中
- `Done` 已完成
- `Block` 阻塞（需记录阻塞原因）

## 2. 里程碑与行动项

### M0 文档与治理

- Done | T-000 创建 `MasterPlan.md`、`todo.md`、`handoff-protocol.md`
- Todo | T-001 在每次会话结束前更新本文件的“变更日志”

### M1 基础底座

- Todo | T-100 改造 `src/main.tsx`，接入 Router 入口
- Todo | T-101 新建 `src/app/AppRouter.tsx`，完成路由树与根重定向
- Todo | T-102 新建 `src/config/routes.ts`，导出 `ROUTE_PATHS`、`ROUTE_META`、`NAV_ITEMS_ADMIN`、`NAV_ITEMS_MOBILE`
- Todo | T-103 新建 `src/types/prototype.ts`，补齐全局类型约束
- Todo | T-104 新建 `src/app/theme.ts`，配置 AntD 主题 token
- Todo | T-105 新建 `src/styles/global.css`，统一全局排版与基线样式
- Todo | T-106 新建 `src/layouts/AdminLayout.tsx`
- Todo | T-107 新建 `src/layouts/MobileFrameLayout.tsx`
- Todo | T-108 新建 `src/layouts/AuthLayout.tsx`
- Todo | T-109 新建 `src/mocks/README.md`，声明每页独立 mock 规则

### M2 通用组件与图表能力

- Todo | T-200 新建 `SearchPanel` 通用组件
- Todo | T-201 新建 `PageHeaderActions` 通用组件
- Todo | T-202 新建 `StatCards` 通用组件
- Todo | T-203 新建 `ModalFormShell` 通用组件
- Todo | T-204 新建 `DataTableWithBatchBar` 通用组件
- Todo | T-205 安装并接入 `echarts`、`echarts-for-react`
- Todo | T-206 实现 `manage-dashboard` 区域切换与图表联动

### M3 管理端页面迁移（按优先级）

- Todo | T-300 `login`
- Todo | T-301 `manage-project`
- Todo | T-302 `manage-project-plan`
- Todo | T-303 `manage-org`
- Todo | T-304 `manage-role`
- Todo | T-305 `manage-stage-qianqi`
- Todo | T-306 `manage-stage-shishi`
- Todo | T-307 `manage-stage-jiaojungong`
- Todo | T-308 `manage-stage-yanshou`
- Todo | T-309 `manage-zijin-tianbao`
- Todo | T-310 `manage-fund-release`
- Todo | T-311 `manage-doc`
- Todo | T-312 `manage-duban`
- Todo | T-313 `manage-message`
- Todo | T-314 `manage-alert-policy`
- Todo | T-315 `manage-stat` 占位页

### M4 移动端页面迁移

- Todo | T-400 `mobile-login`
- Todo | T-401 `mobile-workbench`
- Todo | T-402 `mobile-progress`
- Todo | T-403 `mobile-media`
- Todo | T-404 `mobile-duban`
- Todo | T-405 `mobile-profile`

### M5 联调与验收

- Todo | T-500 全量路由直达验证（23 条）
- Todo | T-501 关键交互清单回归点击验证
- Todo | T-502 `npm run lint`
- Todo | T-503 `npm run build`
- Todo | T-504 记录已知限制与后续建议（如有）

## 3. 每项任务完成后的强制更新规则

1. 将对应任务状态改为 `Done`。
2. 如果有后续细项，直接在本文件添加新任务并编号。
3. 更新 `Last Updated` 日期。
4. 在“变更日志”追加一条记录，至少包含：
   - 完成了什么
   - 改了哪些文件
   - 是否通过 lint/build
   - 下一个建议任务 ID

## 4. 任务选择优先级与阻塞重试规则

1. 任务选择优先级固定为：`Doing` > `Block`（仅网络类且未达重试上限） > `Todo`（最靠前）。
2. `Block` 任务仅在 `Blocker` 属于网络问题时进入重试队列。网络问题示例：超时、连接重置、DNS 失败、网关错误、临时断网。
3. 网络阻塞任务总重试次数为 2 次（`Retry 1/2`、`Retry 2/2`），达到 `2/2` 后禁止继续重试。
4. 每次重试必须在 `todo.md` 留痕，至少记录：任务 ID、第几次重试（`Retry x/2`）、重试结果（成功/失败）、简要原因或错误关键字。
5. 状态流转规则：
   - 发起重试时：`Block` -> `Doing`
   - 重试成功：`Doing` -> `Done`
   - 重试失败且未到上限：`Doing` -> `Block`（更新 `Blocker` 与 `Retry x/2`）
   - 重试失败且达到上限：保持 `Block` 并标注 `Retry Exhausted: 2/2`，随后转去寻找下一个 `Todo` 任务。

可继续并行的任务必须继续推进，避免整批停工。

## 5. 变更日志

- 2026-02-16: 初始化执行面板，建立 5 个里程碑与任务编号体系；已完成 T-000；下一建议任务为 T-100。
- 2026-02-16: 状态标记从方括号符号统一改为英文关键词（`Todo`/`Doing`/`Done`/`Block`），便于搜索与理解。
- 2026-02-17: 新增任务选择优先级与网络阻塞重试规范：`Doing > Block(网络可重试) > Todo`；网络问题最多重试 2 次；每次重试必须记录；重试耗尽后转下一个 `Todo`。
