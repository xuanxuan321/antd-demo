# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is currently not compatible with SWC. See [this issue](https://github.com/vitejs/vite-plugin-react/issues/428) for tracking the progress.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## E2E Baseline

- Install browser once locally: `npx playwright install chromium`
- Run E2E regression suite: `npm run test:e2e`
- Run E2E in headed mode: `npm run test:e2e:headed`

The CI workflow is in `.github/workflows/ci.yml` and runs `lint + build + playwright e2e` on `push` and `pull_request`.

## Todo Autopilot

项目提供两个 AI 驱动的 todo.md 自动执行脚本，它们以循环方式逐个执行 `todo.md` 中的任务，每轮启动全新会话。

### Codex 版 (OpenAI Codex SDK)

需要先通过 `codex` CLI 登录 ChatGPT。

```bash
# 执行所有任务
npm run todo:autopilot

# 带参数
node scripts/todo-agent-loop.mjs [options]
```

### Claude 版 (Claude Agent SDK)

需要先通过 `claude` CLI 登录。

```bash
# 执行所有任务
npm run todo:claude

# Dry-run（只识别不执行）
npm run todo:claude:dry

# 带参数
node scripts/todo-claude-loop.mjs [options]
```

### 通用参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--todo <path>` | todo.md 路径 | `./todo.md` |
| `--workspace <path>` | 工作区根目录 | 当前目录 |
| `--max-tasks <n>` | 最大执行轮次 | 不限 |
| `--round-timeout-sec <n>` | 单轮超时秒数 | 900 |
| `--codex-model <name>` | 模型覆盖 | — |
| `--dry-run` | 只识别任务不执行 | — |
