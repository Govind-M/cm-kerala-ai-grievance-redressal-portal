from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from app.modules.grievances.choices import District
from app.modules.grievances.schemas import Pagination
from app.modules.supporting_validation import CleanText


class FeedbackInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rating: Annotated[int, Field(strict=True, ge=1, le=5)]
    comment: Annotated[CleanText, Field(min_length=1, max_length=2000)] | None = None


class FeedbackView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    rating: int | None
    comment: str | None
    resolution_history_id: UUID | None
    created_at: datetime


class FeedbackQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page: int = Field(default=1, ge=1, le=1000000)
    page_size: int = Field(default=10, ge=1, le=100)
    district: District | None = None
    department_id: UUID | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    created_from: AwareDatetime | None = None
    created_to: AwareDatetime | None = None
    sort_order: Literal["asc", "desc"] = "desc"

    @model_validator(mode="after")
    def valid_dates(self):
        if self.created_from and self.created_to and self.created_from > self.created_to:
            raise ValueError("created_from must not be after created_to")
        return self


class AdminFeedback(FeedbackView):
    grievance_id: UUID
    reference_number: str
    district: str
    department_id: UUID | None


class FeedbackPage(BaseModel):
    items: list[AdminFeedback]
    pagination: Pagination
