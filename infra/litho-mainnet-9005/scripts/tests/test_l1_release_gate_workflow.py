from pathlib import Path
import re
import unittest


WORKFLOW = Path(__file__).resolve().parents[4] / ".github/workflows/l1-release-approval-gate.yaml"


class L1ReleaseGateWorkflowTest(unittest.TestCase):
    def test_dispatch_inputs_are_not_interpolated_into_shell_source(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        run_blocks = "\n".join(re.findall(r"(?ms)^\s+run:\s*\|\s*\n(.*?)(?=^\s{6}\S|\Z)", text))
        self.assertNotIn("${{ inputs.", run_blocks)

    def test_third_party_actions_are_commit_pinned(self):
        text = WORKFLOW.read_text(encoding="utf-8")
        actions = re.findall(r"uses:\s*([^\s#]+)", text)
        self.assertGreaterEqual(len(actions), 2)
        for action in actions:
            with self.subTest(action=action):
                self.assertRegex(action, r"^[^@]+@[0-9a-f]{40}$")


if __name__ == "__main__":
    unittest.main()
