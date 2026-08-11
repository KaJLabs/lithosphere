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
import shlex
import subprocess
import sys
import tarfile
from datetime import datetime, timezone

from nacl.public import PrivateKey, PublicKey, SealedBox


MAGIC = b"LITHO-MAINNET-SIGNING-STATE-BACKUP-V1\n"
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

    validator_key = json.loads(
        files["config/priv_validator_key.json"].decode("utf-8")
    )
    signing_state = json.loads(
        files["data/priv_validator_state.json"].decode("utf-8")
    )
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
    write_new(
        recovery_path, (json.dumps(recovery, indent=2) + "\n").encode("utf-8")
    )
    write_new(
        recipient_path,
        (json.dumps(recipient, indent=2) + "\n").encode("utf-8"),
        mode=0o644,
    )
    print(f"RECOVERY_KEY={recovery_path}")
    print(f"PUBLIC_RECIPIENT={recipient_path}")
    print("STORE_RECOVERY_KEY_OFFLINE=yes")


def create(args: argparse.Namespace) -> None:
    output_path = Path(args.output).resolve()
    manifest_path = Path(f"{output_path}.manifest.json")
    for path in (output_path, manifest_path):
        if path.exists():
            raise FileExistsError(f"refusing to overwrite existing file: {path}")

    remote_files = " ".join(EXPECTED_FILES)
    remote_command = (
        f"tar -C {shlex.quote(args.remote_home)} -cf - {remote_files}"
    )
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
    encrypted = SealedBox(load_public_key(Path(args.recipient))).encrypt(
        process.stdout
    )
    payload = MAGIC + encrypted
    manifest = {
        "format": "litho-mainnet-signing-state-backup-v1",
        "created_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "source_host": args.host,
        "source_home": args.remote_home,
        "encrypted_backup_sha256": sha256(payload),
        "plaintext_archive_sha256": sha256(process.stdout),
        "files": {name: sha256(content) for name, content in sorted(files.items())},
        **state,
    }
    write_new(output_path, payload)
    write_new(
        manifest_path,
        (json.dumps(manifest, indent=2) + "\n").encode("utf-8"),
        mode=0o644,
    )
    print(f"ENCRYPTED_BACKUP={output_path}")
    print(f"MANIFEST={manifest_path}")
    print(f"SIGNED_HEIGHT={state['height']}")
    print("RECOVERY_PRIVATE_KEY_USED=no")
    print("PLAINTEXT_KEY_FILES_WRITTEN_LOCALLY=no")


def verify(args: argparse.Namespace) -> None:
    backup_path = Path(args.backup).resolve()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    encrypted = backup_path.read_bytes()
    if not encrypted.startswith(MAGIC):
        raise ValueError("encrypted backup header is invalid")
    if sha256(encrypted) != manifest["encrypted_backup_sha256"]:
        raise ValueError("encrypted backup checksum mismatch")

    archive = SealedBox(load_private_key(Path(args.recovery_key))).decrypt(
        encrypted[len(MAGIC) :]
    )
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
    create_parser.add_argument("--recipient", required=True)
    create_parser.add_argument("--expected-consensus-public-key", required=True)
    create_parser.add_argument("--minimum-height", type=int, default=1)
    create_parser.add_argument("--output", required=True)
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
