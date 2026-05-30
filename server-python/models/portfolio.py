import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class MemberPortfolio(Base):
    __tablename__ = "member_portfolios"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("members.id"), unique=True, nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        String(120), default="Community Member", server_default="Community Member"
    )
    github_username: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    leetcode_username: Mapped[Optional[str]] = mapped_column(
        String(120), nullable=True
    )
    cached_github_stats: Mapped[Optional[dict]] = mapped_column(
        JSONB, default=dict, server_default="{}", nullable=True
    )
    cached_leetcode_stats: Mapped[Optional[dict]] = mapped_column(
        JSONB, default=dict, server_default="{}", nullable=True
    )
    last_synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    is_cached: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
