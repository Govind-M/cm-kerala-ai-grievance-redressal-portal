import logging
import re
from uuid import uuid4

from fastapi import HTTPException

from app.db.models import Attachment
from app.integrations.storage import StorageError, unavailable
from app.modules.attachments import repository as repo
from app.modules.attachments.schemas import AttachmentView, DownloadView
from app.modules.enums import GrievanceStatus, UserRole

logger = logging.getLogger("app.attachments")
EXTENSIONS = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def validate_file(filename, mime, content, limit):
    if not filename or len(filename) > 255 or any(ord(c) < 32 or ord(c) == 127 for c in filename):
        raise HTTPException(422, "Invalid filename.")
    filename = filename.replace("\\", "/").rsplit("/", 1)[-1].strip()
    filename = re.sub(r"[^\w .()-]", "_", filename)
    extension = "." + filename.rsplit(".", 1)[-1].lower()
    expected = EXTENSIONS.get(extension)
    if expected is None or mime != expected:
        raise HTTPException(422, "Only PDF, JPEG, PNG and WebP evidence is allowed.")
    if not content:
        raise HTTPException(422, "Empty files are not allowed.")
    if len(content) > limit:
        raise HTTPException(413, "Attachment exceeds the file-size limit.")
    signatures = {
        "application/pdf": content.startswith(b"%PDF-") and b"%%EOF" in content[-1024:],
        "image/jpeg": content.startswith(b"\xff\xd8\xff") and content.endswith(b"\xff\xd9"),
        "image/png": content.startswith(b"\x89PNG\r\n\x1a\n") and b"IEND" in content[-16:],
        "image/webp": (
            len(content) >= 16
            and content[:4] == b"RIFF"
            and content[8:12] == b"WEBP"
            and int.from_bytes(content[4:8], "little") + 8 == len(content)
        ),
    }
    if not signatures[expected]:
        raise HTTPException(422, "File content does not match its declared type.")
    return filename, expected


def upload(db, user, grievance_id, filename, mime, content, storage, settings):
    if user.role != UserRole.CITIZEN:
        raise HTTPException(403, "Insufficient permissions.")
    key = None
    bucket = settings.supabase_storage_bucket
    try:
        row = repo.visible(db, user, grievance_id, lock=True)
        if row.status not in {
            GrievanceStatus.SUBMITTED,
            GrievanceStatus.UNDER_REVIEW,
            GrievanceStatus.IN_PROGRESS,
            GrievanceStatus.REOPENED,
        }:
            raise HTTPException(409, "Evidence cannot be added to a resolved grievance.")
        filename, mime = validate_file(
            filename, mime, content, settings.attachment_max_size_mb * 1024 * 1024
        )
        if repo.count(db, row.id) >= settings.attachment_max_files_per_grievance:
            raise HTTPException(409, "Grievance attachment limit reached.")
        attachment_id = uuid4()
        key = f"grievances/{row.id}/{attachment_id}"
        # Key is unique and deterministic for this attempt. Compensate even on ambiguous timeouts.
        storage.upload(bucket, key, content, mime)
        attachment = Attachment(
            id=attachment_id,
            grievance_id=row.id,
            uploaded_by=user.id,
            storage_key=key,
            storage_bucket=bucket,
            storage_provider="supabase",
            original_filename=filename,
            content_type=mime,
            file_size=len(content),
        )
        db.add(attachment)
        db.flush()
        response = AttachmentView.model_validate(attachment)
        db.commit()
        return response
    except Exception as exc:
        db.rollback()
        if key is not None:
            try:
                storage.remove(bucket, key)
            except Exception:
                # Internal generated identifier only; allows operators to recover the exact orphan.
                logger.error("Attachment cleanup required: bucket=%s object=%s", bucket, key)
        if isinstance(exc, StorageError):
            raise unavailable() from None
        raise


def listing(db, user, grievance_id):
    repo.visible(db, user, grievance_id)
    return [AttachmentView.model_validate(x) for x in repo.list_evidence(db, grievance_id)]


def download(db, user, attachment_id, storage, settings):
    row = repo.get(db, attachment_id)
    repo.visible(db, user, row.grievance_id)
    if row.storage_provider != "supabase" or not row.storage_bucket:
        raise unavailable()
    try:
        url = storage.sign(row.storage_bucket, row.storage_key, row.original_filename)
    except StorageError:
        raise unavailable() from None
    return DownloadView(url=url, expires_in=settings.attachment_signed_url_seconds)
