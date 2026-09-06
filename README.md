# agentlily-runtime

[![CI](https://img.shields.io/github/actions/workflow/status/lily-protocol/agentlily-runtime/ci.yml?branch=main)](https://github.com/lily-protocol/agentlily-runtime/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)](https://www.typescriptlang.org/)

`agentlily-runtime` is the execution layer for AgentLily instances in Lily
Protocol, the autonomous agent finance infrastructure being built on Stellar.

This repository is intentionally designed as an open-source-ready runtime
foundation, not a completed runtime product. It provides:

- A modular TypeScript runtime architecture
- One real happy-path execution flow for contributors to study and extend
- Strict typing, tests, linting, and CI scaffolding
- Clear extension points for unfinished systems

## What Exists Today

The current implementation demonstrates a narrow, credible runtime path:

1. Create an `AgentRuntime`
2. Start the runtime and register tools
3. Build a runtime context for a task
4. Execute a task through the task runner and action executor
5. Invoke a typed tool
6. Persist lightweight in-memory task history (or durable JSON file history via memoryStoragePath)
7. Emit runtime events and structured log entries

This gives contributors a working reference path without locking the project
into premature architecture.

## What Is Intentionally Unfinished

The following areas are scaffolded with interfaces, types, or placeholders and
are expected to become contributor work:

- Wallet-aware and payment-aware actions
- Persistent database and vector storage backends (basic file-based JSON persistence is supported via JsonFileMemoryStore)
- Model provider integrations (an `OpenAICompatibleModelProvider` scaffold is available for experimentation; note that it is scaffolded and intentionally not production-complete)
- Runtime policy engines and approval flows
- Long-running orchestration and scheduling
- Distributed execution and durable coordination
- Identity-aware execution logic
- Rich tracing, metrics, and production observability

## Repository Layout

```text
src/
  actions/     Minimal action execution flow
  agents/      Agent instance lifecycle scaffolding
  errors/      Typed runtime errors
  events/      Runtime event model and event bus
  guards/      Runtime assertions and guardrails
  logger/      Structured logger abstraction
  memory/      In-memory store plus storage interface
  providers/   Model/provider abstraction layer
  runtime/     Bootstrap, context, and runtime composition
  state/       Runtime state interface
  tasks/       Task runner and task types
  tools/       Tool contracts and registry
tests/         Foundation and happy-path tests
```

## Quick Start

```bash
npm install
npm run build
npm run test
```

Example:

```ts
import { AgentRuntime } from "@lily-protocol/agentlily-runtime";

const runtime = new AgentRuntime({
  runtimeId: "local-dev"
});

runtime.registerTool({
  name: "echo",
  description: "Returns a string payload for test execution",
  async execute(input) {
    return { echoed: String(input.payload.message ?? "") };
  }
});

await runtime.start();

const result = await runtime.executeTask({
  agentId: "agent-demo",
  taskId: "task-001",
  toolName: "echo",
  input: "Send a greeting",
  payload: { message: "hello lily" }
});

console.log(result.output);
```

### Durable Memory via JsonFileMemoryStore

By default, `AgentRuntime` uses `InMemoryMemoryStore`. For durable file-backed persistence across process restarts, pass `memoryStoragePath`:

```ts
import { AgentRuntime } from "@lily-protocol/agentlily-runtime";

const runtime = new AgentRuntime({
  runtimeId: "local-dev",
  memoryStoragePath: "./data/task-history.json"
});
```

When `memoryStoragePath` is configured, runtime bootstrap initializes a `JsonFileMemoryStore` targeting that file path.

#### Persisted Entry Shape

Entries are stored as a JSON array of `MemoryEntry` objects formatted with 2-space indentation:

```json
[
  {
    "agentId": "agent-demo",
    "taskId": "task-001",
    "input": "Send a greeting",
    "output": {
      "echoed": "hello lily"
    },
    "recordedAt": "2026-09-06T07:20:00.000Z"
  }
]
```

Each `MemoryEntry` includes:

- `agentId` (`string`): Identifier of the agent executing the task
- `taskId` (`string`): Unique task execution identifier
- `input` (`string`): Task input string or instruction
- `output` (`unknown`): Tool execution output payload returned by the action executor
- `recordedAt` (`string`): ISO 8601 timestamp when the entry was recorded

#### Known Caveats & Limitations

- **Whole-file rewrite on each append**: `JsonFileMemoryStore` serializes and rewrites the entire JSON file on every `append()`. This is suitable for development and lightweight single-agent runs, but not high-throughput production workloads.
- **No capacity limit**: Unlike `InMemoryMemoryStore` (which enforces `maxEntries` and `maxEntriesPerAgent`), `JsonFileMemoryStore` currently has no bounding or eviction policy; the file grows unbounded until cleared.
- **Single-process concurrency**: No cross-process file locking is implemented. Concurrent writes from multiple runtime processes to the same path may result in lost updates.

## Scripts

- `npm run build` compiles the library
- `npm run lint` runs ESLint
- `npm run typecheck` runs TypeScript in no-emit mode
- `npm run test` runs Vitest with coverage
- `npm run verify` runs formatting, linting, typecheck, and tests

## Contributor Guidance

Good first contributions should add depth without collapsing extension points.
Examples:

- Add a new memory backend that implements `MemoryStore`
- Introduce runtime policies around tool allowlists
- Add an event sink or tracing adapter
- Implement a model provider adapter with tests
- Expand task lifecycle states beyond the current happy path

## Suggested Next Issues

Maintainers can immediately create issues around:

- Provider adapters
- Runtime policies
- Persistent storage
- Wallet-aware execution boundaries
- Observability
- Documentation examples
- Test matrix expansion

The backlog section in the final delivery summary from this setup provides a
ready-made issue starter list.
