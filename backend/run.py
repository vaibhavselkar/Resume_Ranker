"""
Startup script for the Resume Screening API.
Run this script from the backend directory to start the server.
"""

import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Backend running at http://localhost:{port}")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )