import { useState } from 'react';
import './App.css';
import Logo from './components/Logo';

/* ── Shared SVG icons ── */
const IconUpload = () => (
  <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 16v-8m0 0l-3 3m3-3l3 3M6.5 19a4.5 4.5 0 01-.88-8.916A6 6 0 0117.4 9.6a4 4 0 01.6 7.95" />
  </svg>
);

const IconDoc = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconFolder = () => (
  <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.25">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
);

/* Score colour helper */
function scoreClass(pct) {
  if (pct >= 60) return 'score-high';
  if (pct >= 30) return 'score-medium';
  return 'score-low';
}

function rankClass(rank) {
  if (rank === 1) return 'rank-1';
  if (rank === 2) return 'rank-2';
  if (rank === 3) return 'rank-3';
  return 'rank-other';
}

/* ── Candidate Card (used on results + session-detail) ── */
function CandidateCard({ candidate, rank }) {
  const pct   = candidate.score_percent ?? 0;
  const cls   = scoreClass(pct);

  return (
    <div className="candidate-card">
      <div className="candidate-rank">
        <span className={`rank-badge ${rankClass(rank)}`}>#{rank}</span>
      </div>
      <div className="candidate-body">
        <div className="candidate-name">{candidate.candidate_name || 'Unknown'}</div>
        <div className="candidate-filename">{candidate.filename}</div>

        <div className="score-bar-row">
          <div className="score-bar-track">
            <div
              className={`score-bar-fill ${cls}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <span className={`score-value ${cls}`}>{pct.toFixed(1)}%</span>
        </div>

        {candidate.matched_skills?.length > 0 && (
          <div className="skill-tags">
            {candidate.matched_skills.map((s, i) => (
              <span key={i} className="skill-tag">{s}</span>
            ))}
          </div>
        )}

        <div className="candidate-stats">
          <span className="candidate-stat">
            <strong>JD Similarity:</strong> {((candidate.similarity || 0) * 100).toFixed(1)}%
          </span>
          <span className="candidate-stat">
            <strong>Skill Bonus:</strong> {((candidate.skill_bonus || 0) * 100).toFixed(1)}%
          </span>
          {candidate.matched_count !== undefined && (
            <span className="candidate-stat">
              <strong>Skills Matched:</strong> {candidate.matched_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════ */
function App() {
  const [currentPage,   setCurrentPage]   = useState('home');
  const [jdText,        setJdText]        = useState('');
  const [jdFile,        setJdFile]        = useState(null);
  const [resumes,       setResumes]       = useState([]);
  const [results,       setResults]       = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [history,       setHistory]       = useState([]);
  const [sessionDetail, setSessionDetail] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  /* ── Handlers ── */
  const handleJdFileChange = (e) => {
    const file = e.target.files[0];
    if (file) { setJdFile(file); setJdText(''); }
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setResumes(prev => {
      // Deduplicate by name+size so re-selecting the same file doesn't double-add
      const existing = new Set(prev.map(f => f.name + f.size));
      const unique = newFiles.filter(f => !existing.has(f.name + f.size));
      return [...prev, ...unique];
    });
    // Reset input so the same file can be re-selected after removal
    e.target.value = '';
  };

  const handleRank = async (e) => {
    e.preventDefault();
    if (!jdText.trim() && !jdFile) { setError('Please enter a job description or upload a JD file'); return; }
    if (resumes.length === 0)       { setError('Please upload at least one resume'); return; }

    setLoading(true);
    setError('');

    const formData = new FormData();
    if (jdFile) { formData.append('jd_file', jdFile); }
    else        { formData.append('jd_text', jdText); }
    resumes.forEach(r => formData.append('resumes', r));

    try {
      const res = await fetch(`${API_BASE_URL}/api/rank`, { method: 'POST', body: formData });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed to rank resumes'); }
      const data = await res.json();
      setResults(data);
      setCurrentPage('results');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/history`);
      if (!res.ok) throw new Error('Failed to fetch history');
      setHistory(await res.json());
    } catch (err) { setError(err.message); }
  };

  const fetchSession = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/session/${id}`);
      if (!res.ok) throw new Error('Failed to fetch session');
      setSessionDetail(await res.json());
      setCurrentPage('session-detail');
    } catch (err) { setError(err.message); }
  };

  const exportSession = (id) => window.open(`${API_BASE_URL}/api/export/${id}`, '_blank');

  /* ── Navigation ── */
  const goToHome = () => {
    setCurrentPage('home'); setResults(null); setSessionDetail(null);
    setJdText(''); setJdFile(null); setResumes([]); setError('');
  };
  const goToUpload  = () => { setCurrentPage('upload'); setResults(null); setSessionDetail(null); setError(''); };
  const goToHistory = () => { fetchHistory(); setCurrentPage('history'); setSessionDetail(null); setError(''); };

  const clearJdFile   = () => { setJdFile(null); document.getElementById('jd-file').value = ''; };
  const removeResume  = (idx) => setResumes(prev => prev.filter((_, i) => i !== idx));

  /* ── Nav scroll helper ── */
  const scrollTo = (id) => {
    goToHome();
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 120);
  };

  /* ════════════════════════════════════════════════════════
     PAGE RENDERERS
     ════════════════════════════════════════════════════════ */
  const renderPage = () => {
    switch (currentPage) {

      /* ──────────────────── UPLOAD ──────────────────── */
      case 'upload':
        return (
          <div className="upload-page">
            <div className="upload-container">
              <div className="upload-header">
                <h2>Upload &amp; Rank Resumes</h2>
                <p className="upload-description">
                  Provide a job description on the left and add candidate resumes on the right.
                </p>
              </div>

              <form onSubmit={handleRank} className="upload-form">

                <div className="upload-columns">

                  {/* ── Left: Job Description ── */}
                  <div className="upload-col">
                    <div className="col-header">
                      <span className="col-title">Job Description</span>
                      <span className="col-hint">Upload a file OR paste text</span>
                    </div>

                    {/* JD dropzone */}
                    <div className="file-upload-area jd-upload">
                      <input type="file" id="jd-file" accept=".pdf,.docx,.doc,.txt"
                             onChange={handleJdFileChange} />
                      <div className="file-upload-placeholder">
                        <span className="upload-icon"><IconUpload /></span>
                        <p>Click or drag to upload JD</p>
                        <p className="file-hint">PDF, DOCX, TXT</p>
                      </div>
                      {jdFile && (
                        <div className="file-selected">
                          <span className="file-icon"><IconDoc /></span>
                          <span className="file-name">{jdFile.name}</span>
                          <span className="file-size">({(jdFile.size / 1024).toFixed(1)} KB)</span>
                          <button type="button" className="remove-file" onClick={clearJdFile}>×</button>
                        </div>
                      )}
                    </div>

                    <div className="divider"><span>OR</span></div>

                    <textarea
                      className="jd-textarea"
                      value={jdText}
                      onChange={(e) => setJdText(e.target.value)}
                      placeholder="Paste the job description here…"
                      disabled={!!jdFile}
                    />
                  </div>

                  {/* ── Right: Resumes ── */}
                  <div className="upload-col">
                    <div className="col-header">
                      <span className="col-title">Candidate Resumes</span>
                      {resumes.length > 0
                        ? <span className="col-badge">{resumes.length} file{resumes.length > 1 ? 's' : ''}</span>
                        : <span className="col-hint">PDF or DOCX · multiple allowed</span>
                      }
                    </div>

                    {/* Resume dropzone — always visible for adding more */}
                    <div className="file-upload-area resume-dropzone">
                      <input type="file" id="resume-files" multiple accept=".pdf,.docx,.doc,.txt"
                             onChange={handleFileChange} />
                      <div className="file-upload-placeholder">
                        <span className="upload-icon"><IconUpload /></span>
                        <p>{resumes.length > 0 ? 'Add more resumes' : 'Click or drag to upload'}</p>
                        <p className="file-hint">PDF, DOCX, TXT · select multiple</p>
                      </div>
                    </div>

                    {/* File list */}
                    {resumes.length > 0 && (
                      <div className="resume-file-list">
                        {resumes.map((file, i) => (
                          <div key={i} className="resume-file-item">
                            <span className="resume-file-icon"><IconDoc /></span>
                            <div className="resume-file-info">
                              <span className="resume-file-name">{file.name}</span>
                              <span className="resume-file-size">{(file.size / 1024).toFixed(1)} KB</span>
                            </div>
                            <button
                              type="button"
                              className="resume-file-remove"
                              onClick={() => removeResume(i)}
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {error && <div className="error-message">{error}</div>}

                <button type="submit" className="btn btn-primary btn-submit" disabled={loading}>
                  {loading
                    ? <><span className="spinner" /> Analyzing resumes…</>
                    : `Rank ${resumes.length > 0 ? resumes.length + ' ' : ''}Candidate${resumes.length !== 1 ? 's' : ''}`
                  }
                </button>
              </form>
            </div>
          </div>
        );

      /* ──────────────────── RESULTS ──────────────────── */
      case 'results':
        return (
          <div className="results-page">
            <div className="results-page-inner">

              <div className="results-page-header">
                <div className="results-page-title">
                  <h2>Ranking Results</h2>
                  <p className="results-meta">
                    Session #{results?.session_id} &nbsp;·&nbsp;
                    {results?.total_candidates} candidate{results?.total_candidates !== 1 ? 's' : ''} ranked
                  </p>
                </div>
                <div className="results-page-actions">
                  <button className="btn btn-secondary btn-small" onClick={goToUpload}>New Search</button>
                  <button className="btn btn-primary  btn-small"
                          onClick={() => exportSession(results?.session_id)}>
                    Export CSV
                  </button>
                </div>
              </div>

              {results?.warnings?.length > 0 && (
                <div className="warnings">
                  <h4>Warnings</h4>
                  <ul>{results.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              )}

              <div className="candidates-list">
                {results?.results?.map((c, i) => (
                  <CandidateCard key={i} candidate={c} rank={i + 1} />
                ))}
              </div>

              <div className="results-footer-bar">
                <button className="btn btn-secondary" onClick={goToUpload}>New Ranking</button>
                <button className="btn btn-primary"  onClick={goToHistory}>View History</button>
              </div>
            </div>
          </div>
        );

      /* ──────────────────── HISTORY ──────────────────── */
      case 'history':
        return (
          <div className="history-page">
            <div className="history-page-inner">

              <div className="page-header">
                <h2>Session History</h2>
                <button className="btn btn-primary btn-small" onClick={goToUpload}>New Ranking</button>
              </div>

              {history.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon"><IconFolder /></span>
                  <p>No ranking sessions yet. Upload resumes to get started.</p>
                  <button className="btn btn-primary" onClick={goToUpload}>Upload Resumes</button>
                </div>
              ) : (
                <div className="history-table-container">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Session</th>
                        <th>Date</th>
                        <th>Job Description</th>
                        <th style={{ textAlign: 'center' }}>Candidates</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((s) => (
                        <tr key={s.id}>
                          <td><span className="history-session-id">#{s.id}</span></td>
                          <td><span className="history-date">
                            {new Date(s.created_at).toLocaleDateString('en-GB', {
                              day: '2-digit', month: 'short', year: 'numeric'
                            })}
                          </span></td>
                          <td><span className="history-jd-snippet">
                            {s.jd_snippet?.substring(0, 90)}{s.jd_snippet?.length > 90 ? '…' : ''}
                          </span></td>
                          <td className="history-candidates">{s.total_candidates}</td>
                          <td>
                            <div className="history-actions-cell">
                              <button className="btn-table-view" onClick={() => fetchSession(s.id)}>
                                View Results
                              </button>
                              <span style={{ color: '#E2E8F0' }}>·</span>
                              <button className="btn-table-export" onClick={() => exportSession(s.id)}>
                                Export
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="history-page-footer">
                <button className="btn btn-secondary" onClick={goToHome}>Back to Home</button>
                <button className="btn btn-primary"  onClick={goToUpload}>New Ranking</button>
              </div>
            </div>
          </div>
        );

      /* ──────────────────── SESSION DETAIL ──────────────────── */
      case 'session-detail':
        return (
          <div className="session-detail-page">
            <div className="session-detail-inner">

              <div className="page-header">
                <h2>Session Details</h2>
                <button className="btn btn-primary btn-small"
                        onClick={() => exportSession(sessionDetail?.session_id)}>
                  Export CSV
                </button>
              </div>

              {/* Info strip */}
              <div className="session-info-strip">
                <div>
                  <div className="session-info-label">Session ID</div>
                  <div className="session-info-value">#{sessionDetail?.session_id}</div>
                </div>
                <div>
                  <div className="session-info-label">Date</div>
                  <div className="session-info-value">
                    {sessionDetail?.created_at
                      ? new Date(sessionDetail.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })
                      : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="session-info-label">Candidates</div>
                  <div className="session-info-value">{sessionDetail?.total_candidates}</div>
                </div>
              </div>

              {/* JD text */}
              {sessionDetail?.jd_text && (
                <div className="jd-block">
                  <div className="jd-block-title">Job Description</div>
                  <p className="jd-full-text">{sessionDetail.jd_text}</p>
                </div>
              )}

              {/* Candidate cards */}
              <div className="candidates-list">
                {sessionDetail?.results?.map((c, i) => (
                  <CandidateCard key={i} candidate={c} rank={i + 1} />
                ))}
              </div>

              <div className="session-detail-footer">
                <button className="btn btn-secondary" onClick={goToHistory}>Back to History</button>
                <button className="btn btn-primary"
                        onClick={() => exportSession(sessionDetail?.session_id)}>
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        );

      /* ──────────────────── HOME ──────────────────── */
      default:
        return (
          <>
            {/* Hero */}
            <header className="hero">
              <div className="hero-inner">
                <div className="hero-content">
                  <div className="hero-eyebrow">AI-Powered · TF-IDF + spaCy</div>
                  <h1 className="hero-title">
                    Resume Screening &amp;<br />
                    <span className="highlight">Candidate Ranking</span>
                  </h1>
                  <p className="hero-subtitle">
                    Upload a job description and candidate resumes. Our ML engine scores
                    each resume using semantic similarity and skill matching — ranked
                    results in seconds.
                  </p>
                  <div className="hero-buttons">
                    <button className="btn btn-primary btn-large" onClick={goToUpload}>
                      Start Screening
                    </button>
                    <button className="btn btn-secondary btn-large" onClick={goToHistory}>
                      View History
                    </button>
                  </div>
                  <div className="hero-stats">
                    <div className="hero-stat">
                      <span className="hero-stat-number">TF-IDF</span>
                      <span className="hero-stat-label">Vectorization</span>
                    </div>
                    <div className="hero-stat">
                      <span className="hero-stat-number">spaCy</span>
                      <span className="hero-stat-label">NLP Engine</span>
                    </div>
                    <div className="hero-stat">
                      <span className="hero-stat-number">CSV</span>
                      <span className="hero-stat-label">Export Ready</span>
                    </div>
                  </div>
                </div>

                <div className="hero-visual">
                  <div className="resume-preview">
                    <div className="resume-header-preview">
                      <div className="preview-avatar"></div>
                      <div className="preview-lines">
                        <div className="preview-line long"></div>
                        <div className="preview-line medium"></div>
                      </div>
                    </div>
                    <div className="preview-line full"></div>
                    <div className="preview-line full"></div>
                    <div className="preview-line short"></div>
                    <div className="score-badge">
                      <span className="score-number">87</span>
                      <span className="score-label">Match %</span>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {/* Features */}
            <section id="features" className="features">
              <div className="section-header">
                <span className="section-tag">Features</span>
                <h2 className="section-title">Everything you need to hire smarter</h2>
                <p className="section-subtitle">Purpose-built NLP pipeline that goes beyond keyword matching.</p>
              </div>
              <div className="features-grid">
                {[
                  {
                    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
                    title: 'Semantic Scoring',
                    desc:  'TF-IDF cosine similarity ranks candidates by how closely their experience matches the JD — not just keyword counts.',
                  },
                  {
                    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />,
                    title: 'Skill Detection',
                    desc:  'Automatically extracts and matches technical skills between the JD and each resume, with a weighted bonus score.',
                  },
                  {
                    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
                    title: 'PDF & DOCX Support',
                    desc:  'Upload resumes in any common format. PyMuPDF and python-docx handle text extraction automatically before scoring.',
                  },
                  {
                    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
                    title: 'CSV Export & History',
                    desc:  'Every session is saved to SQLite. Revisit any past ranking or download results as a CSV for your ATS.',
                  },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="feature-card">
                    <div className="feature-icon-wrap">
                      <svg width="20" height="20" fill="none" viewBox="0 0 24 24"
                           stroke="currentColor" strokeWidth="2">{icon}</svg>
                    </div>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="how-it-works">
              <div className="section-header">
                <span className="section-tag">Process</span>
                <h2 className="section-title">Three steps to ranked results</h2>
              </div>
              <div className="steps-container">
                <div className="step">
                  <div className="step-number">1</div>
                  <h3>Paste or Upload JD</h3>
                  <p>Enter the job description as text or upload a PDF / DOCX file directly.</p>
                </div>
                <div className="step-connector"></div>
                <div className="step">
                  <div className="step-number">2</div>
                  <h3>Upload Resumes</h3>
                  <p>Add candidate resumes. The pipeline lemmatizes and vectorizes every document.</p>
                </div>
                <div className="step-connector"></div>
                <div className="step">
                  <div className="step-number">3</div>
                  <h3>Review Rankings</h3>
                  <p>Candidates are ranked by final score. Export to CSV or revisit from history.</p>
                </div>
              </div>
            </section>

            {/* CTA */}
            <section className="cta-section">
              <div className="cta-content">
                <h2>Start screening candidates today</h2>
                <p>Upload your job description and resumes — get a ranked shortlist in under a minute.</p>
                <button className="btn btn-primary btn-large" onClick={goToUpload}>
                  Screen Resumes Now
                </button>
              </div>
            </section>
          </>
        );
    }
  };

  /* ════════════════════════════════════════════════════════
     SHELL
     ════════════════════════════════════════════════════════ */
  return (
    <div className="App">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-logo" onClick={goToHome}>
            <Logo size={30} showText={true} />
          </div>
          <ul className="nav-links">
            <li>
              <a href="#features"
                 onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>
                Features
              </a>
            </li>
            <li>
              <a href="#how-it-works"
                 onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>
                How It Works
              </a>
            </li>
            <li>
              <button className="nav-cta" onClick={goToUpload}>Upload Resumes</button>
            </li>
          </ul>
        </div>
      </nav>

      {/* Page */}
      <main className="main-content">{renderPage()}</main>

      {/* Footer */}
      <footer id="contact" className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <Logo size={26} showText={true} />
          </div>
          <p className="footer-text">
            AI-powered resume screening and candidate ranking system for smarter hiring decisions.
          </p>
          <div className="footer-links">
            <a href="#features"    onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a>
            <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>How It Works</a>
            <li><button className="footer-link-btn" onClick={goToHistory}>History</button></li>
          </div>
          <p className="copyright">© 2024 AI Resume Screener. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
