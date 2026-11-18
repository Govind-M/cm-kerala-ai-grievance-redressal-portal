from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import require_cmo_admin
from app.db.session import get_db
from app.modules.contact import service
from app.modules.contact.schemas import (
    ContactAccepted,
    ContactInput,
    ContactPage,
    ContactQuery,
    ContactReview,
    ContactView,
)

router = APIRouter(tags=["Contact enquiries"])


@router.post("/contact/enquiries", response_model=ContactAccepted, status_code=202)
def submit(data: ContactInput, db=Depends(get_db)):
    return service.submit(db, data)


@router.get("/cmo/contact-enquiries", response_model=ContactPage)
def listing(
    filters: Annotated[ContactQuery, Query()], user=Depends(require_cmo_admin), db=Depends(get_db)
):
    return service.listing(db, filters)


@router.patch("/cmo/contact-enquiries/{enquiry_id}", response_model=ContactView)
def review(
    enquiry_id: UUID, data: ContactReview, user=Depends(require_cmo_admin), db=Depends(get_db)
):
    return service.review(db, user, enquiry_id)
