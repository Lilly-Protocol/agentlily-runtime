Fixes #229

### Summary
Exposes an explicit public `off()` method on `RuntimeEventBus` for listener deregistration.

- Implemented `off(eventName, listener): boolean` removing registered listeners from the internal per-event set.
- Returns `true` when a listener is successfully removed and `false` when the listener was not registered.
- Added unit tests in `tests/events/issue-229-runtime-event-bus-off.test.ts` covering single removal, listener count decrements, and non-existent listener handling.

### Testing
- `npm test`: 56/56 test files passed (230/230 tests)
- `npm run typecheck`: clean (exit code 0)
- `npm run lint`: clean (exit code 0)
