from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AttachmentView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    original_filename: str
    content_type: str
    file_size: int
    created_at: datetime


class DownloadView(BaseModel):
    url: str
    expires_in: int
