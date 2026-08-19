from __future__ import annotations

from pathlib import Path
import sys
import unittest


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_seven_validator_voting_power import evaluate  # noqa: E402


class SevenValidatorVotingPowerTest(unittest.TestCase):
    def test_accepts_seven_validators_above_current_and_two_thirds(self):
        current = [{"tokens": "1000000000000000000"}]
        planned = [{"self_delegation_ulitho": "2000000000000000000"} for _ in range(7)]
        result = evaluate(current, planned)
        self.assertTrue(result["ready"])

    def test_rejects_equal_stake_and_wrong_count(self):
        current = [{"tokens": "1000000000000000000"}]
        planned = [{"self_delegation_ulitho": "1000000000000000000"} for _ in range(6)]
        result = evaluate(current, planned)
        self.assertFalse(result["ready"])
        self.assertFalse(result["checks"]["exactly_seven_planned"])
        self.assertFalse(result["checks"]["every_new_validator_exceeds_comparison"])

    def test_rejects_when_existing_stake_prevents_two_thirds(self):
        current = [{"tokens": "100000000000000000000"}]
        planned = [{"self_delegation_ulitho": "100000000000000000001"} for _ in range(7)]
        result = evaluate(current, planned)
        self.assertTrue(result["ready"])

        planned = [{"self_delegation_ulitho": "1"} for _ in range(7)]
        result = evaluate(current, planned)
        self.assertFalse(result["checks"]["projected_new_group_exceeds_two_thirds"])

    def test_uses_named_original_validator_after_new_validators_join(self):
        current = [
            {"operator_address": "lithovaloper1original", "tokens": "100"},
            {"operator_address": "lithovaloper1new", "tokens": "200"},
        ]
        planned = [{"self_delegation_ulitho": "101"} for _ in range(7)]
        result = evaluate(current, planned, comparison_operator="lithovaloper1original")
        self.assertTrue(result["checks"]["comparison_validator_found"])
        self.assertTrue(result["checks"]["every_new_validator_exceeds_comparison"])

    def test_fails_closed_when_named_comparison_validator_is_missing(self):
        current = [{"operator_address": "lithovaloper1other", "tokens": "100"}]
        planned = [{"self_delegation_ulitho": "200"} for _ in range(7)]
        result = evaluate(current, planned, comparison_operator="lithovaloper1missing")
        self.assertFalse(result["ready"])
        self.assertFalse(result["checks"]["comparison_validator_found"])


if __name__ == "__main__":
    unittest.main()
