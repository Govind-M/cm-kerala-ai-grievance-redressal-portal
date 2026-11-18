from datetime import UTC, datetime

from fastapi import HTTPException

from app.modules.contact import repository as repo
from app.modules.contact.models import ContactEnquiry
from app.modules.contact.schemas import ContactAccepted, ContactPage, ContactView
from app.modules.grievances.schemas import Pagination


def submit(db, data):
    if data.website:
        return ContactAccepted()  # Silent honeypot: no storage or provider side effect.
    try:
        db.add(ContactEnquiry(**data.model_dump(exclude={"website"})))
        db.commit()
        return ContactAccepted()
    except Exception:
        db.rollback()
        raise


def listing(db, filters):
    rows, total = repo.listing(db, filters)
    return ContactPage(
        items=[ContactView.model_validate(x) for x in rows],
        pagination=Pagination(
            page=filters.page,
            page_size=filters.page_size,
            total_items=total,
            total_pages=(total + filters.page_size - 1) // filters.page_size,
        ),
    )


def review(db, user, enquiry_id):
    try:
        row = repo.locked(db, enquiry_id)
        if row is None:
            raise HTTPException(404, "Enquiry not found.")
        if row.status != "REVIEWED":
            row.status, row.reviewed_at, row.reviewed_by = "REVIEWED", datetime.now(UTC), user.id
        db.flush()
        result = ContactView.model_validate(row)
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
