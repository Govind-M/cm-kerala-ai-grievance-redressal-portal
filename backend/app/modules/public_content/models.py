from sqlalchemy import Boolean, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAt, UpdatedAt, UUIDPrimaryKey


class FAQ(UUIDPrimaryKey, CreatedAt, UpdatedAt, Base):
    __tablename__ = "faqs"
    question: Mapped[str] = mapped_column(String(300), unique=True)
    answer: Mapped[str] = mapped_column(Text)
    display_order: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))


class PublicPage(UUIDPrimaryKey, CreatedAt, UpdatedAt, Base):
    __tablename__ = "public_pages"
    slug: Mapped[str] = mapped_column(String(50), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    introduction: Mapped[str] = mapped_column(Text)
    sections: Mapped[list[dict]] = mapped_column(JSONB)
    is_published: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
