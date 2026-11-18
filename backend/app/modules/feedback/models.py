from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    SmallInteger,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedAt, UUIDPrimaryKey


class CitizenFeedback(UUIDPrimaryKey, CreatedAt, Base):
    __tablename__ = "citizen_feedback"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="rating_range"),
        UniqueConstraint("grievance_id", "resolution_history_id"),
    )

    grievance_id: Mapped[UUID] = mapped_column(
        ForeignKey("grievances.id", ondelete="RESTRICT"), index=True
    )
    citizen_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    rating: Mapped[int | None] = mapped_column(SmallInteger)
    comments: Mapped[str | None] = mapped_column(Text)
    reopen_requested: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    resolution_history_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("grievance_history.id", ondelete="RESTRICT")
    )
    resolution_department_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("departments.id", ondelete="RESTRICT"), index=True
    )

    @property
    def comment(self):
        return self.comments

    grievance: Mapped["Grievance"] = relationship(back_populates="feedback")
    citizen: Mapped["User"] = relationship(back_populates="feedback")


if TYPE_CHECKING:
    from app.db.models import Grievance, User
