from sqlalchemy import func, select

from app.db.models import CitizenFeedback, Grievance, GrievanceHistory
from app.modules.enums import GrievanceStatus


def resolution(db, grievance_id):
    return db.scalar(
        select(GrievanceHistory)
        .where(
            GrievanceHistory.grievance_id == grievance_id,
            GrievanceHistory.to_status == GrievanceStatus.RESOLVED,
        )
        .order_by(GrievanceHistory.created_at.desc(), GrievanceHistory.id.desc())
        .limit(1)
    )


def mine(db, grievance_id, citizen_id):
    return db.scalars(
        select(CitizenFeedback)
        .where(CitizenFeedback.grievance_id == grievance_id, CitizenFeedback.citizen_id == citizen_id)
        .order_by(CitizenFeedback.created_at, CitizenFeedback.id)
    ).all()


def admin_list(db, filters):
    conditions = []
    if filters.district:
        conditions.append(Grievance.district == filters.district.value)
    if filters.department_id:
        conditions.append(CitizenFeedback.resolution_department_id == filters.department_id)
    if filters.rating is not None:
        conditions.append(CitizenFeedback.rating == filters.rating)
    if filters.created_from:
        conditions.append(CitizenFeedback.created_at >= filters.created_from)
    if filters.created_to:
        conditions.append(CitizenFeedback.created_at <= filters.created_to)
    base = (
        select(CitizenFeedback, Grievance)
        .join(Grievance, Grievance.id == CitizenFeedback.grievance_id)
        .where(*conditions)
    )
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    sort = CitizenFeedback.created_at
    ordering = (
        (sort.asc(), CitizenFeedback.id.asc())
        if filters.sort_order == "asc"
        else (sort.desc(), CitizenFeedback.id.desc())
    )
    return db.execute(
        base.order_by(*ordering)
        .offset((filters.page - 1) * filters.page_size)
        .limit(filters.page_size)
    ).all(), total
