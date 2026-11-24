#!/usr/bin/env python3
"""Fail CI when tracked source files contain signs of injected or obfuscated code.

Added after a contributor PR hid an obfuscated loader at the end of
frontend/tailwind.config.js behind ~900 tab characters. It ran on every
`npm run dev` / `npm run build`. These checks are cheap, have no dependencies,
and catch that whole family of attacks:

* very long runs of whitespace inside a line (hiding code off-screen)
* javascript-obfuscator style identifiers (_0x1a2b3c) and \\uXXXX-encoded names
* `global['...']` / eval / new Function / child_process in build config files
* extremely long single lines in hand-written source
"""
import re
import subprocess
import sys
from pathlib import Path

SOURCE_SUFFIXES = {".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".py", ".json", ".html", ".css", ".sh", ".yml", ".yaml"}
SKIP_PARTS = {"node_modules", "dist", "submission_1", ".venv"}
SKIP_FILES = {"package-lock.json", "scripts/security_scan.py"}
CONFIG_NAME = re.compile(r"(^|/)([\w.-]+\.config\.(c|m)?js|\.eslintrc(\.\w+)?|postcss\.config\.\w+)$")

CHECKS = [
    ("long whitespace run (code hidden off-screen)", re.compile(r"\S[ \t]{60,}\S")),
    ("obfuscator-style identifier", re.compile(r"\b_0x[0-9a-f]{4,}\b")),
    ("unicode-escaped property access", re.compile(r"\[['\"](\\u00[0-9a-fA-F]{2}){3,}")),
    ("global['...'] assignment", re.compile(r"global\[['\"][^'\"]{1,4}['\"]\]\s*=")),
]
CONFIG_CHECKS = [
    ("dynamic code execution in build config", re.compile(r"\beval\s*\(|new\s+Function\s*\(|child_process|createRequire")),
]
MAX_LINE = 2000


def tracked_files():
    output = subprocess.check_output(["git", "ls-files"], text=True)
    for name in output.splitlines():
        path = Path(name)
        if path.suffix in SOURCE_SUFFIXES and not SKIP_PARTS.intersection(path.parts) and name not in SKIP_FILES:
            yield path


def main() -> int:
    problems = []
    for path in tracked_files():
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, FileNotFoundError):
            continue
        is_config = bool(CONFIG_NAME.search(path.as_posix()))
        for number, line in enumerate(text.splitlines(), start=1):
            checks = CHECKS + (CONFIG_CHECKS if is_config else [])
            for label, pattern in checks:
                if pattern.search(line):
                    problems.append(f"{path}:{number}: {label}")
            if len(line) > MAX_LINE and path.suffix not in {".json", ".svg"}:
                problems.append(f"{path}:{number}: line is {len(line)} characters long")
    if problems:
        print("Suspicious code found. Review these lines before merging:\n")
        print("\n".join(sorted(set(problems))))
        return 1
    print("security_scan: no suspicious patterns found")
    return 0


if __name__ == "__main__":
    sys.exit(main())
