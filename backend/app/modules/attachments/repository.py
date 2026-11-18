from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, raiseload

from app.db.models import Attachment, DepartmentAssignment, Grievance, User
from app.modules.cmo.repository import department_scope
from app.modules.enums import UserRole
from app.modules.grievances.workflow import officer_assignment


def visible(db: Session, user: User, grievance_id: UUID, *, lock=False):
    query = select(Grievance).where(Grievance.id == grievance_id)
    if user.role == UserRole.CITIZEN:
        query = query.where(Grievance.citizen_id == user.id)
    elif user.role == UserRole.DEPARTMENT_OFFICER:
        query = department_scope(user).where(DepartmentAssignment.grievance_id == grievance_id)
    elif user.role != UserRole.CMO_ADMIN:
        raise HTTPException(403, "Insufficient permissions.")
    if lock:
        query = query.with_for_update(of=Grievance).execution_options(populate_existing=True)
    row = db.scalar(query)
    if row is None:
        raise HTTPException(404, "Grievance not found.")
    if user.role == UserRole.DEPARTMENT_OFFICER:
        officer_assignment(db, row, user)
    return row


def evidence_query(grievance_id):
    # This API exposes citizen grievance evidence, never private report attachments.
    return (
        select(Attachment)
        .where(Attachment.grievance_id == grievance_id, Attachment.report_id.is_(None))
        .options(raiseload("*"))
    )


def count(db, grievance_id):
    return (
        db.scalar(
            select(func.count())
            .select_from(Attachment)
            .where(Attachment.grievance_id == grievance_id)
        )
        or 0
    )


def list_evidence(db, grievance_id):
    return db.scalars(
        evidence_query(grievance_id).order_by(Attachment.created_at, Attachment.id)
    ).all()


def get(db, attachment_id):
    row = db.scalar(
        select(Attachment)
        .where(Attachment.id == attachment_id, Attachment.report_id.is_(None))
        .options(raiseload("*"))
    )
    if row is None:
        raise HTTPException(404, "Attachment not found.")
    return row
