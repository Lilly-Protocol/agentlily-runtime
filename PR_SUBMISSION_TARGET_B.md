Fixes #252
Fixes #262

### Summary
Aligns `TaskRunner` error propagation with runtime contracts and surfaces corrupt `JsonFileMemoryStore` files as typed `RuntimeError`s instead of silently discarding history.

- Propagates tool execution errors (`Error` and `RuntimeError`) untouched without wrapping into `EXECUTION_FAILED`.
- Wraps only memory store append rejections in `RuntimeError("EXECUTION_FAILED", cause)`, preserving existing `RuntimeError` instances.
- Adds `"STORAGE_CORRUPTED"` to `RuntimeErrorCode` and surfaces unparseable or non-array memory store files via `RuntimeError("STORAGE_CORRUPTED")`.
- Prevents `JsonFileMemoryStore.append()` from overwriting corrupt on-disk history files.
- Preserves safe handling of empty or whitespace-only files as `[]`.
- Adds dedicated reproduction suites in `tests/tasks/reproduce-issue-252.test.ts` and `tests/memory/reproduce-issue-262.test.ts`.
- Updates `tests/task-runner.test.ts` and `tests/file-memory-store.test.ts` to match active contract specifications.

### Testing
- Reproduction tests: 2/2 passed
- Full test suite: 58/58 files passed (244/244 tests passed, 100% pass)
- Global coverage: 95.91% statements, 92.81% branch, 91.00% functions, 95.91% lines
- Typecheck: clean (0 errors)
- Linter: clean (0 errors)
