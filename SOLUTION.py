scripts/node_versions.py

import json
import re
from pathlib import Path

# Base directory relative to this script file (typically 'scripts')
SCRIPT_DIR: Path = Path(__file__).resolve().parent
PACKAGE_JSON: Path = SCRIPT_DIR / "package.json"


def get_node_matrix(override: list = None) -> list:
    """
    Determines the Node.js versions for the CI matrix based on 'package.json' engines.
    Returns a tuple of two strings representing the Matrix nodes (e.g., '20', '22').
    Handles 'engines': { "node": ">=20" } format.
    """
    target = override
    try:
        with open(PACKAGE_JSON, "r") as f:
            data = json.load(f)
            raw = data.get("engines", {}).get("node", "20")
            
            # Extract the numeric major version from the string (e.g. ">=20" -> 20)
            match = re.search(r"\d+", raw)
            if match:
                major = int(match.group(0))
                # Return the base version and the next LTS candidate (e.g. 20 & 22)
                target = [str(major), str(major + 2)]
            else:
                target = ["20", "22"] # Fallback
            
    except (FileNotFoundError, KeyError, TypeError):
        target = ["20", "22"]

    return target


if __name__ == "__main__":
    matrix = get_node_matrix()
    print(f"Running verify on Node: {matrix[0]}, {matrix[1]}")