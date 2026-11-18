from sqlalchemy import func, select

from app.modules.contact.models import ContactEnquiry


def listing(db, filters):
    conditions = [ContactEnquiry.status == filters.status] if filters.status else []
    total = db.scalar(select(func.count()).select_from(ContactEnquiry).where(*conditions)) or 0
    ordering = (
        (ContactEnquiry.created_at.asc(), ContactEnquiry.id.asc())
        if (filters.sort_order == "asc")
        else (ContactEnquiry.created_at.desc(), ContactEnquiry.id.desc())
    )
    rows = db.scalars(
        select(ContactEnquiry)
        .where(*conditions)
        .order_by(*ordering)
        .offset((filters.page - 1) * filters.page_size)
        .limit(filters.page_size)
    ).all()
    return rows, total


def locked(db, enquiry_id):
    return db.scalar(
        select(ContactEnquiry).where(ContactEnquiry.id == enquiry_id).with_for_update()
    )
