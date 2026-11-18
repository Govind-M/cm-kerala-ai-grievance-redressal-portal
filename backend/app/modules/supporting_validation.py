import unicodedata
from typing import Annotated

from pydantic import BeforeValidator


def clean_text(value):
    if not isinstance(value, str):
        raise ValueError("Text is required")
    if any(unicodedata.category(c).startswith("C") and c not in "\n\t" for c in value):
        raise ValueError("Control characters are not allowed")
    return value.strip()


CleanText = Annotated[str, BeforeValidator(clean_text)]
