from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError

from app.modules.cmo.service import transactional
from app.modules.public_content import repository as repo
from app.modules.public_content.models import FAQ, PublicPage
from app.modules.public_content.schemas import AdminFAQ, AdminPage, FAQView, PageView


def faqs(db, *, admin=False):
    schema = AdminFAQ if admin else FAQView
    return [schema.model_validate(x) for x in repo.faqs(db, active=not admin)]


def page(db, slug, *, admin=False):
    row = repo.page(db, slug, published=not admin)
    if row is None:
        raise HTTPException(404, "Page not found.")
    return (AdminPage if admin else PageView).model_validate(row)


@transactional
def create_faq(db, user, data):
    # ON CONFLICT is constrained to the question's natural key, not unrelated errors.
    row = db.scalar(
        insert(FAQ)
        .values(**data.model_dump())
        .on_conflict_do_nothing(index_elements=[FAQ.question])
        .returning(FAQ)
    )
    if row is None:
        raise HTTPException(409, "FAQ question already exists.")
    return AdminFAQ.model_validate(row)


@transactional
def update_faq(db, user, faq_id, data):
    row = db.scalar(select(FAQ).where(FAQ.id == faq_id).with_for_update())
    if row is None:
        raise HTTPException(404, "FAQ not found.")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    try:
        db.flush()
    except IntegrityError as exc:
        if getattr(getattr(exc.orig, "diag", None), "constraint_name", None) == "uq_faqs_question":
            raise HTTPException(409, "FAQ question already exists.") from None
        raise
    return AdminFAQ.model_validate(row)


@transactional
def put_page(db, user, slug, data):
    # PostgreSQL upsert serializes concurrent inserts/updates on the slug unique key.
    values = data.model_dump()
    row = db.scalar(
        insert(PublicPage)
        .values(slug=slug, **values)
        .on_conflict_do_update(
            index_elements=[PublicPage.slug], set_={**values, "updated_at": func.now()}
        )
        .returning(PublicPage)
        .execution_options(populate_existing=True)
    )
    return AdminPage.model_validate(row)
