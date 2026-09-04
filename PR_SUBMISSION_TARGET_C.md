Fixes #241

### Summary
Adds comprehensive unit tests covering `AgentInstanceManager` FIFO eviction semantics when `maxInstances` capacity is reached or exceeded.

- Verifies default `maxInstances` is 5,000 when option is omitted.
- Verifies eviction of the oldest instance when exceeding configured capacity (`maxInstances: 2`).
- Verifies strict FIFO preservation across multiple consecutive evictions (`a, b, c -> b, c, d -> c, d, e -> d, e, f`).
- Verifies accessing existing instances does not trigger eviction or increase instance size.
- Verifies single-entry sliding window behavior when `maxInstances: 1`.
- Verifies manual `delete()` and `clear()` operations adjust capacity correctly without premature FIFO eviction.
- Verifies re-adding an evicted `agentId` creates a fresh instance without retaining stale references.
- Verifies all instances are retained when count is below capacity limit.

### Testing
- `npm test`: 55/55 test files passed (235/235 tests passed)
- `npm run typecheck`: clean (0 errors)
- `npm run lint`: clean (0 errors)
