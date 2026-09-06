Fixes #231

### Summary
Eliminates duplicate `warn()` declarations and restores strict log level threshold filtering in `ConsoleRuntimeLogger`.

- Consolidated `warn()` method implementation and gated output behind `shouldLog(level)` check against configured priority (`debug: 0, info: 1, warn: 2, error: 3`).
- Preserved metadata redaction via `DEFAULT_REDACT_KEYS` regex.
- Added level filtering tests in `tests/logger/issue-231-console-logger-dedup.test.ts` verifying `info` and `warn` suppression when level is set to `error`.

### Testing
- `npm test`: 56/56 test files passed (232/232 tests)
- `npm run typecheck`: clean (exit code 0)
- `npm run lint`: clean (exit code 0)
