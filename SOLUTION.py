from datetime import datetime
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Any, Optional

DEFAULT_MAX_LISTENERS: int = 100

@dataclass
class RuntimeInternalError:
    """Consolidated definition for runtime.internal.error payload shape."""
    eventName: str
    error: Any
    occurredAt: datetime = field(default_factory=datetime.now)

class RuntimeEventBus:
    """Consolidated RuntimeEventBus with single listenerCount logic."""
    
    def __init__(self, maxListeners: int = DEFAULT_MAX_LISTENERS):
        self._listeners: Dict[str, List[Callable]] = field(default_factory=dict)
        self._maxListeners = maxListeners

    def listener_count(self, name: Optional[str] = None) -> int:
        """Consolidated definition for listenerCount() matching the dual lines 106/145."""
        if name is None:
            return len(self._listeners)
        return len(self._listeners.get(name, []))

    def on(self, name: str, listener: Callable) -> None:
        """Standard listener attachment logic."""
        if self._listeners.get(name) is None:
            self._listeners[name] = []
        self._listeners[name].append(listener)

    def emit(self, name: str, payload: Any) -> int:
        """Emit logic that utilizes the RuntimeInternalError structure for context."""
        # Emit returns the number of listeners currently matched
        count = len(self._listeners.get(name, []))
        
        if name in self._listeners:
            for listener in self._listeners[name]:
                listener(payload)
        return count

    def onOnce(self, name: str, listener: Callable) -> Callable:
        """Convenience method for once semantics."""
        self.on(name, listener)
        return listener

    @property
    def listeners(self) -> Dict[str, List[Callable]]:
        return self._listeners

    def __len__(self) -> int:
        return self.listener_count()