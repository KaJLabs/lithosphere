from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import sys
import tempfile
import unittest


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verify_l1_release_approval import verify  # noqa: E402


class L1ReleaseApprovalTest(unittest.TestCase):
    def fixture(self, directory: str) -> tuple[Path, Path]:
        root = Path(directory)
        binary = root / "lithod"
        binary.write_bytes(b"exact-candidate")
        for name in ("autha.txt", "kaj.txt"):
            (root / name).write_text("approved\n", encoding="utf-8")

        def approval(name: str) -> dict[str, str]:
            artifact = root / name
            return {
                "decision": "approved",
                "approvalReference": f"approval-{name}",
                "approvedAt": "2026-09-03T09:00:00Z",
                "artifactPath": name,
                "artifactSha256": hashlib.sha256(artifact.read_bytes()).hexdigest(),
            }

        data = {
            "schemaVersion": 1,
            "approvalId": "L1-MAKALU-001",
            "releaseId": "litho-l1-v20.0.0-r2",
            "binarySha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
            "environment": "makalu",
            "cosmosChainId": "lithosphere_700777-2",
            "evmChainId": 700777,
            "validator": "mtest-val-02",
            "executionOperator": "operator-a",
            "independentObserver": "observer-b",
            "singleValidatorPauseRequired": True,
            "singleValidatorPauseApproved": True,
            "window": {
                "startsAt": "2026-09-03T10:00:00Z",
                "endsAt": "2026-09-03T11:00:00Z",
            },
            "authaApproval": approval("autha.txt"),
            "kajLabsApproval": approval("kaj.txt"),
        }
        path = root / "approval.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        return path, binary

    def test_accepts_complete_preapproved_window(self):
        with tempfile.TemporaryDirectory() as directory:
            approval, binary = self.fixture(directory)
            result = verify(
                approval,
                binary,
                "makalu",
                datetime(2026, 9, 3, 10, 30, tzinfo=timezone.utc),
            )
            self.assertEqual(result["result"], "approved")

    def test_rejects_approval_after_window_start(self):
        with tempfile.TemporaryDirectory() as directory:
            approval, binary = self.fixture(directory)
            data = json.loads(approval.read_text(encoding="utf-8"))
            data["authaApproval"]["approvedAt"] = "2026-09-03T10:01:00Z"
            approval.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "approvals must predate"):
                verify(approval, binary, "makalu", datetime(2026, 9, 3, 10, 30, tzinfo=timezone.utc))

    def test_rejects_same_operator_and_observer(self):
        with tempfile.TemporaryDirectory() as directory:
            approval, binary = self.fixture(directory)
            data = json.loads(approval.read_text(encoding="utf-8"))
            data["independentObserver"] = data["executionOperator"]
            approval.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "must differ"):
                verify(approval, binary, "makalu", datetime(2026, 9, 3, 10, 30, tzinfo=timezone.utc))

    def test_rejects_binary_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            approval, binary = self.fixture(directory)
            binary.write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "binary SHA-256 mismatch"):
                verify(approval, binary, "makalu", datetime(2026, 9, 3, 10, 30, tzinfo=timezone.utc))

    def test_rejects_unapproved_single_validator_pause(self):
        with tempfile.TemporaryDirectory() as directory:
            approval, binary = self.fixture(directory)
            data = json.loads(approval.read_text(encoding="utf-8"))
            data["singleValidatorPauseApproved"] = False
            approval.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "pause requires explicit approval"):
                verify(approval, binary, "makalu", datetime(2026, 9, 3, 10, 30, tzinfo=timezone.utc))


if __name__ == "__main__":
    unittest.main()
