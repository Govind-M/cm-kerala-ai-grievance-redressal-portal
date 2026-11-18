"""Idempotent prototype content seed. Never overwrites editorial changes or creates accounts."""

import argparse
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert

from app.core.config import get_settings
from app.db.session import get_session_factory
from app.modules.public_content.models import FAQ, PublicPage
from app.modules.public_content.schemas import DISCLAIMER

FAQS = (
    (
        "How can a citizen submit a grievance?",
        "Register and sign in, submit the grievance, then optionally upload supporting evidence.",
    ),
    (
        "How can grievances be tracked?",
        "Sign in and use your own grievance reference or dashboard. Tracking requires authentication.",
    ),
    (
        "What do grievance statuses mean?",
        "SUBMITTED, UNDER_REVIEW, IN_PROGRESS, RESOLVED and REOPENED describe the controlled review lifecycle.",
    ),
    (
        "How are grievances assigned to departments?",
        "A CMO administrator chooses the department and optionally a designated officer. AI suggestions are advisory only.",
    ),
    (
        "Can citizens reopen a resolved grievance?",
        "Citizens may provide feedback after resolution. Only a CMO administrator can officially reopen a grievance.",
    ),
)
PAGES = {
    "home": (
        "Public Grievance Demonstration",
        "Submit and follow your fictional grievances securely.",
    ),
    "about": (
        "About this prototype",
        "A WhiteMatrix Software Solutions recruitment demonstration, using fictional data.",
    ),
    "how-it-works": (
        "How it works",
        "Register, submit, track, and provide feedback after CMO-approved resolution.",
    ),
}


def seed_content(db):
    db.execute(text("SELECT pg_advisory_xact_lock(2026111806)"))
    for order, (question, answer) in enumerate(FAQS):
        db.execute(
            insert(FAQ)
            .values(
                id=uuid4(), question=question, answer=answer, display_order=order, is_active=True
            )
            .on_conflict_do_nothing(index_elements=[FAQ.question])
        )
    for slug, (title, intro) in PAGES.items():
        db.execute(
            insert(PublicPage)
            .values(
                id=uuid4(),
                slug=slug,
                title=title,
                introduction=intro,
                sections=[{"heading": "Prototype disclaimer", "body": DISCLAIMER}],
                is_published=True,
            )
            .on_conflict_do_nothing(index_elements=[PublicPage.slug])
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm-hosted-target", help="Required hosted database fingerprint")
    args = parser.parse_args()
    settings = get_settings()
    if settings.database_target == "supabase":
        from scripts.supabase_db import target_fingerprint

        if args.confirm_hosted_target != target_fingerprint(settings):
            parser.error("Explicit matching hosted-target confirmation is required")
    with get_session_factory()() as db:
        seed_content(db)
        db.commit()
    print("Reference content seeded; existing content preserved. Gemini requests: 0.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Content seed failed ({type(exc).__name__}); private details withheld.")
        raise SystemExit(1) from None
