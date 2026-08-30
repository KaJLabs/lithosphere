#!/usr/bin/env python3
"""Create and verify encrypted current LITHO validator signing-state backups."""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import subprocess
import sys
import tarfile
from datetime import datetime, timezone

from nacl.public import PrivateKey, PublicKey, SealedBox


MAGIC_V1 = b"LITHO-MAINNET-SIGNING-STATE-BACKUP-V1\n"
MAGIC_V2 = b"LITHO-MAINNET-SIGNING-STATE-BACKUP-V2\n"
EXPECTED_CHAIN_ID = "lithosphere_9005-1"
RECIPIENT_LABEL = re.compile(r"^[a-z0-9][a-z0-9-]{0,31}$")
EXPECTED_FILES = (
    "config/priv_validator_key.json",
    "data/priv_validator_state.json",
)
MAX_MEMBER_BYTES = 64 * 1024


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_new(path: Path, data: bytes, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    try:
        with os.fdopen(descriptor, "wb") as output:
            output.write(data)
    except BaseException:
        path.unlink(missing_ok=True)
        raise


def validate_archive(
    archive: bytes, expected_consensus_public_key: str, minimum_height: int = 1
) -> tuple[dict[str, bytes], dict[str, object]]:
    files: dict[str, bytes] = {}
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:") as bundle:
        for member in bundle.getmembers():
            name = str(PurePosixPath(member.name))
            if name not in EXPECTED_FILES:
                raise ValueError(f"unexpected archive member: {name}")
            if name in files:
                raise ValueError(f"duplicate archive member: {name}")
            if not member.isfile() or member.size > MAX_MEMBER_BYTES:
                raise ValueError(f"invalid archive member: {name}")
            extracted = bundle.extractfile(member)
            if extracted is None:
                raise ValueError(f"could not read archive member: {name}")
            files[name] = extracted.read()

    missing = set(EXPECTED_FILES) - set(files)
    if missing:
        raise ValueError(f"missing archive members: {sorted(missing)}")

    validator_key = json.loads(files["config/priv_validator_key.json"].decode("utf-8"))
    signing_state = json.loads(files["data/priv_validator_state.json"].decode("utf-8"))
    actual_public_key = validator_key.get("pub_key", {}).get("value")
    if actual_public_key != expected_consensus_public_key:
        raise ValueError("validator consensus public key does not match")
    if not validator_key.get("priv_key", {}).get("value"):
        raise ValueError("validator private key is empty")

    height = int(signing_state.get("height", -1))
    if height < minimum_height:
        raise ValueError(f"signing height {height} is below {minimum_height}")
    metadata = {
        "height": height,
        "round": int(signing_state.get("round", 0)),
        "step": int(signing_state.get("step", 0)),
        "consensus_public_key": actual_public_key,
    }
    return files, metadata


def load_public_key(path: Path) -> PublicKey:
    record = json.loads(path.read_text(encoding="utf-8"))
    if record.get("format") != "litho-mainnet-backup-recipient-v1":
        raise ValueError("backup recipient format is invalid")
    return PublicKey(base64.b64decode(record["public_key_b64"], validate=True))


def load_recipients(specifications: list[str]) -> dict[str, PublicKey]:
    if len(specifications) != 2:
        raise ValueError("exactly two independent backup recipients are required")

    recipients: dict[str, PublicKey] = {}
    fingerprints: set[str] = set()
    for specification in specifications:
        label, separator, raw_path = specification.partition("=")
        if not separator or not RECIPIENT_LABEL.fullmatch(label):
            raise ValueError(
                "recipient must use a safe label and path: label=/path/to/recipient.json"
            )
        if label in recipients:
            raise ValueError(f"duplicate recipient label: {label}")
        public_key = load_public_key(Path(raw_path))
        fingerprint = sha256(bytes(public_key))
        if fingerprint in fingerprints:
            raise ValueError("backup recipients must use independent public keys")
        recipients[label] = public_key
        fingerprints.add(fingerprint)
    return recipients


def load_private_key(path: Path) -> PrivateKey:
    record = json.loads(path.read_text(encoding="utf-8"))
    if record.get("format") != "litho-mainnet-recovery-key-v1":
        raise ValueError("recovery key format is invalid")
    return PrivateKey(base64.b64decode(record["private_key_b64"], validate=True))


def generate_recipient(args: argparse.Namespace) -> None:
    recovery_path = Path(args.recovery_key).resolve()
    recipient_path = Path(args.recipient).resolve()
    private_key = PrivateKey.generate()
    recovery = {
        "format": "litho-mainnet-recovery-key-v1",
        "algorithm": "x25519-xsalsa20-poly1305-sealedbox",
        "private_key_b64": base64.b64encode(bytes(private_key)).decode("ascii"),
        "public_key_b64": base64.b64encode(bytes(private_key.public_key)).decode(
            "ascii"
        ),
    }
    recipient = {
        "format": "litho-mainnet-backup-recipient-v1",
        "algorithm": recovery["algorithm"],
        "public_key_b64": recovery["public_key_b64"],
    }
    write_new(recovery_path, (json.dumps(recovery, indent=2) + "\n").encode("utf-8"))
    write_new(
        recipient_path,
        (json.dumps(recipient, indent=2) + "\n").encode("utf-8"),
        mode=0o644,
    )
    print(f"RECOVERY_KEY={recovery_path}")
    print(f"PUBLIC_RECIPIENT={recipient_path}")
    print("STORE_RECOVERY_KEY_OFFLINE=yes")


def create(args: argparse.Namespace) -> None:
    output_prefix = Path(args.output_prefix).resolve()
    recipients = load_recipients(args.recipient)
    output_paths = {
        label: Path(f"{output_prefix}.{label}.sealed") for label in recipients
    }
    manifest_path = Path(f"{output_prefix}.manifest.json")
    for path in (*output_paths.values(), manifest_path):
        if path.exists():
            raise FileExistsError(f"refusing to overwrite existing file: {path}")

    remote_files = " ".join(EXPECTED_FILES)
    remote_command = f"tar -C {shlex.quote(args.remote_home)} -cf - {remote_files}"
    process = subprocess.run(
        [
            "ssh",
            "-i",
            str(Path(args.ssh_key).resolve()),
            "-o",
            "BatchMode=yes",
            "-o",
            "StrictHostKeyChecking=yes",
            "-o",
            "ConnectTimeout=10",
            f"{args.ssh_user}@{args.host}",
            remote_command,
        ],
        check=False,
        capture_output=True,
        timeout=30,
    )
    if process.returncode != 0:
        error = process.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"remote archive command failed: {error}")

    files, state = validate_archive(
        process.stdout, args.expected_consensus_public_key, args.minimum_height
    )
    payloads = {
        label: MAGIC_V2 + SealedBox(public_key).encrypt(process.stdout)
        for label, public_key in recipients.items()
    }
    manifest = {
        "format": "litho-mainnet-signing-state-backup-v2",
        "created_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "chain_id": args.chain_id,
        "source_host": args.host,
        "source_home": args.remote_home,
        "encrypted_backups": {
            label: {
                "sha256": sha256(payloads[label]),
                "recipient_public_key_sha256": sha256(bytes(recipients[label])),
            }
            for label in sorted(recipients)
        },
        "plaintext_archive_sha256": sha256(process.stdout),
        "files": {name: sha256(content) for name, content in sorted(files.items())},
        **state,
    }
    written: list[Path] = []
    try:
        for label, output_path in output_paths.items():
            write_new(output_path, payloads[label])
            written.append(output_path)
        write_new(
            manifest_path,
            (json.dumps(manifest, indent=2) + "\n").encode("utf-8"),
            mode=0o644,
        )
        written.append(manifest_path)
    except BaseException:
        for path in written:
            path.unlink(missing_ok=True)
        raise
    for label, output_path in output_paths.items():
        print(f"ENCRYPTED_BACKUP_{label.upper().replace('-', '_')}={output_path}")
    print(f"MANIFEST={manifest_path}")
    print(f"SIGNED_HEIGHT={state['height']}")
    print("RECOVERY_PRIVATE_KEY_USED=no")
    print("PLAINTEXT_KEY_FILES_WRITTEN_LOCALLY=no")


def verify(args: argparse.Namespace) -> None:
    backup_path = Path(args.backup).resolve()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    encrypted = backup_path.read_bytes()
    recovery_key = load_private_key(Path(args.recovery_key))
    if manifest.get("format") == "litho-mainnet-signing-state-backup-v1":
        if not encrypted.startswith(MAGIC_V1):
            raise ValueError("encrypted backup header is invalid")
        if sha256(encrypted) != manifest.get("encrypted_backup_sha256"):
            raise ValueError("encrypted backup checksum mismatch")
        recipient_label = "legacy"
        encrypted_archive = encrypted[len(MAGIC_V1) :]
    elif manifest.get("format") == "litho-mainnet-signing-state-backup-v2":
        if not encrypted.startswith(MAGIC_V2):
            raise ValueError("encrypted backup header is invalid")
        recipient_fingerprint = sha256(bytes(recovery_key.public_key))
        matching = [
            label
            for label, record in manifest.get("encrypted_backups", {}).items()
            if record.get("recipient_public_key_sha256") == recipient_fingerprint
            and record.get("sha256") == sha256(encrypted)
        ]
        if len(matching) != 1:
            raise ValueError("encrypted backup checksum mismatch")
        recipient_label = matching[0]
        encrypted_archive = encrypted[len(MAGIC_V2) :]
    else:
        raise ValueError("backup manifest format is invalid")

    archive = SealedBox(recovery_key).decrypt(encrypted_archive)
    files, state = validate_archive(
        archive, manifest["consensus_public_key"], int(manifest["height"])
    )
    if sha256(archive) != manifest["plaintext_archive_sha256"]:
        raise ValueError("plaintext archive checksum mismatch")
    hashes = {name: sha256(content) for name, content in sorted(files.items())}
    if hashes != manifest["files"]:
        raise ValueError("backup member checksum mismatch")
    for field in ("height", "round", "step", "consensus_public_key"):
        if state[field] != manifest[field]:
            raise ValueError(f"signing-state metadata mismatch: {field}")

    print("BACKUP_DECRYPTION=passed")
    print("BACKUP_CONTENT_VALIDATION=passed")
    print(f"RECIPIENT_LABEL={recipient_label}")
    print(f"SIGNED_HEIGHT={state['height']}")
    print("PLAINTEXT_KEY_FILES_WRITTEN_LOCALLY=no")


def parser() -> argparse.ArgumentParser:
    main = argparse.ArgumentParser()
    operations = main.add_subparsers(dest="operation", required=True)

    recipient = operations.add_parser("generate-recipient")
    recipient.add_argument("--recovery-key", required=True)
    recipient.add_argument("--recipient", required=True)
    recipient.set_defaults(handler=generate_recipient)

    create_parser = operations.add_parser("create")
    create_parser.add_argument("--host", required=True)
    create_parser.add_argument("--ssh-user", default="lithobackup")
    create_parser.add_argument("--ssh-key", required=True)
    create_parser.add_argument("--remote-home", required=True)
    create_parser.add_argument(
        "--recipient",
        action="append",
        required=True,
        help="repeat exactly twice as label=/path/to/public-recipient.json",
    )
    create_parser.add_argument(
        "--chain-id", required=True, choices=(EXPECTED_CHAIN_ID,)
    )
    create_parser.add_argument("--expected-consensus-public-key", required=True)
    create_parser.add_argument("--minimum-height", type=int, default=1)
    create_parser.add_argument("--output-prefix", required=True)
    create_parser.set_defaults(handler=create)

    verify_parser = operations.add_parser("verify")
    verify_parser.add_argument("--backup", required=True)
    verify_parser.add_argument("--manifest", required=True)
    verify_parser.add_argument("--recovery-key", required=True)
    verify_parser.set_defaults(handler=verify)
    return main


def main() -> int:
    args = parser().parse_args()
    try:
        args.handler(args)
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
