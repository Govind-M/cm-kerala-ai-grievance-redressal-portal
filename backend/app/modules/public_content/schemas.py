from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.supporting_validation import CleanText

PageSlug = Literal["home", "about", "how-it-works"]
DISCLAIMER = "This is a recruitment demonstration prototype and is not an official Government of Kerala service."


class FAQInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: Annotated[CleanText, Field(min_length=5, max_length=300)]
    answer: Annotated[CleanText, Field(min_length=5, max_length=5000)]
    display_order: int = Field(default=0, ge=0, le=10000)
    is_active: bool = True


class FAQPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: Annotated[CleanText, Field(min_length=5, max_length=300)] | None = None
    answer: Annotated[CleanText, Field(min_length=5, max_length=5000)] | None = None
    display_order: int | None = Field(default=None, ge=0, le=10000)
    is_active: bool | None = None

    @model_validator(mode="after")
    def not_null(self):
        if not self.model_fields_set or any(
            getattr(self, x) is None for x in self.model_fields_set
        ):
            raise ValueError("Supply at least one non-null field")
        return self


class FAQView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    question: str
    answer: str
    display_order: int


class AdminFAQ(FAQView):
    is_active: bool
    updated_at: datetime


class Section(BaseModel):
    model_config = ConfigDict(extra="forbid")
    heading: Annotated[CleanText, Field(min_length=1, max_length=200)]
    body: Annotated[CleanText, Field(min_length=1, max_length=5000)]


class PageInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Annotated[CleanText, Field(min_length=1, max_length=200)]
    introduction: Annotated[CleanText, Field(min_length=1, max_length=2000)]
    sections: list[Section] = Field(max_length=10)
    is_published: bool = False


class PageView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    slug: str
    title: str
    introduction: str
    sections: list[Section]
    updated_at: datetime
    disclaimer: str = DISCLAIMER


class AdminPage(PageView):
    is_published: bool
