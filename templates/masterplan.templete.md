# {{PROJECT_NAME}} Master Plan

## 使用说明（模板）

- 复制本文件为项目根目录 `MasterPlan.md` 后再填写占位符。
- 本文档只定义“主要目标与完成标准”，不承载日常任务状态；任务进度由 `todo.md` 维护。
- 建议填写顺序：目标与边界 -> 固定决策 -> 范围与交付 -> 里程碑 -> 验收与风险。
- 与 `todo.md`、`handoff-protocol.md` 保持术语一致：`Todo/Doing/Done/Block`、`Retry x/2`、`Retry Exhausted: 2/2`。

## 1. 目标与边界

- 主要目标：`{{PROJECT_GOAL}}`
- 预期影响（业务/用户/效率/质量）：`{{EXPECTED_IMPACT}}`
- 核心约束（时间、资源、合规、技术等）：`{{CORE_CONSTRAINTS}}`
- 适用范围边界：`{{BOUNDARY_DESC}}`
- 可选上下文（如适用）：
  - 源上下文：`{{SOURCE_DIR}}`
  - 目标上下文：`{{TARGET_DIR}}`

## 2. 背景与问题定义

- 当前现状：`{{CURRENT_STATE}}`
- 关键问题：`{{PROBLEM_STATEMENT}}`
- 为什么现在做：`{{WHY_NOW}}`
- 非目标（明确不做）：`{{NON_GOAL_1}}`、`{{NON_GOAL_2}}`

## 3. 固定决策（已锁定）

- `{{DECISION_1}}`
- `{{DECISION_2}}`
- `{{DECISION_3}}`
- `{{DECISION_4}}`
- `{{DECISION_5}}`

## 4. 范围与交付清单（最终版）

### 4.1 In Scope（做什么）

- `{{SCOPE_IN_1}}`
- `{{SCOPE_IN_2}}`
- `{{SCOPE_IN_3}}`

### 4.2 Out of Scope（不做什么）

- `{{SCOPE_OUT_1}}`
- `{{SCOPE_OUT_2}}`

### 4.3 交付物（可执行产出）

- `{{DELIVERABLE_1}}`
- `{{DELIVERABLE_2}}`
- `{{DELIVERABLE_3}}`

## 5. 实施方案与关键资产

### 5.1 实施路径（高层）

- `{{APPROACH_STEP_1}}`
- `{{APPROACH_STEP_2}}`
- `{{APPROACH_STEP_3}}`

### 5.2 关键资产（代码/文档/系统/流程）

- `{{KEY_ASSET_1}}`
- `{{KEY_ASSET_2}}`
- `{{KEY_ASSET_3}}`

### 5.3 依赖与前置条件

- `{{DEPENDENCY_1}}`
- `{{DEPENDENCY_2}}`

## 6. 里程碑拆解（0..N 阶段）

### M0. 文档治理与接力框架

- 产出：`MasterPlan.md`、`todo.md`、`handoff-protocol.md`
- 验收：三者关系清晰，`todo.md` 可独立驱动下一窗口继续执行

### {{MILESTONE_ID}} {{MILESTONE_NAME}}

- 目标：`{{MILESTONE_GOAL}}`
- 关键事项：
  - `{{MILESTONE_ITEM_1}}`
  - `{{MILESTONE_ITEM_2}}`
- 完成定义（DoD）：`{{MILESTONE_DOD}}`

> 根据项目复杂度复制上述里程碑块，数量不限。

## 7. 验收标准与验证方式

- 验收项：`{{ACCEPTANCE_ITEM}}`
- 验收项：`{{ACCEPTANCE_ITEM}}`
- 验收项：`{{ACCEPTANCE_ITEM}}`
- 验证方式（测试/评审/演示/签收）：`{{VALIDATION_METHOD}}`
- 验收证据（报告/截图/链接）：`{{VALIDATION_EVIDENCE}}`

## 8. 风险与应对

- 风险：`{{RISK_1}}`
  - 应对：`{{MITIGATION_1}}`
- 风险：`{{RISK_2}}`
  - 应对：`{{MITIGATION_2}}`
- 风险：`{{RISK_3}}`
  - 应对：`{{MITIGATION_3}}`

## 9. 文档协作关系

- `todo.md`：执行主入口（新窗口先读它），负责任务状态与变更日志。
- `handoff-protocol.md`：跨窗口交接规则与会话收尾模板。
- `MasterPlan.md`：目标、范围、里程碑、验收的基线文档。

## 10. 任务调度与重试策略（规范层）

- 任务选择优先级：`Doing` > `Block`（仅临时性外部阻塞且未达重试上限） > `Todo`（最靠前）。
- 临时性外部阻塞（网络、依赖服务、鉴权、网关错误等）允许重试，总计 2 次；达到 `Retry 2/2` 后停止重试。
- 每次重试必须写入 `todo.md` 变更记录（任务 ID、重试次数、结果、原因关键字）。
- 重试耗尽后，保持 `Block` 并标注 `Retry Exhausted: 2/2`，编排流程转向下一个 `Todo`。

## 11. 占位符速查

- 日期类：`{{LAST_UPDATED_YYYY_MM_DD}}`
- 项目类：`{{PROJECT_NAME}}`、`{{PROJECT_GOAL}}`、`{{EXPECTED_IMPACT}}`
- 边界类：`{{CORE_CONSTRAINTS}}`、`{{BOUNDARY_DESC}}`、`{{NON_GOAL_1}}`、`{{NON_GOAL_2}}`
- 上下文类：`{{SOURCE_DIR}}`、`{{TARGET_DIR}}`
- 范围类：`{{SCOPE_IN_1}}`、`{{SCOPE_OUT_1}}`、`{{DELIVERABLE_1}}`
- 里程碑类：`{{MILESTONE_ID}}`、`{{MILESTONE_NAME}}`、`{{MILESTONE_GOAL}}`、`{{MILESTONE_DOD}}`
- 验收类：`{{ACCEPTANCE_ITEM}}`、`{{VALIDATION_METHOD}}`、`{{VALIDATION_EVIDENCE}}`
- 风险类：`{{RISK_1}}`、`{{MITIGATION_1}}`
- 任务类：`{{TASK_ID}}`、`{{NEXT_TASK_ID}}`
