# AntD Prototype Migration Master Plan

## 1. 目标与边界

- 源原型目录：`/Users/shaojianheng/Downloads/prototypes_副本`
- 目标工程：`/Users/shaojianheng/antd-demo`
- 迁移目标：将 22 个 HTML 原型完整迁移为 React + Ant Design 页面，并补齐 `manage-stat` 占位页，形成 23 条可直达路由。
- 核心约束：主体业务逻辑与交互 1:1 保持不变；允许轻度视觉优化（布局细节、色调、层次）但不改变信息架构、入口和流程顺序。

## 2. 固定决策（已锁定）

- 一次会话无法完成时，采用分阶段推进 + 跨窗口接力。
- `manage-stat` 作为新建占位页，避免死链。
- 全量使用本地 Mock 数据，不接后端。
- 路由按原型文件名语义映射，统一收敛到 `src/config/routes.ts`。
- 移动端页面使用固定手机壳（393x852）承载。
- 所有弹窗与流程改为 React 受控状态，不使用 DOM 直接显隐。

## 3. 路由清单（最终版）

- `/` -> redirect `/login`
- `/login`
- `/manage-dashboard`
- `/manage-project`
- `/manage-project-plan`
- `/manage-org`
- `/manage-role`
- `/manage-stage-qianqi`
- `/manage-stage-shishi`
- `/manage-stage-jiaojungong`
- `/manage-stage-yanshou`
- `/manage-fund-release`
- `/manage-zijin-tianbao`
- `/manage-doc`
- `/manage-duban`
- `/manage-message`
- `/manage-alert-policy`
- `/manage-stat`
- `/mobile-login`
- `/mobile-workbench`
- `/mobile-progress`
- `/mobile-media`
- `/mobile-duban`
- `/mobile-profile`

## 4. 交付架构与关键文件

- Router 入口与应用壳：
  - `src/main.tsx`
  - `src/app/AppRouter.tsx`
- 路由配置与页面元信息：
  - `src/config/routes.ts`
- 全局类型：
  - `src/types/prototype.ts`
- Mock 数据：
  - `src/mocks/*.ts`（每页独立，不跨页隐式共享状态）
- 布局：
  - `src/layouts/AdminLayout.tsx`
  - `src/layouts/MobileFrameLayout.tsx`
  - `src/layouts/AuthLayout.tsx`
- 通用组件：
  - `SearchPanel`
  - `PageHeaderActions`
  - `StatCards`
  - `ModalFormShell`
  - `DataTableWithBatchBar`
- 主题与样式：
  - `src/app/theme.ts`
  - `src/styles/global.css`
- 图表：
  - `echarts`
  - `echarts-for-react`

## 5. 里程碑拆解

### M0. 文档治理与接力框架

- 产出：`MasterPlan.md`、`todo.md`、`handoff-protocol.md`
- 验收：三者关系清晰，`todo.md` 可独立驱动下一窗口继续执行

### M1. 基础底座

- 路由系统接管入口，清理 Vite 示例页残留
- 建立主题 token 与全局样式基线
- 建立三类布局（管理端/移动端/认证）
- 搭建通用类型与 Mock 目录规则

### M2. 管理端核心页面迁移

- 登录、看板、组织、角色、项目/计划、阶段页、文档、督办、消息、预警策略、资金下达、占位页
- 每页交互通过 React state + AntD message/Modal.confirm 还原

### M3. 移动端页面迁移

- mobile-login、workbench、progress、media、duban、profile
- 保持手机壳视图与底部导航行为一致

### M4. 集成验收

- `npm run lint` 无错误
- `npm run build` 成功
- 23 路由可直达无白屏
- 关键交互清单逐项通过

## 6. 全局交互还原规则

- 原型全部 `onclick` 行为必须有对应 handler。
- 弹窗、抽屉、步骤流必须受控。
- 所有 alert/confirm 迁移为 AntD 反馈组件，文案保持原意。
- 高级搜索必须保留“展开/收起 + 重置 + 查询反馈”。
- 表格选择与批量栏保留“全选/半选/计数/清空”行为。
- 多步骤流程（例如找回密码）保留 step 状态切换。

## 7. 风险与应对

- 风险：原型细节多，单窗口上下文不足。
  - 应对：严格使用 `todo.md` 作为唯一进度真源；每次会话结束前执行 handoff 模板。
- 风险：多页面状态逻辑相似导致复制粘贴错误。
  - 应对：先做通用组件，再页面接入；每个页面保留独立 mock state。
- 风险：视觉优化过度影响交互一致性。
  - 应对：优化仅限表现层，不增删功能入口，不改变操作顺序。

## 8. 文档协作关系

- `todo.md`：执行主入口（新窗口先读它），负责任务状态与变更日志。
- `handoff-protocol.md`：跨窗口交接规则与会话收尾模板。
- `MasterPlan.md`：目标、范围、里程碑、验收的基线文档。

## 9. 任务调度与重试策略（规范层）

- 任务选择优先级：`Doing` > `Block`（仅网络类且未达重试上限） > `Todo`（最靠前）。
- 网络类 `Block`（超时、DNS、连接重置、网关错误等）允许重试，总计 2 次；达到 `Retry 2/2` 后停止重试。
- 每次重试必须写入 `todo.md` 变更记录（任务 ID、重试次数、结果、原因关键字）。
- 网络重试耗尽后，保持 `Block` 并标注 `Retry Exhausted: 2/2`，编排流程转向下一个 `Todo`。
