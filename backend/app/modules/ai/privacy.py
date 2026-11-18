"""Conservative contact/credential minimization; not a complete PII detector."""

import re

PATTERNS = (
    (re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b"), "[TOKEN REDACTED]"),
    (re.compile(r"\bAIza[0-9A-Za-z_-]{20,}\b"), "[KEY REDACTED]"),
    (re.compile(r"https?://[^\s\"<>]+", re.I), "[URL REDACTED]"),
    (re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I), "[EMAIL REDACTED]"),
    (
        re.compile(
            r"(?<!\w)\+\d[\d ()-]{6,}\d(?!\w)|\b\d{10,15}\b|\b\d{5}[ -]\d{5}\b|\b\d{4} \d{4} \d{4}\b"
        ),
        "[NUMBER REDACTED]",
    ),
)


def minimize(text: str) -> str:
    for pattern, replacement in PATTERNS:
        text = pattern.sub(replacement, text)
    return text
