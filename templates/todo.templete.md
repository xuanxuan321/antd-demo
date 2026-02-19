# TODO (Primary Entry for New Sessions)

Last Updated: {{LAST_UPDATED_YYYY_MM_DD}}
Owner: {{OWNER}}

## 使用说明（模板）

- 复制本文件为项目根目录 `todo.md` 后再填写占位符。
- 先完成 `masterplan.templete.md` -> 再完成 `handle-proto.templete.md` -> 最后填写本文件。
- 新窗口启动时，始终优先阅读 `todo.md`，再按需读取 `MasterPlan.md` 与 `handoff-protocol.md`。

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

## 2. 阶段（可选）与行动项

本节支持两种模式，按项目类型二选一即可：

1. 有阶段模式：按 `0..N` 个阶段组织任务（推荐复杂项目，当任务非常复杂的时候，每个大任务又可以拆分成小任务，每个小任务又可以拆分成更小的任务，以此类推）。
2. 无阶段模式：直接维护单一任务清单（推荐小型或短周期任务）。

建议预置治理类启动任务（可删改）：

- Todo | {{TASK_ID}} 初始化 `MasterPlan.md`、`todo.md`、`handoff-protocol.md`
- Todo | {{TASK_ID}} 约定任务编号规则与完成定义（DoD）

### 模式 A：有阶段（可重复添加，数量不限）

> 复制以下块若干次。`{{MILESTONE_ID}}` 可为 `M1`、`Phase-1`、`Sprint-A` 或任意分段标识。

### {{MILESTONE_ID}} {{MILESTONE_NAME}}

- Todo | {{TASK_ID}} {{TASK_DESC}}
- Doing | {{TASK_ID}} {{TASK_DESC}}
- Block | {{TASK_ID}} {{TASK_DESC}} | Blocker: {{BLOCKER_REASON}}
- Done | {{TASK_ID}} {{TASK_DESC}}

### 模式 B：无阶段（单列表）

> 不需要里程碑时，直接维护以下列表并持续追加。

- Todo | {{TASK_ID}} {{TASK_DESC}}
- Doing | {{TASK_ID}} {{TASK_DESC}}
- Block | {{TASK_ID}} {{TASK_DESC}} | Blocker: {{BLOCKER_REASON}}
- Done | {{TASK_ID}} {{TASK_DESC}}

## 3. 每项任务完成后的强制更新规则

1. 将对应任务状态改为 `Done`。
2. 如果有后续细项，直接在本文件添加新任务并编号。
3. 更新 `Last Updated` 日期。
4. 在“变更日志”追加一条记录，至少包含：
   - 完成了什么
   - 改了哪些文件
   - 是否通过 lint/build
   - 下一个建议任务 ID（`{{NEXT_TASK_ID}}`）

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

- {{LAST_UPDATED_YYYY_MM_DD}}: 初始化本项目 `todo.md`。
- {{LAST_UPDATED_YYYY_MM_DD}}: Completed={{COMPLETED_TASK_IDS}} | Files Changed={{CHANGED_FILES}} | Validation={{VALIDATION_RESULT}} | Risks/Blockers={{RISKS_OR_BLOCKERS}} | Next={{NEXT_TASK_ID}}

## 6. 占位符速查

- 日期类：`{{LAST_UPDATED_YYYY_MM_DD}}`
- 项目类：`{{PROJECT_NAME}}`、`{{SOURCE_DIR}}`、`{{TARGET_DIR}}`
- 任务类：`{{TASK_ID}}`、`{{TASK_DESC}}`、`{{MILESTONE_ID}}`、`{{MILESTONE_NAME}}`、`{{NEXT_TASK_ID}}`
- 阻塞类：`{{BLOCKER_REASON}}`
- 验收类：`{{ACCEPTANCE_ITEM}}`
