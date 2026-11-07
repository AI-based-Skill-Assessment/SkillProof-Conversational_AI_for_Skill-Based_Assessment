# pyrefly: ignore [missing-import]
from google.oauth2 import id_token
# pyrefly: ignore [missing-import]
from google.auth.transport import requests
from app.config import settings

def verify_google_token(token: str, allow_mock: bool = True) -> dict:
    """
    Verifies a Google OAuth ID Token (JWT).
    Returns the parsed user profile dictionary if valid, otherwise raises ValueError.

    Mock tokens ("mock_google_...") are accepted ONLY when all of these hold:
      - no real GOOGLE_CLIENT_ID is configured
      - APP_ENV is not "production"
      - ALLOW_MOCK_GOOGLE_LOGIN is true
      - the caller passes allow_mock=True (the admin portal passes False)
    """
    client_id = settings.GOOGLE_CLIENT_ID.strip()

    if token.startswith("mock_google_") and not (allow_mock and settings.ALLOW_MOCK_GOOGLE_LOGIN):
        raise ValueError("Mock Google sign-in is not allowed here.")

    # 1. Fallback / Mock mode for local testing if GOOGLE_CLIENT_ID is unset
    # or still contains the example placeholder, AND we are NOT in production.
    if (not client_id or client_id == "your_google_client_id_here") and settings.APP_ENV != "production":
        if token.startswith("mock_google_"):
            payload = token[len("mock_google_"):]
            _, profile = payload.split("_", 1) if "_" in payload else (payload, "")
            email, name = profile.split("_", 1) if "_" in profile else (profile, "")
            email = email or "candidate@example.com"
            name = name.replace("-", " ") or "Google Candidate"
            return {
                "email": email,
                "name": name,
                "picture": "https://lh3.googleusercontent.com/a/default-user=s96-c",
                "email_verified": True
            }
        raise ValueError("Google Client ID is not configured on the backend. Provide GOOGLE_CLIENT_ID in .env.")
    elif (not client_id or client_id == "your_google_client_id_here") and settings.APP_ENV == "production":
        raise ValueError("CRITICAL CONFIGURATION ERROR: GOOGLE_CLIENT_ID is missing in production environment.")

    # 2. Real verification using google-auth library
    try:
        idinfo = id_token.verify_oauth2_token(token, requests.Request(), client_id)
        
        if idinfo["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Wrong issuer.")

        return idinfo
    except Exception as e:
        raise ValueError(f"Invalid Google Token: {str(e)}")
