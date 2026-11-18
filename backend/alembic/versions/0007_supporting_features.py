"""Supporting backend features independent of optional pgvector.

Branches from 0005 intentionally: vector-less installations can upgrade to 0007.
0008 merges this branch with unchanged 0006 for vector-capable deployments.
Legacy attachment/feedback records are retained, not reclassified or discarded.
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "0007"
down_revision = "0005"
branch_labels = ("supporting",)
depends_on = None


def upgrade():
    op.add_column("attachments", sa.Column("storage_provider", sa.String(30), nullable=True))
    op.add_column("attachments", sa.Column("storage_bucket", sa.String(63), nullable=True))
    op.add_column("citizen_feedback", sa.Column("resolution_history_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        None,
        "citizen_feedback",
        "grievance_history",
        ["resolution_history_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_unique_constraint(None, "citizen_feedback", ["grievance_id", "resolution_history_id"])
    op.add_column(
        "citizen_feedback", sa.Column("resolution_department_id", sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        None,
        "citizen_feedback",
        "departments",
        ["resolution_department_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_citizen_feedback_resolution_department_id",
        "citizen_feedback",
        ["resolution_department_id"],
    )
    op.add_column(
        "contact_enquiries",
        sa.Column("status", sa.String(20), server_default=sa.text("'NEW'"), nullable=False),
    )
    op.add_column("contact_enquiries", sa.Column("reviewed_at", sa.DateTime(timezone=True)))
    op.add_column("contact_enquiries", sa.Column("reviewed_by", sa.UUID()))
    op.create_foreign_key(
        None, "contact_enquiries", "users", ["reviewed_by"], ["id"], ondelete="RESTRICT"
    )
    op.create_index("ix_contact_enquiries_status", "contact_enquiries", ["status"])
    op.create_check_constraint("status_values", "contact_enquiries", "status IN ('NEW','REVIEWED')")
    op.create_check_constraint(
        "review_metadata",
        "contact_enquiries",
        "(status='NEW' AND reviewed_at IS NULL AND reviewed_by IS NULL) OR "
        "(status='REVIEWED' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)",
    )
    op.create_table(
        "faqs",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("question", sa.String(300), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("display_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("question"),
    )
    op.create_table(
        "public_pages",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("slug", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("introduction", sa.Text(), nullable=False),
        sa.Column("sections", JSONB(), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("slug"),
    )
    # Do not leave newly-created hosted tables exposed via independent Data API default grants.
    # No Supabase roles/managed objects are altered; this also runs on ordinary PostgreSQL.
    op.execute("""
    DO $secure$
    DECLARE object_name text; role_name text;
    BEGIN
      FOREACH object_name IN ARRAY ARRAY['faqs','public_pages'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', object_name);
        EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', object_name);
        FOR role_name IN SELECT rolname FROM pg_roles
            WHERE rolname IN ('anon','authenticated','service_role') LOOP
          EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', object_name, role_name);
        END LOOP;
      END LOOP;
    END $secure$;
    """)


def downgrade():
    op.drop_table("public_pages")
    op.drop_table("faqs")
    op.drop_constraint(op.f("ck_contact_enquiries_review_metadata"), "contact_enquiries")
    op.drop_constraint(op.f("ck_contact_enquiries_status_values"), "contact_enquiries")
    op.drop_index("ix_contact_enquiries_status", table_name="contact_enquiries")
    op.drop_constraint(op.f("fk_contact_enquiries_reviewed_by_users"), "contact_enquiries")
    for name in ("reviewed_by", "reviewed_at", "status"):
        op.drop_column("contact_enquiries", name)
    op.drop_constraint(
        op.f("uq_citizen_feedback_grievance_id_resolution_history_id"), "citizen_feedback"
    )
    op.drop_index("ix_citizen_feedback_resolution_department_id", table_name="citizen_feedback")
    op.drop_constraint(
        op.f("fk_citizen_feedback_resolution_department_id_departments"), "citizen_feedback"
    )
    op.drop_column("citizen_feedback", "resolution_department_id")
    op.drop_constraint(
        op.f("fk_citizen_feedback_resolution_history_id_grievance_history"), "citizen_feedback"
    )
    op.drop_column("citizen_feedback", "resolution_history_id")
    op.drop_column("attachments", "storage_bucket")
    op.drop_column("attachments", "storage_provider")
