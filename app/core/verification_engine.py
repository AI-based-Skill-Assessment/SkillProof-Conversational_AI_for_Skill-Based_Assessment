# =============================================================================
# app/core/verification_engine.py
# Document Verification Engine — Phase 1
# Verifies certificates via URL fetch + HTML parsing, or MCA21 company lookup.
# Results are cached in Redis for 24 hours.
# =============================================================================

import re
import json
import hashlib
from typing import Optional, Dict, Any, Tuple
from datetime import datetime

import httpx

try:
    from bs4 import BeautifulSoup
except Exception:
    BeautifulSoup = None

# ── Positive confirmation language patterns ──────────────────────────────────
VERIFIED_PATTERNS = [
    "certificate is valid",
    "successfully completed",
    "awarded to",
    "is authentic",
    "verified",
    "this certificate confirms",
    "has been issued",
    "this certifies",
    "conferred upon",
    "in recognition of",
]

# ── Negative / not-found language patterns ───────────────────────────────────
NOT_FOUND_PATTERNS = [
    "not found",
    "invalid certificate",
    "does not exist",
    "certificate expired",
    "no record found",
    "invalid credential",
    "cannot be verified",
    "has been revoked",
]


def _sha256_key(identifier: str) -> str:
    """Compute a SHA-256 hex digest to use as a cache key."""
    return hashlib.sha256(identifier.encode("utf-8")).hexdigest()


def _extract_visible_text(html: str) -> str:
    """Extract readable text from raw HTML."""
    if not BeautifulSoup:
        # Fallback: strip HTML tags with regex
        clean = re.sub(r"<[^>]+>", " ", html)
        clean = re.sub(r"\s+", " ", clean).strip()
        return clean

    soup = BeautifulSoup(html, "html.parser")
    # Remove script and style tags
    for tag in soup(["script", "style", "noscript", "head"]):
        tag.decompose()
    return soup.get_text(separator=" ", strip=True)


def _classify_text(
    text: str,
    candidate_name: Optional[str] = None
) -> Tuple[str, float]:
    """
    Classify page text into one of four statuses.
    Returns (status, confidence 0.0–1.0).
    """
    text_lower = text.lower()

    # Check for not_found signals first
    for pattern in NOT_FOUND_PATTERNS:
        if pattern in text_lower:
            return "not_found", 0.9

    # Check for positive signals
    positive_hits = sum(1 for p in VERIFIED_PATTERNS if p in text_lower)

    if positive_hits > 0:
        # If a candidate name is provided, try to match it on the page
        name_found = False
        if candidate_name:
            # Check if first name or last name appears
            name_parts = candidate_name.lower().split()
            name_found = any(part in text_lower for part in name_parts if len(part) > 2)

        if positive_hits >= 2:
            confidence = 0.95 if name_found else 0.85
            return "verified", confidence
        else:
            confidence = 0.80 if name_found else 0.70
            return "verified", confidence

    # No clear signal
    return "unverifiable", 0.5


def _compute_document_score(status: str, confidence: float) -> float:
    """
    Map (status, confidence) → document_score 0–100.
    verified      : 85–100
    mismatched    : 0–20   (strongest fraud signal)
    not_found     : 25–40
    unverifiable  : 50     (neutral)
    """
    if status == "verified":
        return round(85.0 + (confidence * 15.0), 1)       # 85.0 – 100.0
    elif status == "mismatched":
        return round(confidence * 20.0, 1)                  # 0.0  – 20.0
    elif status == "not_found":
        return round(25.0 + (confidence * 15.0), 1)         # 25.0 – 40.0
    else:  # unverifiable
        return 50.0


async def _playwright_fallback(url: str, candidate_name: Optional[str] = None) -> Tuple[str, float]:
    """
    Playwright JS-rendered page fallback for SPA/dynamic content.
    Returns (status, confidence). Never raises.
    """
    try:
        from playwright.async_api import async_playwright  # type: ignore
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(url, timeout=20000, wait_until="networkidle")
            html = await page.content()
            await browser.close()

        text = _extract_visible_text(html)
        if len(text) < 50:
            return "unverifiable", 0.5

        return _classify_text(text, candidate_name)
    except Exception as e:
        print(f"[VerificationEngine] Playwright fallback failed: {e}")
        return "unverifiable", 0.5


async def verify_url(
    verify_url_str: str,
    candidate_name: Optional[str] = None,
    redis=None
) -> Dict[str, Any]:
    """
    STEP 1: Verify a certificate via URL fetching and HTML parsing.
    Checks Redis cache first. Falls back to Playwright for JS-heavy pages.
    """
    cache_key = f"verify:{_sha256_key(verify_url_str)}"

    # Check cache
    if redis:
        cached = await redis.get(cache_key)
        if cached:
            print(f"[VerificationEngine] Cache hit for URL: {verify_url_str[:50]}")
            return json.loads(cached)

    status = "unverifiable"
    confidence = 0.5
    snippet = ""

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(verify_url_str, headers={
                "User-Agent": "Mozilla/5.0 (SkillProof Certificate Verifier/1.0)"
            })

        if response.status_code != 200:
            status = "unverifiable"
            confidence = 0.5
        else:
            html = response.text
            text = _extract_visible_text(html)
            snippet = text[:300] if text else ""

            if len(text) < 200:
                # Very little visible content — likely JS-rendered, try Playwright
                print(f"[VerificationEngine] Sparse page content ({len(text)} chars). Trying Playwright...")
                status, confidence = await _playwright_fallback(verify_url_str, candidate_name)
            else:
                status, confidence = _classify_text(text, candidate_name)

    except httpx.TimeoutException:
        print(f"[VerificationEngine] Timeout fetching URL: {verify_url_str[:60]}")
        status, confidence = "unverifiable", 0.5
    except Exception as e:
        print(f"[VerificationEngine] HTTP fetch failed: {e}")
        status, confidence = "unverifiable", 0.5

    doc_score = _compute_document_score(status, confidence)

    result = {
        "verification_path": "url_fetch",
        "fetch_status": status,
        "fetched_content_snippet": snippet[:300] if snippet else None,
        "document_score": doc_score,
        "confidence": confidence,
        "checked_at": datetime.utcnow().isoformat()
    }

    # Cache for 24 hours
    if redis:
        await redis.setex(cache_key, 86400, json.dumps(result))

    return result


async def verify_company_mca21(
    company_name: str,
    redis=None
) -> Dict[str, Any]:
    """
    STEP 2: Verify a company via MCA21 public API lookup.
    Returns a structured result in the same format as verify_url.
    """
    cache_key = f"verify:{_sha256_key(company_name.lower().strip())}"

    if redis:
        cached = await redis.get(cache_key)
        if cached:
            print(f"[VerificationEngine] Cache hit for company: {company_name}")
            return json.loads(cached)

    status = "unverifiable"
    confidence = 0.5
    snippet = ""

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://www.mca.gov.in/mcafoportal/getCompanyDetails.do",
                params={"companyName": company_name},
                headers={
                    "Accept": "application/json",
                    "User-Agent": "SkillProof/1.0"
                }
            )

        if response.status_code == 200:
            try:
                data = response.json()
                companies = data.get("companyDetails", []) or data.get("data", [])

                if companies:
                    company = companies[0]
                    mca_status = company.get("companyStatus", "").lower()
                    snippet = f"MCA21: {company.get('companyName', '')} — Status: {company.get('companyStatus', '')}"

                    if "active" in mca_status:
                        status, confidence = "verified", 0.90
                    elif "strike" in mca_status or "dissolved" in mca_status:
                        status, confidence = "not_found", 0.85
                    else:
                        status, confidence = "not_found", 0.70
                else:
                    status, confidence = "not_found", 0.80
            except Exception:
                status, confidence = "unverifiable", 0.5
        else:
            status, confidence = "unverifiable", 0.5

    except Exception as e:
        print(f"[VerificationEngine] MCA21 API request failed: {e}")
        status, confidence = "unverifiable", 0.5

    doc_score = _compute_document_score(status, confidence)

    result = {
        "verification_path": "mca21",
        "fetch_status": status,
        "fetched_content_snippet": snippet or None,
        "document_score": doc_score,
        "confidence": confidence,
        "checked_at": datetime.utcnow().isoformat()
    }

    if redis:
        await redis.setex(cache_key, 86400, json.dumps(result))

    return result


async def run_verification(
    verify_url_str: Optional[str],
    company_name: Optional[str],
    candidate_name: Optional[str] = None,
    redis=None
) -> Dict[str, Any]:
    """
    Main entry point. Runs STEP 1 → STEP 2 → STEP 3 fallback.
    Returns a result dict always (never raises).
    """
    if verify_url_str:
        return await verify_url(verify_url_str, candidate_name, redis)

    if company_name:
        return await verify_company_mca21(company_name, redis)

    # STEP 3: Neither available
    return {
        "verification_path": "none",
        "fetch_status": "unverifiable",
        "fetched_content_snippet": None,
        "document_score": 50.0,
        "confidence": 0.5,
        "checked_at": datetime.utcnow().isoformat()
    }
