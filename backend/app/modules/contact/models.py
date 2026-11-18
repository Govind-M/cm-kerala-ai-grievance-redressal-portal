from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAt, UUIDPrimaryKey


class ContactEnquiry(UUIDPrimaryKey, CreatedAt, Base):
    __tablename__ = "contact_enquiries"
    __table_args__ = (
        CheckConstraint("status IN ('NEW', 'REVIEWED')", name="status_values"),
        CheckConstraint(
            "(status='NEW' AND reviewed_at IS NULL AND reviewed_by IS NULL) OR "
            "(status='REVIEWED' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)",
            name="review_metadata",
        ),
    )

    name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), server_default=text("'NEW'"), index=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
