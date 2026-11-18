from uuid import UUID

from fastapi import APIRouter, Depends, Response

from app.core.dependencies import require_cmo_admin
from app.db.session import get_db
from app.modules.public_content import service
from app.modules.public_content.schemas import (
    AdminFAQ,
    AdminPage,
    FAQInput,
    FAQPatch,
    FAQView,
    PageInput,
    PageSlug,
    PageView,
)

router = APIRouter(tags=["Public website content"])


@router.get("/public/faqs", response_model=list[FAQView])
def faqs(db=Depends(get_db)):
    return service.faqs(db)


@router.get("/public/content/{page_slug}", response_model=PageView)
def page(page_slug: str, db=Depends(get_db)):
    return service.page(db, page_slug)


@router.get("/cmo/faqs", response_model=list[AdminFAQ])
def admin_faqs(user=Depends(require_cmo_admin), db=Depends(get_db)):
    return service.faqs(db, admin=True)


@router.post("/cmo/faqs", response_model=AdminFAQ, status_code=201)
def create(data: FAQInput, user=Depends(require_cmo_admin), db=Depends(get_db)):
    return service.create_faq(db, user, data)


@router.patch("/cmo/faqs/{faq_id}", response_model=AdminFAQ)
def update(faq_id: UUID, data: FAQPatch, user=Depends(require_cmo_admin), db=Depends(get_db)):
    return service.update_faq(db, user, faq_id, data)


@router.delete("/cmo/faqs/{faq_id}", status_code=204)
def deactivate(faq_id: UUID, user=Depends(require_cmo_admin), db=Depends(get_db)):
    service.update_faq(db, user, faq_id, FAQPatch(is_active=False))
    return Response(status_code=204)


@router.get("/cmo/public-content/{page_slug}", response_model=AdminPage)
def admin_page(page_slug: PageSlug, user=Depends(require_cmo_admin), db=Depends(get_db)):
    return service.page(db, page_slug, admin=True)


@router.put("/cmo/public-content/{page_slug}", response_model=AdminPage)
def put_page(
    page_slug: PageSlug, data: PageInput, user=Depends(require_cmo_admin), db=Depends(get_db)
):
    return service.put_page(db, user, page_slug, data)
