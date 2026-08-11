import importlib.util
from pathlib import Path
import sys
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "monitor_mainnet_progression.py"
SPEC = importlib.util.spec_from_file_location("monitor_mainnet_progression", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def sample(height: int, peers: int = 2) -> dict[str, object]:
    return {
        "service_active": True,
        "chain_id": MODULE.EXPECTED_CHAIN_ID,
        "height": height,
        "catching_up": False,
        "peers": peers,
    }


class ProgressionTests(unittest.TestCase):
    def test_accepts_advancing_healthy_nodes(self):
        first = {
            "validator": sample(100),
            "sentry1": sample(99, 1),
            "sentry2": sample(100, 1),
        }
        second = {
            "validator": sample(120),
            "sentry1": sample(119, 1),
            "sentry2": sample(120, 1),
        }
        result = MODULE.evaluate_progression(first, second)
        self.assertTrue(result["healthy"])

    def test_rejects_a_stalled_node(self):
        first = {node.name: sample(100, node.minimum_peers) for node in MODULE.NODE_SPECS}
        second = {node.name: sample(120, node.minimum_peers) for node in MODULE.NODE_SPECS}
        second["sentry2"]["height"] = 100
        result = MODULE.evaluate_progression(first, second)
        self.assertFalse(result["healthy"])
        self.assertFalse(result["checks"]["sentry2_height_advanced"])

    def test_rejects_wrong_chain_or_peer_floor(self):
        first = {node.name: sample(100, node.minimum_peers) for node in MODULE.NODE_SPECS}
        second = {node.name: sample(120, node.minimum_peers) for node in MODULE.NODE_SPECS}
        second["validator"]["chain_id"] = "lithosphere_700777-1"
        second["validator"]["peers"] = 0
        result = MODULE.evaluate_progression(first, second)
        self.assertFalse(result["healthy"])
        self.assertFalse(result["checks"]["validator_chain_id"])
        self.assertFalse(result["checks"]["validator_peer_floor"])


if __name__ == "__main__":
    unittest.main()
