"""
Resume text extraction module.
Supports PDF (via PyMuPDF) and DOCX (via python-docx) files.
"""

from typing import Dict, Optional
import fitz  # PyMuPDF
from docx import Document


def extract_text_from_pdf(file_bytes: bytes) -> Dict:
    """
    Extract text from a PDF file using PyMuPDF (fitz).
    
    Args:
        file_bytes: Raw bytes of the PDF file
        
    Returns:
        Dictionary with keys:
        - text: Extracted text (empty string if extraction failed)
        - success: Boolean indicating if extraction was successful
        - error: Error message if extraction failed, None otherwise
    """
    try:
        # Open PDF from bytes
        pdf_document = fitz.open(stream=file_bytes, filetype="pdf")
        full_text = ""
        
        # Extract text from each page
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            text = page.get_text()
            full_text += text + "\n"
        
        pdf_document.close()
        
        # Check if any text was extracted
        if not full_text.strip():
            return {
                "text": "",
                "success": False,
                "error": "Scanned PDF - no text extractable"
            }
        
        return {
            "text": full_text.strip(),
            "success": True,
            "error": None
        }
        
    except Exception as e:
        return {
            "text": "",
            "success": False,
            "error": f"PDF extraction error: {str(e)}"
        }


def extract_text_from_docx(file_bytes: bytes) -> Dict:
    """
    Extract text from a DOCX file using python-docx.
    
    Args:
        file_bytes: Raw bytes of the DOCX file
        
    Returns:
        Dictionary with keys:
        - text: Extracted text (empty string if extraction failed)
        - success: Boolean indicating if extraction was successful
        - error: Error message if extraction failed, None otherwise
    """
    try:
        import io
        
        # Open DOCX from bytes
        doc = Document(io.BytesIO(file_bytes))
        
        # Extract text from all paragraphs
        paragraphs = []
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                paragraphs.append(paragraph.text.strip())
        
        full_text = "\n\n".join(paragraphs)
        
        # Check if any text was extracted
        if not full_text.strip():
            return {
                "text": "",
                "success": False,
                "error": "Empty DOCX - no text found"
            }
        
        return {
            "text": full_text.strip(),
            "success": True,
            "error": None
        }
        
    except Exception as e:
        return {
            "text": "",
            "success": False,
            "error": f"DOCX extraction error: {str(e)}"
        }


def extract_candidate_name(filename: str) -> str:
    """
    Extract candidate name from filename.
    Removes extension and replaces underscores/hyphens with spaces.

    Args:
        filename: Original filename (e.g., "john_doe_resume.pdf")

    Returns:
        Candidate name string (e.g., "John Doe Resume")
    """
    # Remove extension
    name = filename.lower()
    if name.endswith('.pdf'):
        name = name[:-4]
    elif name.endswith('.docx'):
        name = name[:-5]
    elif name.endswith('.doc'):
        name = name[:-4]
    elif name.endswith('.txt'):
        name = name[:-4]

    # Replace underscores and hyphens with spaces
    name = name.replace('_', ' ').replace('-', ' ')

    # Clean up extra whitespace and title case
    name = ' '.join(name.split())

    return name.title()


def extract_resume_text(filename: str, file_bytes: bytes) -> Dict:
    """
    Extract text from a resume file based on its extension.
    
    Args:
        filename: Name of the file (used to determine type and extract candidate name)
        file_bytes: Raw bytes of the file
        
    Returns:
        Dictionary with keys:
        - filename: Original filename
        - candidate_name: Extracted candidate name
        - text: Extracted text content
        - success: Boolean indicating if extraction was successful
        - error: Error message if extraction failed, None otherwise
    """
    # Determine file type and extract text
    filename_lower = filename.lower()

    if filename_lower.endswith('.pdf'):
        result = extract_text_from_pdf(file_bytes)
    elif filename_lower.endswith('.docx') or filename_lower.endswith('.doc'):
        result = extract_text_from_docx(file_bytes)
    elif filename_lower.endswith('.txt'):
        try:
            text = file_bytes.decode('utf-8')
            if text.strip():
                result = {"text": text.strip(), "success": True, "error": None}
            else:
                result = {"text": "", "success": False, "error": "Empty TXT file"}
        except Exception as e:
            result = {"text": "", "success": False, "error": f"TXT read error: {str(e)}"}
    else:
        return {
            "filename": filename,
            "candidate_name": extract_candidate_name(filename),
            "text": "",
            "success": False,
            "error": f"Unsupported file type: {filename}. Supported: PDF, DOCX, TXT"
        }
    
    # Add filename and candidate name to result
    result["filename"] = filename
    result["candidate_name"] = extract_candidate_name(filename)
    
    return result