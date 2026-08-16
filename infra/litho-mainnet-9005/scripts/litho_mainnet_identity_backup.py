#!/usr/bin/env python3
"""Create and verify an encrypted LITHO validator identity backup.

The create operation streams the three identity/state files over SSH directly
into memory, validates them, and encrypts the tar archive with a newly generated
PyNaCl SealedBox recovery key. Plaintext key files are never written locally.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tarfile
from datetime import datetime, timezone

from nacl.public import PrivateKey, SealedBox


MAGIC = b"LITHO-MAINNET-IDENTITY-BACKUP-V1\n"
EXPECTED_FILES = (
    "config/priv_validator_key.json",
    "config/node_key.json",
    "data/priv_validator_state.json",
)
EXPECTED_CONSENSUS_PUBKEY = "7o+6DXvzUZditxqvBH8RHScpB7KrAGrB4CvIHwByBSc="


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validated_files(archive: bytes) -> dict[str, bytes]:
    result: dict[str, bytes] = {}
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:") as bundle:
        for member in bundle.getmembers():
            name = str(PurePosixPath(member.name))
            if name not in EXPECTED_FILES:
                raise ValueError(f"unexpected archive member: {name}")
            if not member.isfile():
                raise ValueError(f"archive member is not a regular file: {name}")
            extracted = bundle.extractfile(member)
            if extracted is None:
                raise ValueError(f"could not read archive member: {name}")
            result[name] = extracted.read()

    missing = set(EXPECTED_FILES) - set(result)
    if missing:
        raise ValueError(f"missing archive members: {sorted(missing)}")

    validator_key = json.loads(
        result["config/priv_validator_key.json"].decode("utf-8")
    )
    node_key = json.loads(result["config/node_key.json"].decode("utf-8"))
    validator_state = json.loads(
        result["data/priv_validator_state.json"].decode("utf-8")
    )

    if validator_key.get("pub_key", {}).get("value") != EXPECTED_CONSENSUS_PUBKEY:
        raise ValueError("validator consensus public key does not match genesis")
    if not validator_key.get("priv_key", {}).get("value"):
        raise ValueError("validator private key is empty")
    if not node_key.get("priv_key", {}).get("value"):
        raise ValueError("node private key is empty")
    if str(validator_state.get("height")) != "0":
        raise ValueError("initial validator signing state is not at height 0")

    return result


def write_new(path: Path, data: bytes, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    try:
        with os.fdopen(descriptor, "wb") as output:
            output.write(data)
    except BaseException:
        path.unlink(missing_ok=True)
        raise


def create(args: argparse.Namespace) -> None:
    backup_path = Path(args.output).resolve()
    recovery_path = Path(args.recovery_key).resolve()
    manifest_path = Path(f"{backup_path}.manifest.json")
    for path in (backup_path, recovery_path, manifest_path):
        if path.exists():
            raise FileExistsError(f"refusing to overwrite existing file: {path}")

    remote_files = " ".join(EXPECTED_FILES)
    command = [
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
        f"tar -C {args.remote_home} -cf - {remote_files}",
    ]
    process = subprocess.run(command, check=False, capture_output=True)
    if process.returncode != 0:
        error = process.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"remote archive command failed: {error}")

    files = validated_files(process.stdout)
    recovery_key = PrivateKey.generate()
    encrypted = SealedBox(recovery_key.public_key).encrypt(process.stdout)

    recovery_record = {
        "format": "litho-mainnet-recovery-key-v1",
        "algorithm": "x25519-xsalsa20-poly1305-sealedbox",
        "private_key_b64": base64.b64encode(bytes(recovery_key)).decode("ascii"),
        "public_key_b64": base64.b64encode(bytes(recovery_key.public_key)).decode(
            "ascii"
        ),
    }
    manifest = {
        "format": "litho-mainnet-identity-backup-v1",
        "created_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "source_host": args.host,
        "source_home": args.remote_home,
        "encrypted_backup_sha256": sha256(MAGIC + encrypted),
        "plaintext_archive_sha256": sha256(process.stdout),
        "files": {name: sha256(content) for name, content in sorted(files.items())},
        "consensus_public_key": EXPECTED_CONSENSUS_PUBKEY,
    }

    write_new(
        recovery_path,
        (json.dumps(recovery_record, indent=2) + "\n").encode("utf-8"),
    )
    write_new(backup_path, MAGIC + encrypted)
    write_new(
        manifest_path,
        (json.dumps(manifest, indent=2) + "\n").encode("utf-8"),
        mode=0o644,
    )

    print(f"ENCRYPTED_BACKUP={backup_path}")
    print(f"RECOVERY_KEY={recovery_path}")
    print(f"MANIFEST={manifest_path}")
    print(f"ENCRYPTED_BACKUP_SHA256={manifest['encrypted_backup_sha256']}")
    print("PLAINTEXT_KEY_FILES_WRITTEN_LOCALLY=no")
    print("OFFLINE_COPY_REQUIRED=yes")


def verify(args: argparse.Namespace) -> None:
    backup_path = Path(args.backup).resolve()
    recovery_path = Path(args.recovery_key).resolve()
    manifest_path = Path(args.manifest).resolve()

    encrypted_file = backup_path.read_bytes()
    if not encrypted_file.startswith(MAGIC):
        raise ValueError("encrypted backup header is invalid")
    recovery_record = json.loads(recovery_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    if sha256(encrypted_file) != manifest["encrypted_backup_sha256"]:
        raise ValueError("encrypted backup checksum mismatch")

    recovery_key = PrivateKey(
        base64.b64decode(recovery_record["private_key_b64"], validate=True)
    )
    archive = SealedBox(recovery_key).decrypt(encrypted_file[len(MAGIC) :])
    files = validated_files(archive)

    if sha256(archive) != manifest["plaintext_archive_sha256"]:
        raise ValueError("plaintext archive checksum mismatch")
    actual_file_hashes = {
        name: sha256(content) for name, content in sorted(files.items())
    }
    if actual_file_hashes != manifest["files"]:
        raise ValueError("backup member checksum mismatch")

    print("BACKUP_DECRYPTION=passed")
    print("BACKUP_CONTENT_VALIDATION=passed")
    print("CONSENSUS_KEY_MATCH=passed")
    print("INITIAL_SIGNING_HEIGHT=0")
    print("PLAINTEXT_KEY_FILES_WRITTEN_LOCALLY=no")


def parser() -> argparse.ArgumentParser:
    main = argparse.ArgumentParser()
    subparsers = main.add_subparsers(dest="operation", required=True)

    create_parser = subparsers.add_parser("create")
    create_parser.add_argument("--host", required=True)
    create_parser.add_argument("--ssh-user", default="root")
    create_parser.add_argument("--ssh-key", required=True)
    create_parser.add_argument("--remote-home", required=True)
    create_parser.add_argument("--output", required=True)
    create_parser.add_argument("--recovery-key", required=True)
    create_parser.set_defaults(handler=create)

    verify_parser = subparsers.add_parser("verify")
    verify_parser.add_argument("--backup", required=True)
    verify_parser.add_argument("--recovery-key", required=True)
    verify_parser.add_argument("--manifest", required=True)
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
