import importlib.util
import io
import json
from argparse import Namespace
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "signing_state_backup.py"
SPEC = importlib.util.spec_from_file_location("signing_state_backup", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

PUBLIC_KEY = "test-consensus-public-key"


def archive(height=100, public_key=PUBLIC_KEY, unexpected=False):
    values = {
        "config/priv_validator_key.json": {
            "pub_key": {"value": public_key},
            "priv_key": {"value": "private-test-fixture"},
        },
        "data/priv_validator_state.json": {
            "height": str(height),
            "round": 0,
            "step": 3,
        },
    }
    if unexpected:
        values["unexpected.txt"] = {"value": "no"}
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:") as bundle:
        for name, value in values.items():
            content = json.dumps(value).encode()
            member = tarfile.TarInfo(name)
            member.size = len(content)
            bundle.addfile(member, io.BytesIO(content))
    return output.getvalue()


class SigningStateBackupTests(unittest.TestCase):
    def test_accepts_current_matching_signing_state(self):
        files, state = MODULE.validate_archive(archive(), PUBLIC_KEY)
        self.assertEqual(set(files), set(MODULE.EXPECTED_FILES))
        self.assertEqual(state["height"], 100)
        self.assertEqual(state["step"], 3)

    def test_rejects_height_zero_for_recurring_backup(self):
        with self.assertRaisesRegex(ValueError, "below"):
            MODULE.validate_archive(archive(height=0), PUBLIC_KEY)

    def test_rejects_wrong_consensus_identity(self):
        with self.assertRaisesRegex(ValueError, "does not match"):
            MODULE.validate_archive(archive(public_key="wrong"), PUBLIC_KEY)

    def test_rejects_unexpected_archive_member(self):
        with self.assertRaisesRegex(ValueError, "unexpected archive member"):
            MODULE.validate_archive(archive(unexpected=True), PUBLIC_KEY)

    def test_generates_separate_matching_public_recipient(self):
        with tempfile.TemporaryDirectory() as directory:
            recovery = Path(directory) / "recovery.json"
            recipient = Path(directory) / "recipient.json"
            MODULE.generate_recipient(
                Namespace(recovery_key=str(recovery), recipient=str(recipient))
            )
            private_key = MODULE.load_private_key(recovery)
            public_key = MODULE.load_public_key(recipient)
            self.assertEqual(bytes(private_key.public_key), bytes(public_key))
            self.assertNotIn("private_key_b64", recipient.read_text())


if __name__ == "__main__":
    unittest.main()
