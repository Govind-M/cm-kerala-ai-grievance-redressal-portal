from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.models import CitizenFeedback
from app.modules.attachments.repository import visible
from app.modules.enums import GrievanceStatus, UserRole
from app.modules.feedback import repository as repo
from app.modules.feedback.schemas import AdminFeedback, FeedbackPage, FeedbackView
from app.modules.grievances.schemas import Pagination


def submit(db, user, grievance_id, data):
    if user.role != UserRole.CITIZEN:
        raise HTTPException(403, "Insufficient permissions.")
    try:
        grievance = visible(db, user, grievance_id, lock=True)
        if grievance.status != GrievanceStatus.RESOLVED:
            raise HTTPException(409, "Feedback requires a resolved grievance.")
        cycle = repo.resolution(db, grievance.id)
        if cycle is None:
            raise HTTPException(409, "A recorded resolution cycle is required.")
        if db.scalar(
            select(CitizenFeedback.id).where(
                CitizenFeedback.grievance_id == grievance.id,
                CitizenFeedback.resolution_history_id == cycle.id,
            )
        ):
            raise HTTPException(409, "Feedback already exists for this resolution cycle.")
        row = CitizenFeedback(
            grievance_id=grievance.id,
            citizen_id=user.id,
            rating=data.rating,
            comments=data.comment,
            resolution_history_id=cycle.id,
            reopen_requested=False,
            resolution_department_id=grievance.current_department_id,
        )
        db.add(row)
        db.flush()
        result = FeedbackView.model_validate(row)
        db.commit()
        return result
    except IntegrityError as exc:
        db.rollback()
        if getattr(getattr(exc.orig, "diag", None), "constraint_name", None) == (
            "uq_citizen_feedback_grievance_id_resolution_history_id"
        ):
            raise HTTPException(409, "Feedback already exists for this resolution cycle.") from None
        raise
    except Exception:
        db.rollback()
        raise


def mine(db, user, grievance_id):
    visible(db, user, grievance_id)
    return [FeedbackView.model_validate(x) for x in repo.mine(db, grievance_id, user.id)]


def admin_list(db, filters):
    rows, total = repo.admin_list(db, filters)
    return FeedbackPage(
        items=[
            AdminFeedback(
                **FeedbackView.model_validate(feedback).model_dump(),
                grievance_id=grievance.id,
                reference_number=grievance.reference_number,
                district=grievance.district,
                department_id=feedback.resolution_department_id,
            )
            for feedback, grievance in rows
        ],
        pagination=Pagination(
            page=filters.page,
            page_size=filters.page_size,
            total_items=total,
            total_pages=(total + filters.page_size - 1) // filters.page_size,
        ),
    )
