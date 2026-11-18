from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.modules.grievances.schemas import Pagination
from app.modules.supporting_validation import CleanText


class ContactInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Annotated[CleanText, Field(min_length=1, max_length=150)]
    email: EmailStr = Field(max_length=255)
    subject: Annotated[CleanText, Field(min_length=1, max_length=255)]
    message: Annotated[CleanText, Field(min_length=1, max_length=5000)]
    website: str = Field(default="", max_length=255, description="Honeypot: leave empty")

    @field_validator("email", mode="before")
    @classmethod
    def email_normalized(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class ContactQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page: int = Field(default=1, ge=1, le=1000000)
    page_size: int = Field(default=10, ge=1, le=100)
    status: Literal["NEW", "REVIEWED"] | None = None
    sort_order: Literal["asc", "desc"] = "desc"


class ContactReview(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["REVIEWED"]


class ContactView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    email: str
    subject: str
    message: str
    status: Literal["NEW", "REVIEWED"]
    created_at: datetime
    reviewed_at: datetime | None


class ContactPage(BaseModel):
    items: list[ContactView]
    pagination: Pagination


class ContactAccepted(BaseModel):
    message: str = "Thank you. Your enquiry has been received."
