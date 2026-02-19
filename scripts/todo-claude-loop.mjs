#!/usr/bin/env node

/**
 * todo-claude-loop.mjs
 *
 * Claude Agent SDK 版纯编排器模式（AI 自主发现任务）：
 * 1) 脚本不再用正则解析 todo.md。
 * 2) 每一轮都启动一个全新的 Claude 会话（query() 默认创建干净上下文）。
 * 3) 让 Claude 自己读取 todo.md，挑选并执行 1 个任务（或判断无任务）。
 * 4) Claude 仅返回结构化 JSON；脚本只按 action 决定继续/停止。
 *
 * 这是 todo-agent-loop.mjs (Codex 版) 的 1:1 等价实现。
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// ── 日志模块 ──────────────────────────────────────────────

const LOG_FILENAME = "todo-claude-loop.log.md";

function getLogPath(workspacePath) {
  return path.resolve(workspacePath, LOG_FILENAME);
}

function initLogFile(logPath, options) {
  const now = new Date().toISOString();
  const header = [
    "# todo-claude-loop 执行日志",
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

function logRoundSuccess(logPath, round, result, sessionId) {
  const lines = [
    `**结束时间**: ${new Date().toISOString()}`,
    `**状态**: 成功`,
    `**Session**: \`${sessionId ?? "N/A"}\``,
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

function logRoundError(logPath, round, reason, sessionId) {
  const lines = [
    `**结束时间**: ${new Date().toISOString()}`,
    `**状态**: 失败`,
    `**Session**: \`${sessionId ?? "N/A"}\``,
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

// 传给 Claude 的 outputFormat schema（约束模型输出格式）。
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
      "  npm run todo:claude -- [options]",
      "",
      "Options:",
      "  --todo <path>            Path to todo.md (default: ./todo.md)",
      "  --workspace <path>       Workspace root for Claude session (default: cwd)",
      "  --max-tasks <n>          Max rounds per run (default: all)",
      "  --round-timeout-sec <n>  Timeout per round in seconds (default: 900)",
      "  --codex-model <name>     Optional model override (kept for compat)",
      "  --dry-run                Ask Claude to inspect and report only (no file/code changes)",
      "  --help                   Show help",
      "",
      "Auth:",
      "  Uses local Claude Code CLI login state.",
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

// 每一轮给 Claude 的统一指令：
// - 必须先读 todo 文件
// - 必须自主找"下一项可执行任务"
// - 每轮只执行一个任务
// - dry-run 只更新 todo.md 状态，不执行实际代码变更
function buildPrompt({ todoPath, workspacePath, dryRun }) {
  const modeInstructions = dryRun
    ? [
        "Mode: DRY RUN.",
        "Read the todo file and identify the next actionable task by yourself.",
        "Task selection priority: Doing > Block (network-retryable, not Retry Exhausted) > Todo (topmost).",
        "Network-retryable blocks: timeout, connection reset, DNS failure, gateway error.",
        "If there is no actionable task, return action=stop (taskId='N/A', taskStatus='none') and summary.",
        "If there is an actionable task, DO NOT execute any code changes or modify any file other than todo.md.",
        "Mark that task as Done in todo.md and append one concise record to the change log section.",
        "Do not execute the next task in the same round.",
        "Return action=continue with taskId/taskStatus/summary.",
      ]
    : [
        "Mode: EXECUTION.",
        "Read the todo file and identify the next actionable task by yourself.",
        "Task selection priority: Doing > Block (network-retryable, not Retry Exhausted) > Todo (topmost).",
        "Network-retryable blocks: timeout, connection reset, DNS failure, gateway error.",
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
    throw new Error("Unable to parse Claude round result JSON.");
  }
}

// 执行"单轮"任务：
// - 调用 query() 创建全新 Claude 会话
// - 按消息类型监听执行状态
// - 收集最终 structured_output / result（期望是 JSON）
// - 返回统一结果对象（ok / reason / parsed payload）
async function executeRound(round, options) {
  const prompt = buildPrompt(options);
  let turnCompleted = false;
  let turnFailedReason = null;
  let finalResult = null;
  let sessionId = null;

  // 超时控制
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Round timeout after ${options.roundTimeoutSec}s`));
  }, options.roundTimeoutSec * 1000);

  const queryOptions = {
    cwd: options.workspacePath,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    outputFormat: {
      type: "json_schema",
      schema: CodexOutputSchema,
    },
    abortController: controller,
  };

  if (options.codexModel) {
    queryOptions.model = options.codexModel;
  }

  try {
    for await (const message of query({
      prompt,
      options: queryOptions,
    })) {
      // 会话初始化事件
      if (message.type === "system" && message.subtype === "init") {
        sessionId = message.session_id;
        console.log(`${makeLogPrefix(round)} session started ${sessionId}`);
      }

      // 结果事件
      if (message.type === "result") {
        if (message.subtype === "success") {
          turnCompleted = true;
          finalResult = message.structured_output ?? message.result;
          console.log(`${makeLogPrefix(round)} turn completed`);
        } else {
          turnFailedReason = message.errors?.join("; ") ?? "turn failed";
          console.log(`${makeLogPrefix(round)} turn failed: ${turnFailedReason}`);
        }
      }
    }
  } catch (err) {
    // 尽可能收集完整错误信息
    const parts = [err.message];
    if (err.stderr) parts.push(`stderr: ${err.stderr}`);
    if (err.stdout) parts.push(`stdout: ${err.stdout}`);
    if (err.cause) parts.push(`cause: ${err.cause.message ?? err.cause}`);
    if (err.code) parts.push(`code: ${err.code}`);
    if (err.stack) parts.push(`stack: ${err.stack}`);
    turnFailedReason = parts.join("\n");
  } finally {
    clearTimeout(timeout);
  }

  if (!turnCompleted || turnFailedReason) {
    return {
      ok: false,
      sessionId,
      reason: normalizeSingleLine(turnFailedReason ?? "round did not complete"),
      result: null,
    };
  }

  const parsed = parseRoundResult(
    typeof finalResult === "string" ? finalResult : JSON.stringify(finalResult),
  );
  return { ok: true, sessionId, reason: "success", result: parsed };
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
      logRoundError(logPath, round, result.reason, result.sessionId);

      if (/auth|login|signin|sign in/i.test(result.reason)) {
        exitReason = `认证错误: ${result.reason}`;
        logFinalSummary(logPath, processed, round, exitReason);
        throw new Error(
          `${result.reason}\nTip: run 'claude' once and sign in, then rerun.`,
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
    logRoundSuccess(logPath, round, payload, result.sessionId);

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
