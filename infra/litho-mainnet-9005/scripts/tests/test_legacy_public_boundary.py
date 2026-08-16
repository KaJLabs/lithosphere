import ipaddress
import re
import subprocess
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[4]
IPV4 = re.compile(r"(?<![0-9])(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?![0-9])")
PROTECTED_AWS = re.compile(
    r"arn:aws:(?:kms|secretsmanager):|"
    r"\b(?:i|sg|subnet|vpc)-[0-9a-f]{8,17}\b|"
    r"[A-Za-z0-9.-]+\.(?:rds|elb)\.amazonaws\.com",
    re.IGNORECASE,
)
OPERATOR_SSH_PATH = re.compile(r"[A-Za-z]:\\Users\\[^\\\s]+\\\.ssh", re.IGNORECASE)
TEXT_SUFFIXES = {
    "",
    ".env",
    ".example",
    ".ini",
    ".js",
    ".json",
    ".md",
    ".py",
    ".sh",
    ".toml",
    ".ts",
    ".tsx",
    ".yml",
    ".yaml",
}


class LegacyPublicBoundaryTests(unittest.TestCase):
    @staticmethod
    def read_operational_text(path: Path) -> str:
        data = path.read_bytes()
        if data.startswith((b"\xff\xfe", b"\xfe\xff")):
            return data.decode("utf-16")
        return data.decode("utf-8-sig")

    def operational_files(self):
        tracked = subprocess.check_output(
            ["git", "-C", str(REPO_ROOT), "ls-files", "-z"]
        ).decode("utf-8").split("\0")
        for name in tracked:
            if not name:
                continue
            relative = Path(name)
            if relative.parts[0] not in {".github", "docs", "scripts", "Makalu", "MultX"}:
                continue
            if relative.parts[0] == ".github" and relative.parts[1:2] != ("workflows",):
                continue
            if any(part in {"assets", "artifacts", "cache", "node_modules"} for part in relative.parts):
                continue
            if relative.as_posix().endswith("Makalu/packages/docs/documentation/LEP100 paper.md"):
                continue
            path = REPO_ROOT / relative
            if path.suffix.lower() not in TEXT_SUFFIXES and path.name not in {
                ".env.mainnet",
                ".env.testnet",
                ".env.staging",
            }:
                continue
            yield path

    def test_operational_material_has_no_raw_remote_ip_literals(self):
        findings = []
        for path in self.operational_files():
            text = self.read_operational_text(path)
            for match in IPV4.finditer(text):
                address = ipaddress.ip_address(match.group(0))
                if address.is_loopback or address.is_unspecified:
                    continue
                if str(address) == "169.254.169.254":
                    continue
                if address in ipaddress.ip_network("172.16.0.0/12") and "docker-compose" in path.name:
                    continue
                if address.is_reserved:
                    continue
                line = text.count("\n", 0, match.start()) + 1
                findings.append(f"{path.relative_to(REPO_ROOT)}:{line}")
        self.assertEqual([], findings, "raw remote IP literals: " + ", ".join(findings))

    def test_operational_material_has_no_live_aws_resource_identifiers(self):
        findings = []
        for path in self.operational_files():
            text = self.read_operational_text(path)
            for pattern in (PROTECTED_AWS, OPERATOR_SSH_PATH):
                if match := pattern.search(text):
                    line = text.count("\n", 0, match.start()) + 1
                    findings.append(f"{path.relative_to(REPO_ROOT)}:{line}")
        self.assertEqual([], findings, "protected resource identifiers: " + ", ".join(findings))


if __name__ == "__main__":
    unittest.main()
