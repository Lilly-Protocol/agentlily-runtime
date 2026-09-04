Fixes #230

### Summary
Makes `JsonFileMemoryStore` fully satisfy the `MemoryStore` interface contract and align with `InMemoryMemoryStore` semantics.

- Updates `listByAgent(agentId, options?)` to respect `options.offset` and `options.limit` with defensive copying of returned entries.
- Implements `countByAgent(agentId)` to return matching entry counts.
- Implements `size()` returning total entry count asynchronously, avoiding type clashes with `InMemoryMemoryStore.size`.
- Defensively copies entries in `append()` to prevent caller mutation of stored state.
- Adds `JsonFileMemoryStoreOptions` supporting optional `maxEntries` and `maxEntriesPerAgent` with FIFO eviction.
- Adds tests in `tests/memory/reproduce-issue-230.test.ts` and expands `tests/file-memory-store.test.ts`.

### Testing
- `npm test`: 56/56 test files passed (238/238 tests, 96.04% line coverage)
- `npm run typecheck`: clean (0 errors)
- `npm run lint`: clean (0 errors)
