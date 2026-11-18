from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import require_citizen, require_cmo_admin
from app.db.session import get_db
from app.modules.feedback import service
from app.modules.feedback.schemas import FeedbackInput, FeedbackPage, FeedbackQuery, FeedbackView

router = APIRouter(tags=["Citizen feedback"])


@router.post("/grievances/{grievance_id}/feedback", response_model=FeedbackView, status_code=201)
def submit(
    grievance_id: UUID, data: FeedbackInput, user=Depends(require_citizen), db=Depends(get_db)
):
    return service.submit(db, user, grievance_id, data)


@router.get("/grievances/{grievance_id}/feedback", response_model=list[FeedbackView])
def mine(grievance_id: UUID, user=Depends(require_citizen), db=Depends(get_db)):
    return service.mine(db, user, grievance_id)


@router.get("/cmo/feedback", response_model=FeedbackPage)
def admin_list(
    filters: Annotated[FeedbackQuery, Query()], user=Depends(require_cmo_admin), db=Depends(get_db)
):
    return service.admin_list(db, filters)
