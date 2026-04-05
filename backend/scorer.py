"""
ML Scoring Engine for Resume Screening System.
Uses TF-IDF vectorization and cosine similarity for ranking candidates.
"""

import re
from typing import List
import spacy
import nltk
from nltk.corpus import stopwords
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Download NLTK stopwords
nltk.download("stopwords", quiet=True)

# Load spaCy language model
nlp = spacy.load("en_core_web_sm")


def preprocess_text(text: str) -> str:
    """
    Preprocess text by lowercasing, removing special characters,
    removing stopwords, and lemmatizing.
    
    Args:
        text: Raw text to preprocess
        
    Returns:
        Cleaned and lemmatized text
    """
    text = text.lower()
    text = re.sub(r"[^a-z\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    
    stop_words = set(stopwords.words("english"))
    custom_stopwords = {
        "experience", "work", "worked", "working",
        "year", "years", "company", "team", "good",
        "strong", "knowledge", "ability", "looking",
        "join", "responsible", "using", "use", "used",
        "university", "college", "education", "degree",
        "bachelor", "btech", "bba", "mtech"
    }
    stop_words = stop_words.union(custom_stopwords)
    words = [w for w in text.split() if w not in stop_words]
    
    doc = nlp(" ".join(words))
    lemmatized = [t.lemma_ for t in doc 
                  if not t.is_space and len(t.text) > 1]
    return " ".join(lemmatized)


def calculate_skill_bonus(resume_text: str, 
                          jd_text: str):
    """
    Calculate skill bonus based on matched skills between resume and JD.
    
    Args:
        resume_text: Raw resume text
        jd_text: Raw job description text
        
    Returns:
        Tuple of (bonus_score, list_of_matched_skills)
    """
    skill_keywords = [
        "python", "machine learning", "scikit-learn",
        "pandas", "nlp", "natural language processing",
        "tfidf", "tf-idf", "text processing",
        "matplotlib", "sql", "data visualization",
        "model evaluation", "deep learning"
    ]
    resume_lower = resume_text.lower()
    jd_lower     = jd_text.lower()
    jd_skills    = [s for s in skill_keywords if s in jd_lower]
    
    if not jd_skills:
        return 0.0, []
    
    matched = [s for s in jd_skills if s in resume_lower]
    bonus   = (len(matched) / len(jd_skills)) * 0.3
    return round(bonus, 4), matched


def rank_candidates(jd_text: str,
                    resumes: List[dict]) -> List[dict]:
    """
    Main function called by FastAPI backend.
    
    Args:
        jd_text: Raw job description text
        resumes: List of dicts with keys: filename, candidate_name, text
        
    Returns:
        List of dicts ranked by final_score, each with:
        filename, candidate_name, final_score, 
        score_percent, matched_skills, rank, similarity, skill_bonus
    """
    cleaned_jd      = preprocess_text(jd_text)
    cleaned_resumes = [preprocess_text(r["text"]) 
                       for r in resumes]
    
    all_docs    = [cleaned_jd] + cleaned_resumes
    vectorizer  = TfidfVectorizer(ngram_range=(1, 2), 
                                  min_df=1, 
                                  max_features=500)
    tfidf_matrix = vectorizer.fit_transform(all_docs)
    
    jd_vector = tfidf_matrix[0]
    results   = []
    
    for i, resume in enumerate(resumes):
        resume_vector = tfidf_matrix[i + 1]
        sim_score     = cosine_similarity(
                            jd_vector, resume_vector)[0][0]
        bonus, matched = calculate_skill_bonus(
                            resume["text"], jd_text)
        
        final_score = round((0.6 * sim_score) + 
                             (0.4 * bonus), 4)
        
        results.append({
            "filename"      : resume["filename"],
            "candidate_name": resume.get("candidate_name", resume["filename"]),
            "final_score"   : final_score,
            "score_percent" : round(final_score * 100, 1),
            "matched_skills": matched,
            "matched_count" : len(matched),
            "similarity"    : round(sim_score, 4),
            "skill_bonus"   : bonus
        })
    
    results_sorted = sorted(results, 
                            key=lambda x: x["final_score"], 
                            reverse=True)
    for rank, r in enumerate(results_sorted, start=1):
        r["rank"] = rank
    
    return results_sorted