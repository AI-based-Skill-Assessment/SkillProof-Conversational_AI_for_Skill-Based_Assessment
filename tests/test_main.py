import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Test health check endpoint."""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

@pytest.mark.asyncio
async def test_get_verification_session_not_found(client: AsyncClient):
    """Test that a non-existing session returns 404."""
    random_uuid = str(uuid4())
    
    with patch("app.repositories.session_repo.get_session", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = None
        
        response = await client.get(f"/api/v1/verify/{random_uuid}")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_get_verification_session_success(client: AsyncClient):
    """Test retrieving an active verification session successfully."""
    session_id = uuid4()
    
    from app.models.session import IntakeMode, SessionStatus
    from datetime import datetime

    # Mock return model structures
    mock_session = MagicMock()
    mock_session.id = session_id
    mock_session.intake_mode = IntakeMode.certificate
    mock_session.candidate_name = "Jane Doe"
    mock_session.candidate_email = "jane@example.com"
    mock_session.certificate_filename = "cert.pdf"
    mock_session.raw_ocr_text = "Some raw text"
    mock_session.extracted_company = "SAVIC"
    mock_session.extracted_role = "AI Developer"
    mock_session.extracted_skills = ["React"]
    mock_session.extracted_verify_url = "http://example.com"
    mock_session.status = SessionStatus.interviewing
    mock_session.created_at = datetime.utcnow()
    mock_session.updated_at = datetime.utcnow()
    mock_session.document = None
    mock_session.interview = None
    mock_session.scores = []

    with patch("app.repositories.session_repo.get_session", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_session
        
        response = await client.get(f"/api/v1/verify/{session_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["candidate_name"] == "Jane Doe"
        assert data["status"] == "interviewing"

@pytest.mark.asyncio
async def test_get_scorecard_success(client: AsyncClient):
    """Test retrieving calculated scorecard verdicts."""
    session_id = uuid4()
    mock_report = {
        "session_id": str(session_id),
        "candidate_name": "Jane Doe",
        "candidate_email": "jane@example.com",
        "session_status": "completed",
        "verdict": "FULLY_VERIFIED",
        "explanation": "Valid certificate and strong technical answers.",
        "metrics": {
            "document_verified": True,
            "issuer_name": "Coursera",
            "issuer_tier": "Tier 1",
            "average_skill_score": 8.5
        },
        "detailed_scores": []
    }

    with patch("app.services.report_service.ReportService.generate_verdict", new_callable=AsyncMock) as mock_report_service:
        mock_report_service.return_value = mock_report
        
        response = await client.get(f"/api/v1/score/{session_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["verdict"] == "FULLY_VERIFIED"
        assert data["metrics"]["average_skill_score"] == 8.5

@pytest.mark.asyncio
async def test_ingest_endpoint_validation_error(client: AsyncClient):
    """Test file upload validation checks (e.g. invalid file extension)."""
    files = {"file": ("test.exe", b"executable content", "application/octet-stream")}
    data = {
        "candidate_name": "Jane Doe",
        "candidate_email": "jane@example.com"
    }
    
    response = await client.post("/api/v1/ingest", data=data, files=files)
    assert response.status_code == 400
    assert "unsupported file format" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_ingest_duplicate_email_error(client: AsyncClient):
    """Test that ingesting a session for a candidate email that already exists triggers HTTP 400."""
    data = {
        "candidate_name": "Jane Doe",
        "candidate_email": "jane@example.com",
        "skill_text": "Python, SQL",
        "role": "Data Engineer"
    }

    # Mock get_session_by_email to return an existing session
    mock_existing_session = MagicMock()
    with patch("app.repositories.session_repo.get_session_by_email", new_callable=AsyncMock) as mock_get_email:
        mock_get_email.return_value = mock_existing_session
        
        response = await client.post("/api/v1/ingest", data=data)
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()


