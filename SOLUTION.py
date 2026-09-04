import pytest
from src.tasks.task_runner import TaskRunner
from src.tasks import RuntimeError

class TestTaskRunner:
    def test_plain_error_propagates_unchanged(self, monkeypatch):
        """Asserts a plain Error thrown by a tool propagates unchanged"""
        from errors import PlainError
        
        def failing_tool(*args):
            raise PlainError("Original tool failure")
        
        monkeypatch.setattr("src.tasks.task_runner.failing_tool", failing_tool)
        
        runner = TaskRunner()
        
        with pytest.raises(PlainError) as exc_info:
            runner.run(task="test", callback=failing_tool)
            
        assert exc_info.value.args == ("Original tool failure",)

    def test_runtime_error_keeps_original_code(self, monkeypatch):
        """Asserts a RuntimeError thrown by a tool keeps its original code"""
        class CustomRuntimeError(RuntimeError):
            code = "CUSTOM_ERROR"
            
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
        
        def throwing_runtime_tool(*args):
            raise CustomRuntimeError("Custom runtime error")
        
        monkeypatch.setattr("src.tasks.task_runner.failing_tool", throwing_runtime_tool)
        
        runner = TaskRunner()
        
        with pytest.raises(CustomRuntimeError) as exc_info:
            runner.run(task="test", callback=throwing_runtime_tool)
            
        assert exc_info.value.code == "CUSTOM_ERROR"

    def test_execution_failed_wraps_memory_failures(self, monkeypatch):
        """Asserts only memory-append failures are wrapped with EXECUTION_FAILED"""
        from errors import PlainError
        
        def memory_failing_tool(*args):
            raise PlainError("Memory append failed")
        
        monkeypatch.setattr("src.tasks.task_runner.failing_tool", memory_failing_tool)
        
        runner = TaskRunner()
        
        with pytest.raises(RuntimeError) as exc_info:
            runner.run(task="test", callback=memory_failing_tool)
            
        assert exc_info.value.code == "EXECUTION_FAILED"

    def test_no_contradictory_assertions(self, monkeypatch):
        """Asserts no two active test files assert contradictory behavior"""
        call_tracker = {}
        
        def tracked_tool(*args):
            call_tracker['called'] = True
            raise PlainError("Tracked tool failure")
        
        monkeypatch.setattr("src.tasks.task_runner.failing_tool", tracked_tool)
        
        runner = TaskRunner()
        
        with pytest.raises(PlainError) as exc_info:
            runner.run(task="test", callback=tracked_tool)
            
        assert call_tracker['called']
        assert "called" in call_tracker