from __future__ import annotations

import base64
import csv
from pathlib import Path
import sys
import tempfile
import unittest


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate_validator_intake import REQUIRED_COLUMNS, validate  # noqa: E402


def valid_row(number: int) -> dict[str, str]:
    return {
        "operator_id": f"operator-{number}",
        "moniker": f"validator-{number}",
        "operator_evm_address": f"0x{number:040x}",
        "operator_litho_address": f"lithovaloper1{'a' * 30}{number:x}",
        "consensus_pubkey": base64.b64encode(bytes([number]) * 32).decode(),
        "validator_node_id": f"{number:040x}",
        "sentry_peer_endpoints": f"{number + 100:040x}@sentry-{number}.example.com:26656",
        "self_delegation_ulitho": "1000000000000000000",
        "commission_rate": "0.10",
        "commission_max_rate": "0.20",
        "commission_max_change_rate": "0.01",
        "website": f"https://validator-{number}.example.com",
        "security_contact": f"security-{number}@example.com",
        "hosting_provider": f"provider-{number}",
        "region": f"region-{number}",
        "failure_domain": f"provider-{number}/region-{number}",
        "key_backup_attested": "true",
        "infrastructure_ready": "true",
        "security_reviewed": "true",
        "approval_reference": f"approval-{number}",
    }


class ValidatorIntakeTest(unittest.TestCase):
    def validate_rows(self, rows: list[dict[str, str]], minimum_new: int) -> dict:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "intake.csv"
            with path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=REQUIRED_COLUMNS)
                writer.writeheader()
                writer.writerows(rows)
            return validate(path, minimum_new)

    def test_accepts_complete_unique_public_records(self):
        result = self.validate_rows([valid_row(1), valid_row(2)], minimum_new=2)
        self.assertTrue(result["ready"])
        self.assertEqual(result["errors"], [])

    def test_rejects_duplicate_consensus_identity(self):
        first = valid_row(1)
        second = valid_row(2)
        second["consensus_pubkey"] = first["consensus_pubkey"]
        result = self.validate_rows([first, second], minimum_new=2)
        self.assertFalse(result["ready"])
        self.assertTrue(any("consensus_pubkey duplicates" in error for error in result["errors"]))

    def test_rejects_placeholders_and_incomplete_attestations(self):
        row = valid_row(1)
        row["approval_reference"] = "PENDING"
        row["security_reviewed"] = "false"
        result = self.validate_rows([row], minimum_new=1)
        self.assertFalse(result["ready"])
        self.assertTrue(any("approval_reference" in error for error in result["errors"]))
        self.assertTrue(any("security_reviewed must be true" in error for error in result["errors"]))

    def test_enforces_minimum_operator_count(self):
        result = self.validate_rows([valid_row(1)], minimum_new=2)
        self.assertFalse(result["ready"])
        self.assertTrue(any("at least 2" in error for error in result["errors"]))

    def test_enforces_exact_count_and_stake_above_live_comparator(self):
        result = self.validate_rows([valid_row(1), valid_row(2)], minimum_new=1)
        self.assertTrue(result["ready"])

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "intake.csv"
            with path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=REQUIRED_COLUMNS)
                writer.writeheader()
                writer.writerows([valid_row(1), valid_row(2)])
            result = validate(
                path,
                minimum_new=1,
                expected_new=7,
                minimum_self_delegation_exclusive=1_000_000_000_000_000_000,
            )
        self.assertFalse(result["ready"])
        self.assertTrue(any("exactly 7" in error for error in result["errors"]))
        self.assertTrue(any("must be greater than" in error for error in result["errors"]))

    def test_enforces_live_minimum_commission(self):
        row = valid_row(1)
        row["commission_rate"] = "0.04"
        result = self.validate_rows([row], minimum_new=1)
        self.assertFalse(result["ready"])
        self.assertTrue(any("commission_rate must be at least 0.05" in error for error in result["errors"]))


if __name__ == "__main__":
    unittest.main()
