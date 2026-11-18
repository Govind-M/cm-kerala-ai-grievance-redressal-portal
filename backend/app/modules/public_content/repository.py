from sqlalchemy import select

from app.modules.public_content.models import FAQ, PublicPage


def faqs(db, *, active=True):
    query = select(FAQ)
    if active:
        query = query.where(FAQ.is_active.is_(True))
    return db.scalars(query.order_by(FAQ.display_order, FAQ.id).limit(100)).all()


def page(db, slug, *, published=True):
    query = select(PublicPage).where(PublicPage.slug == slug)
    if published:
        query = query.where(PublicPage.is_published.is_(True))
    return db.scalar(query)
