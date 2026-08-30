import importlib.util
import io
import json
from argparse import Namespace
from contextlib import redirect_stdout
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest import mock


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
    def generate_recipient(self, directory, label):
        recovery = Path(directory) / f"{label}-recovery.json"
        recipient = Path(directory) / f"{label}-recipient.json"
        MODULE.generate_recipient(
            Namespace(recovery_key=str(recovery), recipient=str(recipient))
        )
        return recovery, recipient

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
            recovery, recipient = self.generate_recipient(directory, "primary")
            private_key = MODULE.load_private_key(recovery)
            public_key = MODULE.load_public_key(recipient)
            self.assertEqual(bytes(private_key.public_key), bytes(public_key))
            self.assertNotIn("private_key_b64", recipient.read_text())

    def test_requires_exactly_two_independent_recipients(self):
        with tempfile.TemporaryDirectory() as directory:
            _, primary = self.generate_recipient(directory, "primary")
            _, backup = self.generate_recipient(directory, "backup")

            recipients = MODULE.load_recipients(
                [f"primary={primary}", f"backup={backup}"]
            )
            self.assertEqual(set(recipients), {"primary", "backup"})

            with self.assertRaisesRegex(ValueError, "exactly two"):
                MODULE.load_recipients([f"primary={primary}"])
            with self.assertRaisesRegex(ValueError, "independent public keys"):
                MODULE.load_recipients([f"primary={primary}", f"backup={primary}"])
            with self.assertRaisesRegex(ValueError, "safe label"):
                MODULE.load_recipients([f"../primary={primary}", f"backup={backup}"])

    def test_create_and_verify_two_independent_ciphertexts(self):
        with tempfile.TemporaryDirectory() as directory:
            primary_recovery, primary_recipient = self.generate_recipient(
                directory, "primary"
            )
            backup_recovery, backup_recipient = self.generate_recipient(
                directory, "backup"
            )
            output_prefix = Path(directory) / "signing-state"
            result = mock.Mock(returncode=0, stdout=archive(), stderr=b"")
            create_args = Namespace(
                host="validator.example.invalid",
                ssh_user="lithobackup",
                ssh_key=str(Path(directory) / "export-key"),
                remote_home="/var/lib/litho-mainnet-9005-val",
                recipient=[
                    f"primary={primary_recipient}",
                    f"backup={backup_recipient}",
                ],
                chain_id="lithosphere_9005-1",
                expected_consensus_public_key=PUBLIC_KEY,
                minimum_height=1,
                output_prefix=str(output_prefix),
            )
            with mock.patch.object(MODULE.subprocess, "run", return_value=result):
                MODULE.create(create_args)

            manifest_path = Path(f"{output_prefix}.manifest.json")
            manifest = json.loads(manifest_path.read_text())
            self.assertEqual(
                manifest["format"], "litho-mainnet-signing-state-backup-v2"
            )
            self.assertEqual(manifest["chain_id"], "lithosphere_9005-1")
            self.assertEqual(set(manifest["encrypted_backups"]), {"primary", "backup"})

            outputs = {}
            for label, recovery in (
                ("primary", primary_recovery),
                ("backup", backup_recovery),
            ):
                backup_path = Path(f"{output_prefix}.{label}.sealed")
                outputs[label] = backup_path.read_bytes()
                stdout = io.StringIO()
                with redirect_stdout(stdout):
                    MODULE.verify(
                        Namespace(
                            backup=str(backup_path),
                            manifest=str(manifest_path),
                            recovery_key=str(recovery),
                        )
                    )
                self.assertIn("BACKUP_DECRYPTION=passed", stdout.getvalue())
                self.assertIn(f"RECIPIENT_LABEL={label}", stdout.getvalue())

            self.assertNotEqual(outputs["primary"], outputs["backup"])
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                MODULE.verify(
                    Namespace(
                        backup=str(Path(f"{output_prefix}.primary.sealed")),
                        manifest=str(manifest_path),
                        recovery_key=str(backup_recovery),
                    )
                )

    def test_verifier_remains_compatible_with_v1_artifacts(self):
        with tempfile.TemporaryDirectory() as directory:
            recovery, recipient = self.generate_recipient(directory, "legacy")
            archive_bytes = archive()
            files, state = MODULE.validate_archive(archive_bytes, PUBLIC_KEY)
            encrypted = MODULE.MAGIC_V1 + MODULE.SealedBox(
                MODULE.load_public_key(recipient)
            ).encrypt(archive_bytes)
            backup_path = Path(directory) / "legacy.sealed"
            manifest_path = Path(directory) / "legacy.manifest.json"
            backup_path.write_bytes(encrypted)
            manifest_path.write_text(
                json.dumps(
                    {
                        "format": "litho-mainnet-signing-state-backup-v1",
                        "encrypted_backup_sha256": MODULE.sha256(encrypted),
                        "plaintext_archive_sha256": MODULE.sha256(archive_bytes),
                        "files": {
                            name: MODULE.sha256(content)
                            for name, content in sorted(files.items())
                        },
                        **state,
                    }
                )
            )
            stdout = io.StringIO()
            with redirect_stdout(stdout):
                MODULE.verify(
                    Namespace(
                        backup=str(backup_path),
                        manifest=str(manifest_path),
                        recovery_key=str(recovery),
                    )
                )
            self.assertIn("RECIPIENT_LABEL=legacy", stdout.getvalue())


if __name__ == "__main__":
    unittest.main()
