src/runtime/agent_runtime.py
from __future__ import annotations

import asyncio
from typing import Any, Callable, Dict, List, Optional
from enum import Enum

class INVALID_TASK(RuntimeError):
    """Exception raised when a task payload fails non-empty validation before event emission."""
    def __init__(self, message: str = ""):
        super().__init__(message)

class AgentRuntime:
    def __init__(self, runner: Optional[Any] = None) -> None:
        self._runner = runner
        self._listeners: Dict[str, List[Callable]] = {}
        self._current_task: Optional[Dict[str, Any]] = None

    def _notify(self, event_name: str, data: Dict[str, Any]) -> None:
        """Emit an event to all registered listeners. Pythonic equivalent of event emission."""
        listeners = self._listeners.get(event_name, [])
        for listener in listeners:
            asyncio.create_task(listener(data))

    def on(self, event_name: str, listener: Callable) -> None:
        """Register a listener for a specific event."""
        if event_name not in self._listeners:
            self._listeners[event_name] = []
        self._listeners[event_name].append(listener)

    async def execute_task(self, task: Dict[str, Any]) -> None:
        """
        Orchestrates the task lifecycle. Validates fields *before* emitting 
        `runtime.task.received` to ensure the event stream is polluted only by 
        genuinely received tasks.
        
        1. Validates `taskId`, `agentId`, etc. (The Shared Guard).
        2. Emits `task_received`.
        3. Delegates to `TaskRunner` (which handles execution logic).
        """
        # 1. Shared Guard: Validate non-empty critical fields
        # Using task.get() safely, raising INVALID_TASK on emptiness.
        if not task.get("taskId"):
            raise INVALID_TASK("taskId is required")
        if not task.get("agentId"):
            raise INVALID_TASK("agentId is required")
        if not task.get("toolName", "default"): # Optional toolName
            pass
        if not task.get("input", {}): # Optional input
            pass

        # 2. Emit the 'received' event so listeners know a valid task arrived
        self._notify("task_received", task)
        self._current_task = task

        # 3. Delegate to the TaskRunner for heavy lifting
        # Note: Runner might emit 'task_failed' or similar if execution diverges
        if self._runner:
            await self._runner.run(task)

    def get_current_task(self) -> Optional[Dict[str, Any]]:
        """Helper to introspect the currently active task."""
        return self._current_task

# Example TaskRunner for context (simulating src/tasks/task_runner.py)
class TaskRunner:
    def __init__(self) -> None:
        pass

    async def run(self, task: Dict[str, Any]) -> None:
        """
        Executes the actual task logic. 
        Accepts a pre-validated task from AgentRuntime.
        """
        # Simulate processing time
        await asyncio.sleep(0.01)

        # Example logic that might pollute state if not caught by AgentRuntime
        # self._notify('task_failed', task) 
        pass

    @classmethod
    def create(cls, runner_impl: Any = None) -> TaskRunner:
        runner_impl = runner_impl or cls()
        return runner_impl