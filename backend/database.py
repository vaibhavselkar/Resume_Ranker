"""
Database module for Resume Screening System.
Contains SQLAlchemy models and CRUD operations.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
import json
import csv
import io
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session

load_dotenv()

# Database setup
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./resume_screening.db")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}  # Needed for SQLite
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ==================== MODELS ====================

class RankingSession(Base):
    """Model for storing ranking session metadata."""
    __tablename__ = "ranking_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    jd_text = Column(Text, nullable=False)
    jd_snippet = Column(String(200), nullable=False)  # First 200 chars of JD
    total_candidates = Column(Integer, nullable=False)

    # Relationship to candidate results
    candidates = relationship("CandidateResult", back_populates="session", cascade="all, delete-orphan")


class CandidateResult(Base):
    """Model for storing individual candidate ranking results."""
    __tablename__ = "candidate_results"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("ranking_sessions.id"), nullable=False)
    rank = Column(Integer, nullable=False)
    filename = Column(String, nullable=False)
    candidate_name = Column(String, nullable=False)
    final_score = Column(Float, nullable=False)
    score_percent = Column(Float, nullable=False)
    similarity = Column(Float, nullable=False)
    skill_bonus = Column(Float, nullable=False)
    matched_skills = Column(Text, nullable=False)  # JSON string of list
    matched_count = Column(Integer, nullable=False)

    # Relationship back to session
    session = relationship("RankingSession", back_populates="candidates")


# Create tables
Base.metadata.create_all(bind=engine)


# ==================== CRUD FUNCTIONS ====================

def get_db():
    """Dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_session(db: Session, jd_text: str, total_candidates: int) -> RankingSession:
    """
    Create a new ranking session.
    
    Args:
        db: Database session
        jd_text: Full job description text
        total_candidates: Number of resumes processed
        
    Returns:
        Created RankingSession object
    """
    # Create snippet (first 200 characters)
    jd_snippet = jd_text[:200] if len(jd_text) > 200 else jd_text
    
    session = RankingSession(
        jd_text=jd_text,
        jd_snippet=jd_snippet,
        total_candidates=total_candidates
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def save_candidates(db: Session, session_id: int, results: List[Dict[str, Any]]) -> None:
    """
    Save candidate results to the database.
    
    Args:
        db: Database session
        session_id: ID of the ranking session
        results: List of candidate result dictionaries
    """
    for result in results:
        candidate = CandidateResult(
            session_id=session_id,
            rank=result["rank"],
            filename=result["filename"],
            candidate_name=result["candidate_name"],
            final_score=result["final_score"],
            score_percent=result["score_percent"],
            similarity=result["similarity"],
            skill_bonus=result["skill_bonus"],
            matched_skills=json.dumps(result["matched_skills"]),
            matched_count=result["matched_count"]
        )
        db.add(candidate)
    db.commit()


def get_all_sessions(db: Session) -> List[RankingSession]:
    """
    Get all ranking sessions, ordered by most recent first.
    
    Args:
        db: Database session
        
    Returns:
        List of RankingSession objects
    """
    return db.query(RankingSession).order_by(RankingSession.created_at.desc()).all()


def get_session_with_candidates(db: Session, session_id: int) -> Optional[Dict[str, Any]]:
    """
    Get a complete session with all candidate results.
    
    Args:
        db: Database session
        session_id: ID of the session to retrieve
        
    Returns:
        Dictionary with session data and results, or None if not found
    """
    session = db.query(RankingSession).filter(RankingSession.id == session_id).first()
    
    if not session:
        return None
    
    # Get all candidates for this session, ordered by rank
    candidates = db.query(CandidateResult).filter(
        CandidateResult.session_id == session_id
    ).order_by(CandidateResult.rank).all()
    
    # Format results
    results = []
    for candidate in candidates:
        results.append({
            "rank": candidate.rank,
            "candidate_name": candidate.candidate_name,
            "filename": candidate.filename,
            "final_score": candidate.final_score,
            "score_percent": candidate.score_percent,
            "matched_skills": json.loads(str(candidate.matched_skills)),
            "matched_count": candidate.matched_count,
            "similarity": candidate.similarity,
            "skill_bonus": candidate.skill_bonus
        })
    
    return {
        "session_id": session.id,
        "total_candidates": session.total_candidates,
        "results": results,
        "jd_text": session.jd_text,
        "created_at": session.created_at.isoformat()
    }


def export_to_csv(db: Session, session_id: int) -> str:
    """
    Export session results as CSV string.
    
    Args:
        db: Database session
        session_id: ID of the session to export
        
    Returns:
        CSV string with ranked results
    """
    session_data = get_session_with_candidates(db, session_id)
    
    if not session_data:
        return ""
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow(["Rank", "Candidate Name", "Score %", "Matched Skills", "Similarity", "Skill Bonus", "Filename"])

    # Write data rows
    for result in session_data["results"]:
        matched_skills_str = "; ".join(result["matched_skills"])
        writer.writerow([
            result["rank"],
            result["candidate_name"],
            result["score_percent"],
            matched_skills_str,
            round(result["similarity"] * 100, 1),
            round(result["skill_bonus"] * 100, 1),
            result["filename"]
        ])
    
    return output.getvalue()