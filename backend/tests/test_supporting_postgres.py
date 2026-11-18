"""Phase 6 HTTP contracts on real isolated PostgreSQL, fake private object storage."""

from unittest.mock import Mock
from uuid import UUID

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from test_grievances_postgres import api as citizen_api  # noqa: F401
from test_grievances_postgres import create
from test_workflow_postgres import api as workflow_api  # noqa: F401
from test_workflow_postgres import assign, begin, call, report, review_report

from app.db.models import Attachment, CitizenFeedback, ContactEnquiry
from app.integrations.storage import StorageError, get_storage
from app.modules.public_content.models import FAQ, PublicPage
from scripts.seed_public_content import seed_content

P = "/api/v1"
PDF = b"%PDF-1.4\n%fictional evidence\n%%EOF"


@pytest.fixture
def api(workflow_api):  # noqa: F811 - imported pytest fixture dependency
    return workflow_api


@pytest.fixture
def storage(api):
    fake = Mock()
    fake.sign.return_value = (
        "https://synthetic.supabase.co/storage/v1/object/sign/test?token=fictional"
    )
    api.client.app.dependency_overrides[get_storage] = lambda: fake
    return fake


def upload(
    api, gid, *, who="citizen", filename="evidence.pdf", mime="application/pdf", content=PDF
):
    return api.client.post(
        f"{P}/grievances/{gid}/attachments",
        headers=api.headers(who),
        files={"file": (filename, content, mime)},
    )


def resolve(api):
    gid, _ = begin(api)
    review_report(api, report(api, gid)["id"])
    return gid


def feedback(api, gid, **data):
    return api.client.post(
        f"{P}/grievances/{gid}/feedback",
        headers=api.headers(),
        json={"rating": 4, "comment": "Fictional feedback", **data},
    )


@pytest.mark.postgres
def test_evidence_upload_privacy_and_no_status_mutation(api, storage):
    gid = create(api)["id"]
    result = upload(api, gid, filename="../../evidence.pdf")
    assert result.status_code == 201, result.text
    row = result.json()
    assert row["original_filename"] == "evidence.pdf"
    assert set(row) == {"id", "original_filename", "content_type", "file_size", "created_at"}
    args = storage.upload.call_args.args
    assert args[1] == f"grievances/{gid}/{row['id']}"
    assert call(api, "GET", f"/grievances/{gid}", who="citizen")["status"] == "SUBMITTED"
    assert call(api, "GET", f"/grievances/{gid}/attachments", who="citizen")[0] == row
    assert call(api, "GET", f"/grievances/{gid}/attachments")[0] == row
    url = call(api, "GET", f"/attachments/{row['id']}/download", who="citizen")
    assert url["expires_in"] == 60
    assert storage.sign.call_count == 1
    assert (
        api.client.get(
            f"{P}/attachments/{row['id']}/download", headers=api.headers("other")
        ).status_code
        == 404
    )
    assert storage.sign.call_count == 1
    assert api.client.get(f"{P}/attachments/{row['id']}/download").status_code == 401
    assert (
        api.client.get(f"{P}/attachments/{row['id']}/download", headers=api.headers()).headers[
            "cache-control"
        ]
        == "no-store"
    )


@pytest.mark.postgres
@pytest.mark.parametrize("who,expected", [("other", 404), ("cmo", 403), ("officer", 403)])
def test_evidence_upload_role_and_owner(api, storage, who, expected):
    gid = create(api)["id"]
    assert upload(api, gid, who=who).status_code == expected
    storage.upload.assert_not_called()


@pytest.mark.postgres
def test_evidence_officer_hybrid_scope(api, storage):
    gid, _ = begin(api, designated=True)
    result = upload(api, gid)
    assert result.status_code == 201
    aid = result.json()["id"]
    for who in ("officer", "colleague", "cmo", "citizen"):
        assert len(call(api, "GET", f"/grievances/{gid}/attachments", who=who)) == 1
        call(api, "GET", f"/attachments/{aid}/download", who=who)
    for who in ("outsider", "other"):
        call(api, "GET", f"/grievances/{gid}/attachments", who=who, status=404)
        call(api, "GET", f"/attachments/{aid}/download", who=who, status=404)
    assign(api, gid, reassign=True, department_id=str(api.health_id))
    call(api, "GET", f"/attachments/{aid}/download", who="officer", status=404)
    call(api, "GET", f"/attachments/{aid}/download", who="outsider")


@pytest.mark.postgres
@pytest.mark.parametrize(
    "filename,mime,content,status",
    [
        ("run.exe", "application/octet-stream", b"MZexe", 422),
        ("fake.pdf", "application/pdf", b"not a pdf", 422),
        ("file.pdf", "image/png", PDF, 422),
        ("file.pdf", "application/pdf", b"", 422),
        ("x" * 256 + ".pdf", "application/pdf", PDF, 422),
        ("file.pdf", "application/pdf", b"x" * (5 * 1024 * 1024 + 1), 413),
    ],
)
def test_evidence_invalid(api, storage, filename, mime, content, status):
    assert (
        upload(api, create(api)["id"], filename=filename, mime=mime, content=content).status_code
        == status
    )
    storage.upload.assert_not_called()


@pytest.mark.postgres
def test_evidence_count_resolved_and_reopened(api, storage):
    gid = create(api)["id"]
    api.client.app.state.settings.attachment_max_files_per_grievance = 1
    assert upload(api, gid).status_code == 201
    assert upload(api, gid).status_code == 409
    gid = resolve(api)
    assert upload(api, gid).status_code == 409
    call(api, "POST", f"/cmo/grievances/{gid}/reopen", {"reason": "Recurring synthetic issue"})
    assert upload(api, gid).status_code == 201


@pytest.mark.postgres
def test_evidence_storage_failure_and_cleanup(api, storage):
    gid = create(api)["id"]
    storage.upload.side_effect = StorageError("provider secret must not appear")
    response = upload(api, gid)
    assert response.status_code == 503
    assert "provider secret" not in response.text
    storage.remove.assert_called_once()
    with api.db() as db:
        assert db.scalar(select(func.count()).select_from(Attachment)) == 0


@pytest.mark.postgres
def test_evidence_response_failure_and_cleanup(api, storage, monkeypatch):
    from app.modules.attachments import service

    gid = create(api)["id"]
    monkeypatch.setattr(service.AttachmentView, "model_validate", Mock(side_effect=RuntimeError()))
    assert upload(api, gid).status_code == 500
    storage.remove.assert_called_once()
    with api.db() as db:
        assert db.scalar(select(func.count()).select_from(Attachment)) == 0


@pytest.mark.postgres
def test_evidence_database_constraint_failure_and_cleanup(api, storage, monkeypatch):
    from app.modules.attachments import service

    original = service.Attachment
    gid = create(api)["id"]

    def invalid_metadata(**values):
        # Force a real PostgreSQL check failure AFTER the mocked upload succeeded.
        return original(**{**values, "file_size": -1})

    monkeypatch.setattr(service, "Attachment", invalid_metadata)
    response = upload(api, gid)
    assert response.status_code == 500
    assert "nonnegative_file_size" not in response.text
    storage.upload.assert_called_once()
    storage.remove.assert_called_once()
    with api.db() as db:
        assert db.scalar(select(func.count()).select_from(Attachment)) == 0


@pytest.mark.postgres
def test_evidence_cleanup_failure_recoverable(api, storage, caplog):
    gid = create(api)["id"]
    storage.upload.side_effect = StorageError("upload failed")
    storage.remove.side_effect = StorageError("cleanup failed")
    assert upload(api, gid).status_code == 503
    # Operational identifier is generated internally, never a filename/credential/file body.
    storage.remove.assert_called_once()
    assert storage.remove.call_args.args[1].startswith(f"grievances/{gid}/")


@pytest.mark.postgres
def test_feedback_two_resolution_cycles_and_constraint(api):
    gid = resolve(api)
    first = feedback(api, gid)
    assert first.status_code == 201, first.text
    assert first.json()["resolution_history_id"]
    assert feedback(api, gid).status_code == 409
    assert call(api, "GET", f"/grievances/{gid}", who="citizen")["status"] == "RESOLVED"
    call(api, "POST", f"/cmo/grievances/{gid}/reopen", {"reason": "Recurring synthetic issue"})
    assert feedback(api, gid).status_code == 409
    assign(api, gid)
    call(api, "POST", f"/cmo/grievances/{gid}/resume", {"remarks": "Reinvestigate recurring issue"})
    review_report(api, report(api, gid)["id"])
    second = feedback(api, gid)
    assert second.status_code == 201, second.text
    assert first.json()["resolution_history_id"] != second.json()["resolution_history_id"]
    assert len(call(api, "GET", f"/grievances/{gid}/feedback", who="citizen")) == 2
    with api.db() as db:
        with pytest.raises(IntegrityError), db.begin_nested():
            db.add(
                CitizenFeedback(
                    grievance_id=UUID(gid),
                    citizen_id=api.users["citizen"],
                    rating=5,
                    resolution_history_id=UUID(first.json()["resolution_history_id"]),
                )
            )
            db.flush()


@pytest.mark.postgres
@pytest.mark.parametrize(
    "data",
    [
        {"rating": 0},
        {"rating": 6},
        {"rating": True},
        {"rating": "4"},
        {"comment": " "},
        {"comment": "x" * 2001},
        {"comment": "bad\x00text"},
        {"reopen_requested": True},
    ],
)
def test_feedback_validation(api, data):
    assert feedback(api, create(api)["id"], **data).status_code == 422


@pytest.mark.postgres
def test_feedback_owner_and_admin_filters(api):
    gid = resolve(api)
    assert (
        api.client.post(
            f"{P}/grievances/{gid}/feedback", headers=api.headers("other"), json={"rating": 4}
        ).status_code
        == 404
    )
    assert feedback(api, gid).status_code == 201
    for who, status in (("other", 404), ("officer", 403), ("cmo", 403)):
        call(api, "GET", f"/grievances/{gid}/feedback", who=who, status=status)
    for who in ("citizen", "officer"):
        call(api, "GET", "/cmo/feedback", who=who, status=403)
    page = call(
        api,
        "GET",
        "/cmo/feedback",
        params={
            "district": "Ernakulam",
            "rating": 4,
            "department_id": str(api.department_id),
            "page_size": 1,
        },
    )
    assert page["pagination"]["total_items"] == 1
    assert page["items"][0]["grievance_id"] == gid
    assert call(api, "GET", "/cmo/feedback", params={"rating": 1})["items"] == []


@pytest.mark.postgres
def test_feedback_requires_recorded_resolution(api):
    from app.db.models import Grievance
    from app.modules.enums import GrievanceStatus
    gid = create(api)["id"]
    assert feedback(api, gid).status_code == 409
    with api.db() as db:
        db.get(Grievance, UUID(gid)).status = GrievanceStatus.RESOLVED
        db.commit()
    assert feedback(api, gid).status_code == 409  # No durable resolution event.


@pytest.mark.postgres
def test_chunked_payload_boundaries_and_multipart_contract(api, storage):
    gid = create(api)["id"]
    response = api.client.post(P + "/contact/enquiries", content=iter([b"x" * 10000, b"x" * 10000]))
    assert response.status_code == 413
    response = api.client.post(f"{P}/grievances/{gid}/attachments", headers=api.headers(),
                              files=[("file", ("a.pdf", PDF)), ("extra", ("b.pdf", PDF))])
    assert response.status_code == 400
    assert api.client.post(f"{P}/grievances/{gid}/attachments", headers=api.headers(),
                           json={}).status_code == 422
    storage.upload.assert_not_called()


CONTACT = {
    "name": " Fictional Citizen ",
    "email": " DEMO@EXAMPLE.COM ",
    "subject": " General enquiry ",
    "message": " How can I track a grievance? ",
}


@pytest.mark.postgres
def test_public_contact_and_cmo_management(api):
    response = api.client.post(P + "/contact/enquiries", json=CONTACT)
    assert response.status_code == 202
    assert set(response.json()) == {"message"}
    row = call(api, "GET", "/cmo/contact-enquiries")["items"][0]
    assert row["name"] == "Fictional Citizen" and row["email"] == "demo@example.com"
    for who in ("citizen", "officer"):
        call(api, "GET", "/cmo/contact-enquiries", who=who, status=403)
        call(
            api,
            "PATCH",
            f"/cmo/contact-enquiries/{row['id']}",
            {"status": "REVIEWED"},
            who=who,
            status=403,
        )
    reviewed = call(api, "PATCH", f"/cmo/contact-enquiries/{row['id']}", {"status": "REVIEWED"})
    assert reviewed["status"] == "REVIEWED" and reviewed["reviewed_at"]
    assert call(api, "GET", "/cmo/contact-enquiries", params={"status": "NEW"})["items"] == []
    assert (
        len(call(api, "GET", "/cmo/contact-enquiries", params={"status": "REVIEWED"})["items"]) == 1
    )


@pytest.mark.postgres
@pytest.mark.parametrize(
    "data",
    [
        {"email": "not-email"},
        {"name": " "},
        {"subject": " "},
        {"message": " "},
        {"message": "x" * 5001},
        {"message": "bad\x00text"},
        {"status": "REVIEWED"},
    ],
)
def test_contact_validation(api, data):
    assert api.client.post(P + "/contact/enquiries", json={**CONTACT, **data}).status_code == 422


@pytest.mark.postgres
def test_contact_body_limit_throttle_and_honeypot(api):
    assert (
        api.client.post(P + "/contact/enquiries", json={**CONTACT, "website": "bot"}).status_code
        == 202
    )
    with api.db() as db:
        assert db.scalar(select(func.count()).select_from(ContactEnquiry)) == 0
    assert api.client.post(P + "/contact/enquiries", content=b"x" * 16385).status_code == 413
    for _ in range(3):
        assert api.client.post(P + "/contact/enquiries", json=CONTACT).status_code == 202
    response = api.client.post(P + "/contact/enquiries", json=CONTACT)
    assert response.status_code == 429 and response.headers["retry-after"] == "3600"


@pytest.mark.postgres
def test_public_content_seed_editorial_preservation_and_visibility(api):
    with api.db() as db:
        seed_content(db)
        db.commit()
        row = db.scalar(select(FAQ).order_by(FAQ.display_order))
        row.answer = "Edited answer preserved by seed rerun."
        row.is_active = False
        db.commit()
        seed_content(db)
        db.commit()
        assert db.scalar(select(func.count()).select_from(FAQ)) == 5
        assert db.scalar(select(func.count()).select_from(PublicPage)) == 3
    faqs = api.client.get(P + "/public/faqs").json()
    assert len(faqs) == 4
    assert [x["display_order"] for x in faqs] == sorted(x["display_order"] for x in faqs)
    page = api.client.get(P + "/public/content/home")
    assert page.status_code == 200 and "not an official" in page.json()["disclaimer"]
    assert api.client.get(P + "/public/content/unknown").status_code == 404
    data = {
        "title": "Fictional home",
        "introduction": "Prototype information",
        "sections": [{"heading": "Welcome", "body": "Plain text only."}],
        "is_published": False,
    }
    for who in ("citizen", "officer"):
        call(api, "PUT", "/cmo/public-content/home", data, who=who, status=403)
    call(api, "PUT", "/cmo/public-content/home", data)
    assert api.client.get(P + "/public/content/home").status_code == 404
    call(api, "GET", "/cmo/public-content/home")
    call(api, "PUT", "/cmo/public-content/home", {**data, "is_published": True})
    assert api.client.get(P + "/public/content/home").json()["title"] == data["title"]


@pytest.mark.postgres
def test_faq_administration_validation_and_soft_delete(api):
    data = {
        "question": "A fictional question?",
        "answer": "A fictional answer.",
        "display_order": 7,
    }
    for who in ("citizen", "officer"):
        call(api, "POST", "/cmo/faqs", data, who=who, status=403)
    row = call(api, "POST", "/cmo/faqs", data, status=201)
    call(api, "POST", "/cmo/faqs", data, status=409)
    call(api, "PATCH", f"/cmo/faqs/{row['id']}", {"answer": "Updated fictional answer."})
    call(api, "PATCH", f"/cmo/faqs/{row['id']}", {"answer": None}, status=422)
    call(api, "DELETE", f"/cmo/faqs/{row['id']}", status=204)
    assert api.client.get(P + "/public/faqs").json() == []
    assert call(api, "GET", "/cmo/faqs")[0]["is_active"] is False
