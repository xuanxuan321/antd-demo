#!/usr/bin/env node

/**
 * todo-agent-loop.mjs
 *
 * 纯编排器模式（AI 自主发现任务）：
 * 1) 脚本不再用正则解析 todo.md。
 * 2) 每一轮都启动一个全新的 Codex 会话。
 * 3) 让 Codex 自己读取 todo.md，挑选并执行 1 个任务（或判断无任务）。
 * 4) Codex 仅返回结构化 JSON；脚本只按 action 决定继续/停止。
 *
 * 这么做的目的：
 * - 降低对 todo.md 固定格式的依赖（格式变了也尽量可运行）。
 * - 把"任务发现与执行策略"交给 AI，脚本只负责流程编排和容错。
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { Codex } from "@openai/codex-sdk";
import { z } from "zod";

// ── 日志模块 ──────────────────────────────────────────────

const LOG_FILENAME = "todo-agent-loop.log.md";

function getLogPath(workspacePath) {
  return path.resolve(workspacePath, LOG_FILENAME);
}

function initLogFile(logPath, options) {
  const now = new Date().toISOString();
  const header = [
    "# todo-agent-loop 执行日志",
    "",
    `> 生成时间: ${now}`,
    `> 模式: ${options.dryRun ? "DRY RUN" : "EXECUTION"}`,
    `> todo 路径: ${options.todoPath}`,
    `> 工作区: ${options.workspacePath}`,
    `> max-tasks: ${options.maxTasks === Number.POSITIVE_INFINITY ? "不限" : options.maxTasks}`,
    `> round-timeout-sec: ${options.roundTimeoutSec}`,
    `> model: ${options.codexModel ?? "默认"}`,
    "",
    "---",
    "",
  ].join("\n");
  fs.writeFileSync(logPath, header, "utf-8");
}

function appendLog(logPath, text) {
  fs.appendFileSync(logPath, text + "\n", "utf-8");
}

function logRoundStart(logPath, round) {
  appendLog(logPath, `## Round ${round}\n`);
  appendLog(logPath, `**开始时间**: ${new Date().toISOString()}`);
}

function logRoundSuccess(logPath, round, result, threadId) {
  const lines = [
    `**结束时间**: ${new Date().toISOString()}`,
    `**状态**: 成功`,
    `**Thread**: \`${threadId ?? "N/A"}\``,
    `**taskId**: ${result.taskId}`,
    `**taskStatus**: ${result.taskStatus}`,
    `**action**: ${result.action}`,
    `**summary**: ${result.summary}`,
    "",
    "---",
    "",
  ];
  appendLog(logPath, lines.join("\n"));
}

function logRoundError(logPath, round, reason, threadId) {
  const lines = [
    `**结束时间**: ${new Date().toISOString()}`,
    `**状态**: 失败`,
    `**Thread**: \`${threadId ?? "N/A"}\``,
    `**错误**:`,
    "",
    "```",
    reason,
    "```",
    "",
    "---",
    "",
  ];
  appendLog(logPath, lines.join("\n"));
}

function logFinalSummary(logPath, processed, rounds, exitReason) {
  const lines = [
    "## 总结",
    "",
    `- **总轮次**: ${rounds}`,
    `- **完成任务数**: ${processed}`,
    `- **退出原因**: ${exitReason}`,
    `- **结束时间**: ${new Date().toISOString()}`,
  ];
  appendLog(logPath, lines.join("\n"));
}

// ── Schema ────────────────────────────────────────────────

// 运行结果的本地校验 Schema：
// 脚本在拿到模型输出后，会再次用 zod 做强校验，避免误继续循环。
const RoundResultSchema = z.object({
  action: z.enum(["continue", "stop"]),
  summary: z.string().min(1),
  taskId: z.string().min(1),
  taskStatus: z.enum(["done", "block", "skipped", "none"]),
});

// 传给 Codex 的 outputSchema（约束模型输出格式）。
// required 字段必须完整，否则 SDK 端会报 schema 校验错误。
const CodexOutputSchema = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["continue", "stop"],
      description: "continue: run next round; stop: no more actionable tasks.",
    },
    summary: {
      type: "string",
      description: "What happened in this round.",
    },
    taskId: {
      type: "string",
      description: "Task identifier; use 'N/A' when action=stop.",
    },
    taskStatus: {
      type: "string",
      enum: ["done", "block", "skipped", "none"],
      description: "Task result; use 'none' when action=stop.",
    },
  },
  required: ["action", "summary", "taskId", "taskStatus"],
  additionalProperties: false,
};

// ── CLI ───────────────────────────────────────────────────

function usage() {
  console.log(
    [
      "Usage:",
      "  npm run todo:autopilot -- [options]",
      "",
      "Options:",
      "  --todo <path>         Path to todo.md (default: ./todo.md)",
      "  --workspace <path>    Workspace root for Codex thread (default: cwd)",
      "  --max-tasks <n>       Max rounds per run (default: all)",
      "  --round-timeout-sec <n>  Timeout per round in seconds (default: 900)",
      "  --codex-model <name>  Optional model override for Codex thread",
      "  --dry-run             Ask Codex to inspect and report only (no file/code changes)",
      "  --help                Show help",
      "",
      "Auth:",
      "  Uses local Codex CLI login state (Sign in with ChatGPT).",
      "",
      "Logs:",
      `  Each run generates ${LOG_FILENAME} in the workspace root.`,
    ].join("\n"),
  );
}

// CLI 参数解析：
// 只处理编排器级别参数，不处理任务语义。
function parseArgs(argv) {
  const options = {
    todoPath: path.resolve(process.cwd(), "todo.md"),
    workspacePath: process.cwd(),
    maxTasks: Number.POSITIVE_INFINITY,
    roundTimeoutSec: 900,
    codexModel: undefined,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--todo" && next) {
      options.todoPath = path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }
    if (arg === "--workspace" && next) {
      options.workspacePath = path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }
    if (arg === "--max-tasks" && next) {
      options.maxTasks = Number.parseInt(next, 10);
      i += 1;
      continue;
    }
    if (arg === "--round-timeout-sec" && next) {
      options.roundTimeoutSec = Number.parseInt(next, 10);
      i += 1;
      continue;
    }
    if (arg === "--codex-model" && next) {
      options.codexModel = next;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (
    options.maxTasks !== Number.POSITIVE_INFINITY &&
    (!Number.isFinite(options.maxTasks) || options.maxTasks <= 0)
  ) {
    throw new Error("--max-tasks must be a positive number");
  }
  if (!Number.isFinite(options.roundTimeoutSec) || options.roundTimeoutSec <= 0) {
    throw new Error("--round-timeout-sec must be a positive number");
  }

  return options;
}

// ── 常量 ──────────────────────────────────────────────────

const ROUND_DELAY_SEC = 5;        // 每轮结束后等待秒数，避免触发速率限制
const MAX_RETRIES = 3;            // 单轮失败最大重试次数
const RETRY_BASE_DELAY_SEC = 15;  // 重试基础等待秒数（指数退避：15s, 30s, 60s）

// ── 工具函数 ──────────────────────────────────────────────

function sleep(sec) {
  return new Promise((resolve) => setTimeout(resolve, sec * 1000));
}

// 把日志文本压成单行，避免控制台输出过长或换行混乱。
function normalizeSingleLine(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

function makeLogPrefix(round) {
  return `[round-${round}]`;
}

// ── Prompt ────────────────────────────────────────────────

// 每一轮给 Codex 的统一指令：
// - 必须先读 todo 文件
// - 必须自主找"下一项可执行任务"
// - 每轮只执行一个任务
// - dry-run 只更新 todo.md 状态，不执行实际代码变更
function buildPrompt({ todoPath, workspacePath, dryRun }) {
  const modeInstructions = dryRun
    ? [
        "Mode: DRY RUN.",
        "Read the todo file and identify the next actionable task by yourself.",
        "If there is no actionable task, return action=stop (taskId='N/A', taskStatus='none') and summary.",
        "If there is an actionable task, DO NOT execute any code changes or modify any file other than todo.md.",
        "Mark that task as Done in todo.md and append one concise record to the change log section.",
        "Do not execute the next task in the same round.",
        "Return action=continue with taskId/taskStatus/summary.",
      ]
    : [
        "Mode: EXECUTION.",
        "Read the todo file and identify the next actionable task by yourself.",
        "If there is no actionable task, return action=stop (taskId='N/A', taskStatus='none') and summary.",
        "If there is an actionable task, execute exactly ONE task in the workspace.",
        "After execution, update that task status in todo.md (prefer Done on success, Block on failure).",
        "Append one concise record to the change log section in todo.md.",
        "Do not execute the next task in the same round.",
        "Return action=continue with taskId/taskStatus/summary.",
      ];

  return [
    `Workspace root: ${workspacePath}`,
    `Todo file path: ${todoPath}`,
    "",
    ...modeInstructions,
    "",
    "Important:",
    "1) You must discover task structure by reading the file itself.",
    "2) Do not assume fixed markdown formatting.",
    "3) Output must be valid JSON only and match the schema.",
  ].join("\n");
}

// ── 解析与执行 ────────────────────────────────────────────

// 解析模型返回：
// 1) 先尝试把完整文本直接 JSON.parse
// 2) 失败后再尝试从文本里提取首个 JSON 对象
// 3) 仍失败则抛错，防止脚本在不确定状态下继续
function parseRoundResult(rawText) {
  const text = String(rawText ?? "").trim();

  try {
    return RoundResultSchema.parse(JSON.parse(text));
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return RoundResultSchema.parse(JSON.parse(jsonMatch[0]));
    }
    throw new Error("Unable to parse Codex round result JSON.");
  }
}

// 执行"单轮"任务：
// - 新建 Codex thread
// - 按生命周期事件监听执行状态
// - 收集最终 agent_message（期望是 JSON）
// - 返回统一结果对象（ok / reason / parsed payload）
async function executeRound(round, options) {
  const codex = new Codex();
  // 线程配置：允许工作区写入、网络访问；禁止 web search；无需人工审批。
  const threadOptions = {
    workingDirectory: options.workspacePath,
    sandboxMode: "workspace-write",
    skipGitRepoCheck: true,
    networkAccessEnabled: true,
    webSearchMode: "disabled",
    approvalPolicy: "never",
  };
  if (options.codexModel) {
    threadOptions.model = options.codexModel;
  }

  const thread = codex.startThread(threadOptions);
  const controller = new AbortController();
  // 单轮超时保护：超时会触发 abort，避免卡死。
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Round timeout after ${options.roundTimeoutSec}s`));
  }, options.roundTimeoutSec * 1000);

  const streamed = await thread.runStreamed(buildPrompt(options), {
    outputSchema: CodexOutputSchema,
    signal: controller.signal,
  });

  let threadId = null;
  let turnCompleted = false;
  let turnFailedReason = null;
  let streamError = null;
  let finalAgentMessage = null;

  try {
    // 生命周期事件监听：这里就是"本轮是否结束/失败"的核心依据。
    for await (const event of streamed.events) {
      if (event.type === "thread.started") {
        threadId = event.thread_id;
        console.log(`${makeLogPrefix(round)} [hook] thread.started ${threadId}`);
        continue;
      }
      if (event.type === "turn.started") {
        console.log(`${makeLogPrefix(round)} [hook] turn.started`);
        continue;
      }
      if (event.type === "turn.completed") {
        turnCompleted = true;
        console.log(
          `${makeLogPrefix(round)} [hook] turn.completed usage=${JSON.stringify(event.usage)}`,
        );
        continue;
      }
      if (event.type === "turn.failed") {
        turnFailedReason = event.error?.message ?? "turn.failed";
        console.log(`${makeLogPrefix(round)} [hook] turn.failed ${turnFailedReason}`);
        continue;
      }
      if (event.type === "error") {
        streamError = event.message ?? "stream error";
        console.log(`${makeLogPrefix(round)} [hook] error ${streamError}`);
        continue;
      }

      // 捕获最终 agent_message，用于后续 JSON 解析与 schema 校验。
      if (
        (event.type === "item.updated" || event.type === "item.completed") &&
        event.item?.type === "agent_message"
      ) {
        finalAgentMessage = event.item.text;
      }
    }
  } finally {
    // 无论成功/失败都清理定时器，避免资源泄漏。
    clearTimeout(timeout);
  }

  // 只要未完成、或出现 turn.failed / error，都视为本轮失败。
  if (!turnCompleted || turnFailedReason || streamError) {
    return {
      ok: false,
      threadId: thread.id ?? threadId,
      reason: normalizeSingleLine(turnFailedReason ?? streamError ?? "round did not complete"),
      result: null,
    };
  }

  const parsed = parseRoundResult(finalAgentMessage);
  return {
    ok: true,
    threadId: thread.id ?? threadId,
    reason: "turn.completed",
    result: parsed,
  };
}

// ── 主循环 ────────────────────────────────────────────────

// - 每次只跑一轮 executeRound
// - 仅依据 action 决定继续/停止
// - 不在本地解析 todo 任务内容
async function runLoop(options) {
  const logPath = getLogPath(options.workspacePath);
  initLogFile(logPath, options);
  console.log(`日志文件: ${logPath}`);

  let processed = 0;
  let round = 1;
  let exitReason = "all tasks completed";

  while (processed < options.maxTasks) {
    console.log(`${makeLogPrefix(round)} executing...`);
    logRoundStart(logPath, round);

    // 带重试的执行
    let result = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      if (attempt > 0) {
        const delaySec = RETRY_BASE_DELAY_SEC * 2 ** (attempt - 1);
        console.log(`${makeLogPrefix(round)} retry ${attempt}/${MAX_RETRIES}, waiting ${delaySec}s...`);
        appendLog(logPath, `**重试 ${attempt}/${MAX_RETRIES}**: 等待 ${delaySec}s 后重试...`);
        await sleep(delaySec);
      }

      result = await executeRound(round, options);
      if (result.ok) break;

      // 认证错误不重试
      if (/auth|login|signin|sign in/i.test(result.reason)) break;

      // 最后一次重试仍失败
      if (attempt === MAX_RETRIES) break;

      console.log(`${makeLogPrefix(round)} attempt ${attempt + 1} failed: ${normalizeSingleLine(result.reason)}`);
    }

    if (!result.ok) {
      logRoundError(logPath, round, result.reason, result.threadId);

      if (/auth|login|signin|sign in/i.test(result.reason)) {
        exitReason = `认证错误: ${result.reason}`;
        logFinalSummary(logPath, processed, round, exitReason);
        throw new Error(
          `${result.reason}\nTip: run 'codex' once and sign in with ChatGPT, then rerun.`,
        );
      }
      exitReason = `Round ${round} 失败 (已重试 ${MAX_RETRIES} 次): ${normalizeSingleLine(result.reason)}`;
      logFinalSummary(logPath, processed, round, exitReason);
      throw new Error(`Round failed after ${MAX_RETRIES} retries: ${normalizeSingleLine(result.reason)}`);
    }

    const payload = result.result;
    console.log(
      `${makeLogPrefix(round)} action=${payload.action} taskId=${payload.taskId ?? "n/a"} status=${payload.taskStatus ?? "n/a"} summary=${normalizeSingleLine(payload.summary)}`,
    );
    logRoundSuccess(logPath, round, payload, result.threadId);

    processed += 1;
    // 停止条件：模型明确返回 stop（没有更多可执行任务）
    if (payload.action === "stop") {
      console.log(`${makeLogPrefix(round)} stop`);
      exitReason = "模型返回 stop，无更多可执行任务";
      break;
    }

    // 轮次间隔，避免触发速率限制
    console.log(`${makeLogPrefix(round)} waiting ${ROUND_DELAY_SEC}s before next round...`);
    await sleep(ROUND_DELAY_SEC);

    round += 1;
  }

  if (processed >= options.maxTasks) {
    exitReason = `达到 --max-tasks 上限 (${options.maxTasks})`;
    console.log(`Reached --max-tasks limit (${options.maxTasks}).`);
  }

  logFinalSummary(logPath, processed, round, exitReason);
  console.log(`日志已写入: ${logPath}`);
}

// 程序入口：参数解析 -> 执行循环 -> 统一错误退出码。
async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    await runLoop(options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

await main();
