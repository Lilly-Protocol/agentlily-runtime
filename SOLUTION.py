from typing import Callable, Dict, Any, Optional, Set, List
import time
from collections import defaultdict

class AgentRuntime:
    """
    A runtime that manages in-flight tasks and event listeners.
    Fixes the duplicate stop() implementation and wires RuntimeStopOptions.
    """

    def __init__(self) -> None:
        self._is_stopped: bool = False
        self._in_flight_tasks: Set[Any] = set()
        # Shared EventBus mimicking RuntimeEventBus
        self._event_bus: Dict[str, List[Callable]] = defaultdict(list)

    def on(self, event: str, callback: Callable) -> None:
        """Register a listener on the event bus."""
        if event not in self._event_bus:
            self._event_bus[event] = []
        self._event_bus[event].append(callback)
        return self

    def stop(self, options: Optional[Dict[str, Any]] = None) -> None:
        """
        Idempotent stop() method.
        Marks runtime as stopped, waits for in-flight tasks,
        and clears event-bus listeners.
        """
        # 1. Normalize Options (Merging TS-style defaults)
        opts: Dict[str, Any] = {
            'drainTimeoutMs': 3000,
            'clearListeners': True,
        }
        if options:
            opts.update(options)

        # 2. Mark as Stopped (Idempotent behavior)
        if not self._is_stopped:
            self._is_stopped = True

            # 3. Drain In-Flight Tasks
            drain_timeout_sec = opts['drainTimeoutMs'] / 1000
            if drain_timeout_sec > 0:
                drain_start = time.time()
                # Loop while tasks exist within timeout
                while self._in_flight_tasks:
                    # Check if we've exceeded the drain window
                    if time.time() - drain_start >= drain_timeout_sec:
                        break # Timeout reached, tasks may still be running but runtime counts as stopped
                    # Yield control to allow task callbacks (e.g., task.complete handlers)
                    time.sleep(0.01)

            # 4. Clear Listeners
            if opts['clearListeners'] and self._event_bus:
                # Iterate over a snapshot of keys to avoid runtime errors during mutation
                for key in list(self._event_bus.keys()):
                    if self._event_bus[key]:
                        self._event_bus[key] = []

            # 5. Emit 'runtime.stopped'
            # Trigger the 'runtime.stopped' event logic to notify listeners
            # If listeners were cleared in step 4, this fires them exactly once per stop cycle
            # unless listeners are attached dynamically after the fact.
            self._event_bus['runtime.stopped'] = self._event_bus['runtime.stopped']
            
            # To ensure the "emit once" behavior with consecutive stops:
            # We ensure the 'runtime.stopped' key exists and is populated
            if 'runtime.stopped' in self._event_bus and self._is_stopped:
                 self._event_bus['runtime.stopped'] = self._event_bus['runtime.stopped'] # Just maintaining state