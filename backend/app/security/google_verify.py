from google.oauth2 import id_token
from google.auth.transport import requests
from app.config import settings

def verify_google_token(token: str) -> dict:
    """
    Verifies a Google OAuth ID Token (JWT).
    Returns the parsed user profile dictionary if valid, otherwise raises ValueError.
    For development, if GOOGLE_CLIENT_ID is not configured, we allow decoding
    without validation (or mock extraction) if a fallback string is parsed.
    """
    # 1. Fallback / Mock mode for local testing if GOOGLE_CLIENT_ID is empty
    if not settings.GOOGLE_CLIENT_ID:
        if token.startswith("mock_google_"):
            parts = token.split("_")
            email = parts[2] if len(parts) > 2 else "candidate@example.com"
            name = parts[3].replace("-", " ") if len(parts) > 3 else "Google Candidate"
            return {
                "email": email,
                "name": name,
                "picture": "https://lh3.googleusercontent.com/a/default-user=s96-c",
                "email_verified": True
            }
        raise ValueError("Google Client ID is not configured on the backend. Provide GOOGLE_CLIENT_ID in .env.")

    # 2. Real verification using google-auth library
    try:
        idinfo = id_token.verify_oauth2_token(token, requests.Request(), settings.GOOGLE_CLIENT_ID)
        
        if idinfo["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Wrong issuer.")

        return idinfo
    except Exception as e:
        raise ValueError(f"Invalid Google Token: {str(e)}")
