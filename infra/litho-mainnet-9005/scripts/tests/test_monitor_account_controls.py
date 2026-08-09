import os
from pathlib import Path
import subprocess
import unittest


SCRIPTS = Path(__file__).resolve().parents[1]
INFRA = SCRIPTS.parent
WRAPPER = SCRIPTS / "litho-mainnet-monitor-command"
PLAYBOOK = INFRA / "ansible" / "playbooks" / "mainnet-9005-deploy-monitor-account.yml"


class MonitorAccountControlTests(unittest.TestCase):
    def test_wrapper_contains_only_expected_read_only_commands(self):
        wrapper = WRAPPER.read_text(encoding="utf-8")
        expected = (
            "systemctl is-active lithod-mainnet-9005-val",
            "systemctl is-active lithod-mainnet-9005-sentry",
            "http://127.0.0.1:26657/status",
            "http://127.0.0.1:26657/net_info",
            "http://127.0.0.1:27057/status",
            "http://127.0.0.1:27057/net_info",
        )
        for command in expected:
            self.assertIn(command, wrapper)
        self.assertNotIn("eval ", wrapper)
        self.assertNotIn("sh -c", wrapper)
        self.assertNotIn("bash -c", wrapper)
        self.assertNotIn("sudo", wrapper)
        self.assertIn("exit 126", wrapper)

    @unittest.skipUnless(os.name == "posix", "POSIX forced-command behavior")
    def test_wrapper_rejects_arbitrary_commands(self):
        result = subprocess.run(
            ["/bin/sh", str(WRAPPER)],
            env={**os.environ, "SSH_ORIGINAL_COMMAND": "id"},
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 126)
        self.assertIn("Denied", result.stderr)

    def test_playbook_pins_key_to_forced_command(self):
        playbook = PLAYBOOK.read_text(encoding="utf-8")
        self.assertIn("monitor_ssh_public_key", playbook)
        self.assertIn("^ssh-ed25519", playbook)
        self.assertIn('command="/usr/local/sbin/litho-mainnet-monitor-command"', playbook)
        for restriction in (
            "no-agent-forwarding",
            "no-port-forwarding",
            "no-pty",
            "no-user-rc",
            "no-X11-forwarding",
        ):
            self.assertIn(restriction, playbook)


if __name__ == "__main__":
    unittest.main()
