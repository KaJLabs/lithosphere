import ipaddress
import re
import unittest
from pathlib import Path


MAINNET_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = MAINNET_ROOT.parents[1]
IPV4 = re.compile(r"(?<![0-9])(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?![0-9])")
PUBLIC_TEXT_SUFFIXES = {".ini", ".json", ".md", ".py", ".toml", ".yml", ".yaml"}


class PublicRepositoryBoundaryTests(unittest.TestCase):
    def test_public_inventory_is_non_runnable(self):
        inventory = MAINNET_ROOT / "ansible" / "inventory" / "mainnet-9005"
        hosts = (inventory / "hosts.ini").read_text(encoding="utf-8")
        group_vars = (inventory / "group_vars" / "all.yml").read_text(
            encoding="utf-8"
        )

        self.assertIn("ansible_host=REPLACE_WITH_PRIVATE_", hosts)
        self.assertIn("ansible_user=REPLACE_WITH_PRIVATE_", hosts)
        self.assertIn("ansible_ssh_private_key_file=REPLACE_WITH_PRIVATE_", hosts)
        for name in (
            "mainnet_validator_node_id",
            "mainnet_sentry1_node_id",
            "mainnet_sentry2_node_id",
            "wireguard_network",
            "mainnet_validator_wg_ip",
            "mainnet_sentry1_wg_ip",
            "mainnet_sentry2_wg_ip",
            "mainnet_validator_wg_public_key",
            "mainnet_sentry1_wg_public_key",
            "mainnet_sentry2_wg_public_key",
        ):
            self.assertRegex(
                group_vars,
                rf'(?m)^{re.escape(name)}:\s*["\']REPLACE_WITH_PRIVATE_',
            )

    def test_active_workflows_source_origins_from_secrets(self):
        monitor = (
            REPO_ROOT / ".github" / "workflows" / "mainnet-chain-monitor.yaml"
        ).read_text(encoding="utf-8")
        backup = (
            REPO_ROOT
            / ".github"
            / "workflows"
            / "mainnet-signing-state-backup.yaml"
        ).read_text(encoding="utf-8")

        self.assertIn("secrets.MONITOR_VALIDATOR_HOST", monitor)
        self.assertIn("secrets.MONITOR_SENTRY1_HOST", monitor)
        self.assertIn("secrets.MONITOR_SENTRY2_HOST", monitor)
        self.assertIn("BACKUP_HOST: ${{ secrets.BACKUP_HOST }}", backup)

    def test_mainnet_public_material_has_no_external_ip_literals(self):
        targets = [
            MAINNET_ROOT / "docs",
            MAINNET_ROOT / "ansible" / "inventory" / "mainnet-9005",
            MAINNET_ROOT / "scripts" / "monitor_mainnet_progression.py",
            MAINNET_ROOT / "scripts" / "verify_litho_mainnet_9005_live.py",
        ]
        findings = []
        for target in targets:
            files = target.rglob("*") if target.is_dir() else [target]
            for path in files:
                if not path.is_file() or path.suffix.lower() not in PUBLIC_TEXT_SUFFIXES:
                    continue
                text = path.read_text(encoding="utf-8")
                for match in IPV4.finditer(text):
                    address = ipaddress.ip_address(match.group(0))
                    if address.is_loopback or address.is_unspecified:
                        continue
                    line = text.count("\n", 0, match.start()) + 1
                    findings.append(f"{path.relative_to(REPO_ROOT)}:{line}")

        self.assertEqual([], findings, "external IP literals: " + ", ".join(findings))


if __name__ == "__main__":
    unittest.main()
