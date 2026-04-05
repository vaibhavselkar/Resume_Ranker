"""
Pydantic schemas for request/response validation.
"""

from typing import List, Optional
from pydantic import BaseModel


# ==================== REQUEST SCHEMAS ====================

class RankRequest(BaseModel):
    """Schema for the ranking request (used for documentation)."""
    jd_text: str
    # resumes are handled as multipart form data, not JSON


# ==================== RESPONSE SCHEMAS ====================

class CandidateResultSchema(BaseModel):
    """Schema for a single candidate result."""
    rank: int
    candidate_name: str
    filename: str
    final_score: float
    score_percent: float
    matched_skills: List[str]
    matched_count: int
    similarity: float          # TF-IDF cosine similarity (raw score)
    skill_bonus: float

    class Config:
        from_attributes = True


class RankResponseSchema(BaseModel):
    """Schema for the ranking response."""
    session_id: int
    total_candidates: int
    jd_snippet: Optional[str] = None
    results: List[CandidateResultSchema]
    warnings: Optional[List[str]] = None


class SessionInfoSchema(BaseModel):
    """Schema for session summary in history list."""
    id: int
    created_at: str
    jd_snippet: str
    total_candidates: int

    class Config:
        from_attributes = True


class SessionDetailSchema(BaseModel):
    """Schema for full session details."""
    session_id: int
    total_candidates: int
    results: List[CandidateResultSchema]
    jd_text: Optional[str] = None
    created_at: Optional[str] = None


class HealthResponse(BaseModel):
    """Schema for health check response."""
    status: str
    message: str


class ErrorResponse(BaseModel):
    """Schema for error responses."""
    detail: str