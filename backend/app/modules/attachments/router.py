from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from starlette.concurrency import run_in_threadpool

from app.core.dependencies import get_current_user, require_citizen
from app.db.session import get_db
from app.integrations.storage import get_storage
from app.modules.attachments import service
from app.modules.attachments.schemas import AttachmentView, DownloadView

router = APIRouter(tags=["Attachments"])


@router.post(
    "/grievances/{grievance_id}/attachments",
    response_model=AttachmentView,
    status_code=201,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["file"],
                        "properties": {"file": {"type": "string", "format": "binary"}},
                    }
                }
            },
        }
    },
)
async def upload(
    grievance_id: UUID,
    request: Request,
    user=Depends(require_citizen),
    db=Depends(get_db),
    storage=Depends(get_storage),
):
    # Parse only after authentication. ASGI middleware bounds the entire multipart body.
    async with request.form(max_files=1, max_fields=0, max_part_size=1024) as form:
        file = form.get("file")
        if not isinstance(file, UploadFile) and not hasattr(file, "read"):
            raise HTTPException(422, "One multipart file named 'file' is required.")
        if len(form.multi_items()) != 1:
            raise HTTPException(422, "Exactly one file is required.")
        settings = request.app.state.settings
        content = await file.read(settings.attachment_max_size_mb * 1024 * 1024 + 1)
        return await run_in_threadpool(
            service.upload,
            db,
            user,
            grievance_id,
            file.filename,
            file.content_type,
            content,
            storage,
            settings,
        )


@router.get("/grievances/{grievance_id}/attachments", response_model=list[AttachmentView])
def listing(grievance_id: UUID, user=Depends(get_current_user), db=Depends(get_db)):
    return service.listing(db, user, grievance_id)


@router.get("/attachments/{attachment_id}/download", response_model=DownloadView)
def download(
    attachment_id: UUID,
    request: Request,
    user=Depends(get_current_user),
    db=Depends(get_db),
    storage=Depends(get_storage),
):
    return service.download(db, user, attachment_id, storage, request.app.state.settings)
