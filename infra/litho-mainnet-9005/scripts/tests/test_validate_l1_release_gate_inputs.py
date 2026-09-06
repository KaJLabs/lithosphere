from __future__ import annotations

from pathlib import Path
import sys
import unittest


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate_l1_release_gate_inputs import validate  # noqa: E402


class L1ReleaseGateInputTest(unittest.TestCase):
    def valid(self) -> tuple[str, str, str, str]:
        return (
            "makalu",
            "litho-l1-v20.0.0-r1",
            "lithod-linux-amd64",
            "infra/litho-mainnet-9005/docs/approvals/makalu-r1.json",
        )

    def test_accepts_constrained_inputs(self):
        validate(*self.valid())

    def test_rejects_hostile_values(self):
        hostile = (
            "' ; touch PWNED; #",
            "$(touch PWNED)",
            "`touch PWNED`",
            "value\nnext-command",
            "../../escape",
            "file;command",
            "*.json",
        )
        for value in hostile:
            with self.subTest(value=value):
                for index in (1, 2, 3):
                    args = list(self.valid())
                    args[index] = value
                    with self.assertRaises(ValueError):
                        validate(*args)

    def test_rejects_wrong_environment(self):
        args = list(self.valid())
        args[0] = "production"
        with self.assertRaises(ValueError):
            validate(*args)


if __name__ == "__main__":
    unittest.main()
