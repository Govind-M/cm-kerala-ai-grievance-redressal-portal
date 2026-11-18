"""Real independent connections, commits and unique constraints in disposable local schemas."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import Mock
from uuid import uuid4

import pytest
from alembic.config import Config
from fastapi import HTTPException
from sqlalchemy import create_engine, func, inspect, select, text
from sqlalchemy.orm import Session

from alembic import command
from app.core.config import BACKEND_DIR, Settings
from app.db.models import Attachment, CitizenFeedback, Grievance, GrievanceHistory, User
from app.modules.attachments import service as attachments
from app.modules.enums import GrievanceStatus, UserRole
from app.modules.feedback import service as feedback
from app.modules.feedback.schemas import FeedbackInput

pytestmark = pytest.mark.postgres


@pytest.fixture
def supporting_engine(pg_engine):
    schema = "phase6_" + uuid4().hex
    with pg_engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(
        pg_engine.url,
        hide_parameters=True,
        connect_args={
            "options": f"-c search_path={schema} -c timezone=UTC -c statement_timeout=15000"
        },
    )
    try:
        with engine.begin() as connection:
            config = Config(str(BACKEND_DIR / "alembic.ini"))
            config.attributes["connection"] = connection
            command.upgrade(config, "0007")
        yield engine
    finally:
        engine.dispose()
        with pg_engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))


def test_concurrent_feedback_and_evidence_count(supporting_engine):
    engine = supporting_engine
    with Session(engine, expire_on_commit=False) as db:
        citizen = User(
            name="Synthetic citizen",
            email="phase6@example.test",
            password_hash="unused",
            role=UserRole.CITIZEN,
            is_active=True,
        )
        db.add(citizen)
        db.flush()
        grievance = Grievance(
            reference_number="SYNTHETIC-" + uuid4().hex[:16],
            citizen_id=citizen.id,
            district="Ernakulam",
            category="Other",
            subject="Fictional case",
            description="Test only",
            status=GrievanceStatus.RESOLVED,
        )
        db.add(grievance)
        db.flush()
        db.add(
            GrievanceHistory(
                grievance_id=grievance.id, changed_by=citizen.id, to_status=GrievanceStatus.RESOLVED
            )
        )
        db.commit()
        gid, uid = grievance.id, citizen.id

    def compete(operation):
        barrier = Barrier(2)
        storage = Mock()
        config = Settings(_env_file=None, attachment_max_files_per_grievance=1)

        def attempt(_):
            with Session(engine, expire_on_commit=False) as db:
                user = db.get(User, uid)
                barrier.wait(timeout=10)
                try:
                    if operation == "feedback":
                        feedback.submit(db, user, gid, FeedbackInput(rating=5))
                    else:
                        attachments.upload(
                            db,
                            user,
                            gid,
                            "test.pdf",
                            "application/pdf",
                            b"%PDF-1.4\n%%EOF",
                            storage,
                            config,
                        )
                    return 201
                except HTTPException as exc:
                    return exc.status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            assert sorted(pool.map(attempt, range(2))) == [201, 409]
        return storage

    compete("feedback")
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(CitizenFeedback)) == 1
        db.get(Grievance, gid).status = GrievanceStatus.REOPENED
        db.commit()
    storage = compete("evidence")
    storage.upload.assert_called_once()
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Attachment)) == 1


def test_incremental_supporting_migration_preserves_legacy_rows(supporting_engine):
    with supporting_engine.begin() as connection:
        config = Config(str(BACKEND_DIR / "alembic.ini"))
        config.attributes["connection"] = connection
        command.downgrade(config, "0005")
        uid, gid, aid, fid, cid = [uuid4() for _ in range(5)]
        connection.execute(
            text(
                "INSERT INTO users(id,name,email,password_hash,role) "
                "VALUES(:id,'Legacy fictional','legacy@example.test','unused','CITIZEN')"
            ),
            {"id": uid},
        )
        connection.execute(
            text(
                "INSERT INTO grievances(id,reference_number,citizen_id,district,category,subject,description) "
                "VALUES(:id,'PHASE6-LEGACY',:uid,'Test','Test','Legacy','Test')"
            ),
            {"id": gid, "uid": uid},
        )
        connection.execute(
            text(
                "INSERT INTO attachments(id,grievance_id,uploaded_by,storage_key,original_filename,content_type,file_size) "
                "VALUES(:id,:gid,:uid,'legacy/key','legacy.pdf','application/pdf',123)"
            ),
            {"id": aid, "gid": gid, "uid": uid},
        )
        connection.execute(
            text(
                "INSERT INTO citizen_feedback(id,grievance_id,citizen_id,rating,comments) "
                "VALUES(:id,:gid,:uid,NULL,'Legacy comment')"
            ),
            {"id": fid, "gid": gid, "uid": uid},
        )
        connection.execute(
            text(
                "INSERT INTO contact_enquiries(id,name,email,subject,message) "
                "VALUES(:id,'Legacy','contact@example.test','Legacy subject','Legacy message')"
            ),
            {"id": cid},
        )
        for target in ("0007", "0005", "0007"):
            (command.downgrade if target == "0005" else command.upgrade)(config, target)
            assert (
                connection.scalar(
                    text("SELECT storage_key FROM attachments WHERE id=:id"), {"id": aid}
                )
                == "legacy/key"
            )
            assert (
                connection.scalar(
                    text("SELECT comments FROM citizen_feedback WHERE id=:id"), {"id": fid}
                )
                == "Legacy comment"
            )
            assert (
                connection.scalar(
                    text("SELECT message FROM contact_enquiries WHERE id=:id"), {"id": cid}
                )
                == "Legacy message"
            )
            if target == "0007":
                assert (
                    connection.scalar(
                        text("SELECT status FROM contact_enquiries WHERE id=:id"), {"id": cid}
                    )
                    == "NEW"
                )
                assert (
                    connection.scalar(
                        text("SELECT resolution_history_id FROM citizen_feedback WHERE id=:id"),
                        {"id": fid},
                    )
                    is None
                )
                assert (
                    connection.scalar(
                        text("SELECT storage_bucket FROM attachments WHERE id=:id"), {"id": aid}
                    )
                    is None
                )
        assert "faqs" in inspect(connection).get_table_names()
