"""
FastAPI application for AI Resume Screening & Candidate Ranking System.
"""

import os
from typing import List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from database import get_db, create_session, save_candidates, get_all_sessions, get_session_with_candidates, export_to_csv
from parser import extract_resume_text
from scorer import rank_candidates
from schemas import HealthResponse, RankResponseSchema, SessionInfoSchema, SessionDetailSchema

load_dotenv()

# ==================== APP SETUP ====================

app = FastAPI(
    title="AI Resume Screening & Candidate Ranking System",
    description="API for ranking candidates based on job description matching",
    version="1.0.0"
)

# CORS Configuration
_raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")
cors_origins = [o.strip() for o in _raw_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== HELPER FUNCTIONS ====================

def extract_text_from_file(filename: str, file_bytes: bytes) -> dict:
    """
    Extract text from a file (PDF, DOCX, or TXT).
    Reuses the existing extract_resume_text function from parser.
    """
    return extract_resume_text(filename, file_bytes)


# ==================== ENDPOINTS ====================

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint for monitoring and load balancers."""
    return {"status": "ok", "message": "Server is running"}


@app.post("/api/rank", response_model=RankResponseSchema, tags=["Ranking"])
async def rank_candidates_endpoint(
    jd_text: Optional[str] = Form(None),
    jd_file: Optional[UploadFile] = File(None),
    resumes: List[UploadFile] = File(...),
    db = Depends(get_db)
):
    """
    Rank candidates based on job description matching.
    
    - **jd_text**: Job description text (optional if jd_file is provided)
    - **jd_file**: Job description file (PDF, DOCX, or TXT) - optional if jd_text is provided
    - **resumes**: List of PDF or DOCX resume files
    """
    # Extract JD text from either text input or file
    extracted_jd_text = ""
    
    if jd_file:
        # Validate JD file extension
        jd_filename = jd_file.filename or ""
        jd_ext = "." + jd_filename.rsplit(".", 1)[-1].lower() if "." in jd_filename else ""
        
        allowed_jd_extensions = {".pdf", ".docx", ".doc", ".txt"}
        
        if jd_ext not in allowed_jd_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported JD file type: {jd_ext}. Supported: PDF, DOCX, TXT"
            )
        
        try:
            # Read JD file bytes
            jd_file_bytes = await jd_file.read()
            
            # For TXT files, decode directly
            if jd_ext == ".txt":
                extracted_jd_text = jd_file_bytes.decode('utf-8')
            else:
                # Extract text from PDF or DOCX
                result = extract_text_from_file(jd_filename, jd_file_bytes)
                
                if result["success"]:
                    extracted_jd_text = result["text"]
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Could not extract text from JD file: {result.get('error', 'Unknown error')}"
                    )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error processing JD file: {str(e)}"
            )
    elif jd_text:
        extracted_jd_text = jd_text
    else:
        raise HTTPException(
            status_code=400,
            detail="Either job description text or JD file is required"
        )
    
    # Validate JD text
    if not extracted_jd_text or not extracted_jd_text.strip():
        raise HTTPException(status_code=400, detail="Job description is empty or could not be extracted")
    
    # Validate resumes
    if not resumes or len(resumes) == 0:
        raise HTTPException(status_code=400, detail="At least one resume is required")
    
    # Supported file extensions
    allowed_extensions = {".pdf", ".docx", ".doc", ".txt"}
    
    # Process resumes
    processed_resumes = []
    errors = []
    
    for resume in resumes:
        # Check file extension
        filename = resume.filename or ""
        ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        
        if ext not in allowed_extensions:
            errors.append(f"Unsupported file type for '{filename}': {ext}")
            continue
        
        try:
            # Read file bytes
            file_bytes = await resume.read()
            
            # Extract text
            result = extract_resume_text(filename, file_bytes)
            
            if result["success"]:
                processed_resumes.append({
                    "filename": result["filename"],
                    "candidate_name": result["candidate_name"],
                    "text": result["text"]
                })
            else:
                # Flag scanned PDFs or extraction failures
                errors.append(f"Could not extract text from '{filename}': {result.get('error', 'Unknown error')}")
                # Still add to processed_resumes with empty text so it gets skipped by scorer
                processed_resumes.append({
                    "filename": result["filename"],
                    "candidate_name": result["candidate_name"],
                    "text": ""
                })
                
        except Exception as e:
            errors.append(f"Error processing '{filename}': {str(e)}")
    
    # Check if we have any valid resumes
    if len(processed_resumes) == 0:
        raise HTTPException(
            status_code=400, 
            detail=f"No valid resumes could be processed. Errors: {'; '.join(errors)}"
        )
    
    try:
        # Run the scoring engine
        results = rank_candidates(extracted_jd_text, processed_resumes)
        
        # Filter out any resumes that had no text (scanned PDFs)
        valid_results = [r for r in results if r.get("final_score", 0) > 0]
        
        # Create session in database
        session = create_session(db, extracted_jd_text, len(valid_results))
        
        # Save candidate results
        save_candidates(db, session.id, valid_results)
        
        # Prepare response
        response_data = {
            "session_id": session.id,
            "total_candidates": len(valid_results),
            "jd_snippet": extracted_jd_text[:100],
            "results": valid_results
        }
        
        # Add warnings if any
        if errors:
            response_data["warnings"] = errors
        
        return response_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during ranking: {str(e)}")


@app.get("/api/history", response_model=List[SessionInfoSchema], tags=["History"])
async def get_history(db = Depends(get_db)):
    """
    Get list of all past ranking sessions.
    """
    try:
        sessions = get_all_sessions(db)
        
        history = []
        for session in sessions:
            history.append({
                "id": session.id,
                "created_at": session.created_at.isoformat(),
                "jd_snippet": session.jd_snippet,
                "total_candidates": session.total_candidates
            })
        
        return history
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching history: {str(e)}")


@app.get("/api/session/{session_id}", response_model=SessionDetailSchema, tags=["History"])
async def get_session(session_id: int, db = Depends(get_db)):
    """
    Get full results for a specific past session.
    """
    try:
        session_data = get_session_with_candidates(db, session_id)
        
        if not session_data:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        
        return session_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching session: {str(e)}")


@app.get("/api/export/{session_id}", tags=["Export"])
async def export_session(session_id: int, db = Depends(get_db)):
    """
    Export session results as CSV file.
    """
    try:
        # Check if session exists
        session_data = get_session_with_candidates(db, session_id)
        
        if not session_data:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        
        # Generate CSV
        csv_content = export_to_csv(db, session_id)
        
        # Return as downloadable file
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=ranking_session_{session_id}.csv"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting session: {str(e)}")


# ==================== MAIN ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)