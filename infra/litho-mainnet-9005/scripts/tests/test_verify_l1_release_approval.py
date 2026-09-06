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
    release = "litho-l1-v20.0.0-r2"
    when = datetime(2026, 9, 3, 10, 30, tzinfo=timezone.utc)

    def fixture(self, directory: str) -> tuple[Path, Path, Path]:
        root = Path(directory)
        binary = root / "lithod"
        binary.write_bytes(b"exact-candidate")
        expected = {
            "releaseId": self.release, "environment": "makalu",
            "cosmosChainId": "lithosphere_700777-2", "evmChainId": 700777,
            "validator": "mtest-val-02", "singleValidatorPauseApproved": True,
        }

        def approval(name: str, approval_type: str) -> dict[str, str]:
            artifact = root / name
            artifact.write_text(json.dumps({
                "schemaVersion": 1, "approvalType": approval_type,
                "decision": "approved", "approvalReference": f"approval-{name}",
                "approvedAt": "2026-09-03T09:00:00Z", **expected,
            }), encoding="utf-8")
            return {"artifactPath": name, "artifactSha256": hashlib.sha256(artifact.read_bytes()).hexdigest()}

        (root / "approval.json.asc").write_text("test signature", encoding="utf-8")
        data = {
            "schemaVersion": 2, "approvalId": "L1-MAKALU-001", **expected,
            "binarySha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
            "executionOperator": "operator-a", "independentObserver": "observer-b",
            "singleValidatorPauseRequired": True,
            "window": {"startsAt": "2026-09-03T10:00:00Z", "endsAt": "2026-09-03T11:00:00Z"},
            "authaApproval": approval("autha.json", "autha-l1-release"),
            "kajLabsApproval": approval("kaj.json", "kaj-labs-l1-release"),
            "bundleSignaturePath": "approval.json.asc",
        }
        path = root / "approval.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        public_key = root / "public.asc"
        public_key.write_text("test public key", encoding="utf-8")
        return path, binary, public_key

    @staticmethod
    def signature_ok(_artifact: Path, _signature: Path, _key: Path) -> None:
        return None

    def run_verify(self, approval: Path, binary: Path, key: Path):
        return verify(approval, binary, "makalu", self.when, self.release, key, self.signature_ok)

    def mutate(self, approval: Path, callback) -> None:
        data = json.loads(approval.read_text(encoding="utf-8"))
        callback(data)
        approval.write_text(json.dumps(data), encoding="utf-8")

    def test_accepts_authenticated_exact_profile(self):
        with tempfile.TemporaryDirectory() as directory:
            approval, binary, key = self.fixture(directory)
            self.assertEqual(self.run_verify(approval, binary, key)["result"], "approved")

    def test_rejects_same_operator_and_observer(self):
        with tempfile.TemporaryDirectory() as directory:
            approval, binary, key = self.fixture(directory)
            self.mutate(approval, lambda data: data.update(independentObserver=data["executionOperator"]))
            with self.assertRaisesRegex(ValueError, "must differ"):
                self.run_verify(approval, binary, key)

    def test_rejects_wrong_release_or_network_or_validator(self):
        mutations = (
            lambda d: d.update(releaseId="WRONG-RELEASE"),
            lambda d: d.update(cosmosChainId="wrong-chain"),
            lambda d: d.update(evmChainId=1),
            lambda d: d.update(validator="wrong-validator"),
            lambda d: d.update(singleValidatorPauseRequired=False),
        )
        for mutation in mutations:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as directory:
                approval, binary, key = self.fixture(directory)
                self.mutate(approval, mutation)
                with self.assertRaises(ValueError):
                    self.run_verify(approval, binary, key)

    def test_rejects_unapproved_pause_and_late_approval(self):
        with tempfile.TemporaryDirectory() as directory:
            approval, binary, key = self.fixture(directory)
            self.mutate(approval, lambda data: data.update(singleValidatorPauseApproved=False))
            with self.assertRaisesRegex(ValueError, "pause"):
                self.run_verify(approval, binary, key)
        with tempfile.TemporaryDirectory() as directory:
            approval, binary, key = self.fixture(directory)
            autha = Path(directory) / "autha.json"
            document = json.loads(autha.read_text(encoding="utf-8"))
            document["approvedAt"] = "2026-09-03T10:01:00Z"
            autha.write_text(json.dumps(document), encoding="utf-8")
            self.mutate(approval, lambda data: data["authaApproval"].update(
                artifactSha256=hashlib.sha256(autha.read_bytes()).hexdigest()))
            with self.assertRaisesRegex(ValueError, "approvals must predate"):
                self.run_verify(approval, binary, key)

    def test_rejects_unstructured_or_semantically_mismatched_approval(self):
        with tempfile.TemporaryDirectory() as directory:
            approval, binary, key = self.fixture(directory)
            autha = Path(directory) / "autha.json"
            document = json.loads(autha.read_text(encoding="utf-8"))
            document["releaseId"] = "WRONG-RELEASE"
            autha.write_text(json.dumps(document), encoding="utf-8")
            self.mutate(approval, lambda data: data["authaApproval"].update(
                artifactSha256=hashlib.sha256(autha.read_bytes()).hexdigest()))
            with self.assertRaisesRegex(ValueError, "releaseId"):
                self.run_verify(approval, binary, key)

    def test_rejects_binary_mismatch_or_bad_bundle_signature(self):
        with tempfile.TemporaryDirectory() as directory:
            approval, binary, key = self.fixture(directory)
            binary.write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "binary SHA-256 mismatch"):
                self.run_verify(approval, binary, key)
        with tempfile.TemporaryDirectory() as directory:
            approval, binary, key = self.fixture(directory)
            def reject(*_args):
                raise ValueError("bad signature")
            with self.assertRaisesRegex(ValueError, "bad signature"):
                verify(approval, binary, "makalu", self.when, self.release, key, reject)


if __name__ == "__main__":
    unittest.main()
