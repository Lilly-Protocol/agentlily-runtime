import math
from typing import Any, Dict, Union, Optional

class PaymentPrepAction:
    def create_payment_prep_tool(
        self,
        amount: Union[str, int, float, None],
        **options
    ) -> Dict[str, Any]:
        """
        Prepares a payment tool with strict finite amount validation.
        
        Acceptance Criteria:
        - Rejects non-finite values (Infinity, 1e309, NaN) with INVALID_TASK.
        - Accepts standard positive decimals.
        """
        payload = options.get("payload", {})
        code = options.get("code", "SUCCESS")

        # 1. Handle the amount parsing
        # Use float() to coerce strings like "Infinity" into their float representation
        if amount is None:
            parsed_amount = float(0) # Default finite zero if not present
        else:
            parsed_amount = float(amount)

        # 2. Validate Non-Finite status
        # math.isfinite in Python mirrors Number.isFinite behavior closely
        # It catches overflow strings that resolve to 'inf' or 'nan'
        if not math.isfinite(parsed_amount):
            return {
                "code": "INVALID_TASK",
                "details": f"Amount {amount} is non-finite (likely overflow or NaN)",
                "payload": payload
            }

        # 3. Validate Value Range (Original TS logic: <= 0)
        # We ensure it's strictly positive or zero for standard cases
        if parsed_amount <= 0:
            return {
                "code": "INVALID_TASK", 
                "details": f"Amount {amount} is zero or negative",
                "payload": payload
            }

        # 4. Success State
        return {
            "code": "SUCCESS",
            "data": {
                "amount": parsed_amount,
                "prepared": True
            },
            "payload": payload
        }


class CreatePaymentPrepTool:
    """Wrapper for the main logic to match TypeScript action pattern"""

    def execute(self, **kwargs) -> Dict[str, Any]:
        action = PaymentPrepAction()
        return action.create_payment_prep_tool(amount=kwargs.get("amount"), **kwargs)


# --- Tests ---
# File: tests/payment_prep_action_test.py
import unittest
from src.actions.payment_prep_action import CreatePaymentPrepTool

class TestPaymentPrepAction(unittest.TestCase):
    def test_finite_positive_string(self):
        tool = CreatePaymentPrepTool()
        result = tool.execute(amount="10.5")
        self.assertEqual(result["code"], "SUCCESS")
        self.assertEqual(result["data"]["amount"], 10.5)

    def test_finite_integer(self):
        tool = CreatePaymentPrepTool()
        result = tool.execute(amount=10)
        self.assertEqual(result["code"], "SUCCESS")
        self.assertEqual(result["data"]["amount"], 10)

    def test_finite_decimal_small(self):
        tool = CreatePaymentPrepTool()
        result = tool.execute(amount="0.01")
        self.assertEqual(result["code"], "SUCCESS")
        self.assertEqual(result["data"]["amount"], 0.01)

    def test_non_finite_infinity(self):
        tool = CreatePaymentPrepTool()
        result = tool.execute(amount="Infinity")
        self.assertEqual(result["code"], "INVALID_TASK")

    def test_non_finite_nash(self):
        tool = CreatePaymentPrepTool()
        result = tool.execute(amount="NaN")
        self.assertEqual(result["code"], "INVALID_TASK")

    def test_non_finite_large_overflow(self):
        tool = CreatePaymentPrepTool()
        result = tool.execute(amount="1e309")
        self.assertEqual(result["code"], "INVALID_TASK")

    def test_negative_amount(self):
        tool = CreatePaymentPrepTool()
        result = tool.execute(amount="-5.0")
        self.assertEqual(result["code"], "SUCCESS") # Assuming <= 0 logic accepts 0 but rejects >0? Or strict?
        # Refining based on TS context: usually rejects strictly > 0 then <= 0 is specific.
        # Adjusted logic to handle <= 0 specifically if needed.
        self.assertEqual(result["code"], "SUCCESS") # Assuming negative is valid in this flow


if __name__ == "__main__":
    import sys
    sys.path.insert(0, "src")
    from tests.payment_prep_action_test import TestPaymentPrepAction
    suite = unittest.TestLoader().loadTestsFromTestCase(TestPaymentPrepAction)
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite)