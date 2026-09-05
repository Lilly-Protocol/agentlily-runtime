Fixes #228

### Summary
Resolves `TypeError: completedAt.toISOString is not a function` when TaskRunner records task completion in memory.

- `completedAt` is already generated as an ISO string via `new Date().toISOString()`; passing it directly to `recordedAt` avoids calling `.toISOString()` on an existing string.
- Added regression test verifying `TaskRunner.run()` completes successfully and produces an ISO string accepted by `Date.parse()`.
- Guarantees memory entries record timestamp parity with `result.completedAt`.

### Testing
- `npm test`: 56/56 test files passed (228/228 tests)
- `npm run typecheck`: clean (exit code 0)
- `npm run lint`: clean (exit code 0)
