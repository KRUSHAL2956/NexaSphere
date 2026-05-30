import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from database import SessionLocal, engine, get_db
from models.portfolio import MemberPortfolio
from services.portfolio_service import PortfolioSyncService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/content/portfolios", tags=["portfolios"])

# ──────────────────────────────────────────────
# Pydantic output schemas
# ──────────────────────────────────────────────


class GithubStats(BaseModel):
    public_repos: int = 0
    followers: int = 0
    avatar_url: str = ""
    bio: str = ""


class LeetcodeStats(BaseModel):
    totalSolved: int = 0
    easySolved: int = 0
    mediumSolved: int = 0
    hardSolved: int = 0
    ranking: int = 0


class PortfolioResponse(BaseModel):
    id: UUID
    member_id: UUID
    full_name: str
    role: str
    github_username: Optional[str] = None
    leetcode_username: Optional[str] = None
    cached_github_stats: Optional[GithubStats] = None
    cached_leetcode_stats: Optional[LeetcodeStats] = None
    last_synced_at: Optional[datetime] = None
    is_cached: bool = False

    class Config:
        from_attributes = True


class PortfoliosListResponse(BaseModel):
    portfolios: List[PortfolioResponse]
    total: int


# ──────────────────────────────────────────────
# Mock fallback data
# ──────────────────────────────────────────────

MOCK_PORTFOLIOS = [
    {
        "id": "00000000-0000-0000-0000-000000000001",
        "member_id": "00000000-0000-0000-0000-000000000001",
        "full_name": "Rajesh Puripanda",
        "role": "Community Member",
        "github_username": "rajesh-puripanda",
        "leetcode_username": "rajesh_puripanda",
        "cached_github_stats": {
            "public_repos": 24,
            "followers": 89,
            "avatar_url": "https://avatars.githubusercontent.com/u/0?v=4",
            "bio": "Full-stack developer passionate about open source and distributed systems.",
        },
        "cached_leetcode_stats": {
            "totalSolved": 187,
            "easySolved": 98,
            "mediumSolved": 72,
            "hardSolved": 17,
            "ranking": 45231,
        },
        "last_synced_at": datetime.now(timezone.utc).isoformat(),
        "is_cached": True,
    }
]


def _db_available() -> bool:
    """Quick connectivity check without creating a full session."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except (OperationalError, ProgrammingError) as e:
        logger.warning("Database unavailable — falling back to mock data: %s", e)
        return False


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────


@router.get("", response_model=PortfoliosListResponse)
async def list_portfolios(db: Session = Depends(get_db)):
    """Return all member portfolios. Falls back to mock data if DB is down."""
    if not _db_available():
        return PortfoliosListResponse(portfolios=MOCK_PORTFOLIOS, total=len(MOCK_PORTFOLIOS))

    records = db.query(MemberPortfolio).all()
    if not records:
        return PortfoliosListResponse(portfolios=[], total=0)

    return PortfoliosListResponse(
        portfolios=[PortfolioResponse.model_validate(r) for r in records],
        total=len(records),
    )


@router.post("/{portfolio_id}/refresh", response_model=PortfolioResponse)
async def refresh_portfolio_stats(
    portfolio_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Trigger an async refresh of cached platform stats using BackgroundTasks."""
    if not _db_available():
        raise HTTPException(
            status_code=503,
            detail="Database is unavailable. Cannot refresh portfolio.",
        )

    record = db.query(MemberPortfolio).filter(MemberPortfolio.id == portfolio_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Portfolio not found.")

    service = PortfolioSyncService()

    async def _refresh(p: MemberPortfolio):
        gh = await service.fetch_github_metrics(p.github_username) if p.github_username else {}
        lc = await service.fetch_leetcode_metrics(p.leetcode_username) if p.leetcode_username else {}

        with SessionLocal() as session:
            obj = session.query(MemberPortfolio).filter(MemberPortfolio.id == p.id).first()
            if not obj:
                return
            if gh:
                obj.cached_github_stats = gh
            if lc:
                obj.cached_leetcode_stats = lc
            obj.last_synced_at = datetime.now(timezone.utc)
            obj.is_cached = bool(gh or lc)
            session.commit()

    background_tasks.add_task(_refresh, record)

    return PortfolioResponse.model_validate(record)
