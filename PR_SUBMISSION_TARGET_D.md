Fixes #251

### Summary
Ensures `RuntimeEventBus.off()` can successfully deregister listeners that were subscribed using `RuntimeEventBus.once()`.

- Stores a reference to the original listener on the wrapper function returned by `once()`.
- Updates `RuntimeEventBus.off()` to check for wrapped `once()` listeners when deleting by original listener reference.
- Ensures listeners registered via `once()` are properly removed from the listener set upon firing or when explicitly removed with `off()`.
- Adds unit tests in `tests/events/runtime-events.test.ts` verifying `once()` execution, automatic deregistration, `off()` cancellation, and returned `unsubscribe()` cleanup.

### Testing
- `npm test`: 55/55 test files passed (229/229 tests passed)
- `npm run typecheck`: clean (0 errors)
- `npm run lint`: clean (0 errors)
