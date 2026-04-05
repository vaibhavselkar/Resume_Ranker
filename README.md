# AI Resume Screening & Candidate Ranking System

An AI-powered tool that ranks job candidates by matching their resumes against a job description using TF-IDF cosine similarity and skill keyword analysis.

## Features

- Upload a job description (text or PDF/DOCX/TXT file) and up to 10+ resumes
- Ranks candidates by relevance score using ML-based text similarity
- Detects matched ML/data science skills with bonus scoring
- Stores all ranking sessions with full history and re-viewing
- Export any session results as CSV
- Responsive, clean UI built with React

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, plain CSS |
| Backend | FastAPI, Python 3.9+ |
| ML | scikit-learn (TF-IDF), spaCy, NLTK |
| File parsing | PyMuPDF, python-docx |
| Database | SQLite via SQLAlchemy |
| Deployment | Vercel (frontend) + Render (backend) |

## Project Structure

```
Resume_scorer/
├── backend/
│   ├── main.py          # FastAPI routes
│   ├── scorer.py        # TF-IDF ranking engine
│   ├── parser.py        # PDF/DOCX/TXT text extraction
│   ├── database.py      # SQLAlchemy models & CRUD
│   ├── schemas.py       # Pydantic request/response schemas
│   ├── run.py           # Uvicorn entry point
│   └── requirements.txt
└── frontend-react/
    └── src/
        ├── App.js       # All UI and state logic
        └── App.css      # Design system
```

## Local Development

### Backend

```bash
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_sm
python run.py
# API runs at http://localhost:8000
```

### Frontend

```bash
cd frontend-react
npm install
npm start
# UI runs at http://localhost:3000
```

Create `frontend-react/.env.local` for local dev (optional, defaults to localhost:8000):
```
REACT_APP_API_URL=http://localhost:8000
```

## Deployment

### Backend → Render

1. Push repo to GitHub
2. Create a new **Web Service** on [render.com](https://render.com)
3. Connect your GitHub repo
4. Render will auto-detect `render.yaml` and configure the service
5. Copy the deployed URL (e.g. `https://resume-scorer-api.onrender.com`)

### Frontend → Vercel

1. Import your GitHub repo on [vercel.com](https://vercel.com)
2. Set **Root Directory** to `frontend-react`
3. Add environment variable:
   - `REACT_APP_API_URL` = your Render backend URL (no trailing slash)
4. Deploy — Vercel runs `npm run build` automatically

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/rank` | Rank resumes against a JD |
| GET | `/api/history` | List all past sessions |
| GET | `/api/session/{id}` | Get full results for a session |
| GET | `/api/export/{id}` | Download session results as CSV |

## Scoring Algorithm

- **TF-IDF cosine similarity** (60% weight): measures text relevance between JD and resume
- **Skill keyword bonus** (40% weight): rewards matches from 14 ML/data science keywords, max bonus 30%
- **Final score** = `(0.6 × similarity) + (0.4 × skill_bonus)` → displayed as percentage (max ~72%)
