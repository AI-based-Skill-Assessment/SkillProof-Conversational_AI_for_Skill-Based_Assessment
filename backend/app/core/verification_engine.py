# =============================================================================
# app/core/verification_engine.py
# Document Verification Engine — Phase 2 (Dynamic MCA21)
#
# Verifies certificates via a 4-strategy dynamic cascade:
#   Strategy 1: CIN extraction from OCR → MCA21 CIN API
#   Strategy 2: GSTIN extraction from OCR → GST portal API
#   Strategy 3: Dynamic MCA21 company-name search (NO hardcoded whitelist)
#   Strategy 4: Company website discovery + live-ping
#
# Results are cached in Redis for 24 hours.
# NO company is pre-coded — everything resolves dynamically.
# =============================================================================

import re
import json
import hashlib
from typing import Optional, Dict, Any, Tuple, List
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

# ── CIN (Company Identification Number) pattern ──────────────────────────────
# Format: L/U + 5 digits + 2 letters + 4 digits + 3 letters + 6 digits
_CIN_RE = re.compile(
    r'\b([LUu][0-9]{5}[A-Za-z]{2}[0-9]{4}[A-Za-z]{3}[0-9]{6})\b'
)

# ── GSTIN regex (Indian GST format) ──────────────────────────────────────────
# Format: 2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric
_GSTIN_RE = re.compile(
    r'\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b'
)

# ── URL / domain extraction pattern ──────────────────────────────────────────
_URL_RE = re.compile(r'(https?://[^\s\)\],;"]+|www\.[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}[^\s\)\],;"]*)')

# ── Known legitimate Indian IT/tech companies (heuristic whitelist) ──────────
_KNOWN_COMPANIES = {
    "savic technologies": "www.savictech.com",
    "codeclause": "www.codeclause.com",
    "naduvan technologies": "nadvantech.com",
    "tata consultancy services": "www.tcs.com",
    "infosys": "www.infosys.com",
    "wipro": "www.wipro.com",
    "hcl technologies": "www.hcltech.com",
    "tech mahindra": "www.techmahindra.com",
    "cognizant": "www.cognizant.com",
    "accenture": "www.accenture.com",
    "capgemini": "www.capgemini.com",
    "zoho": "www.zoho.com",
    "freshworks": "www.freshworks.com",
    "byju": "www.byjus.com",
    "flipkart": "www.flipkart.com",
    "amazon": "www.amazon.in",
    "google": "www.google.com",
    "microsoft": "www.microsoft.com",
    "ibm": "www.ibm.com",
    "oracle": "www.oracle.com",
}


# =============================================================================
# Helpers
# =============================================================================

def _sha256_key(identifier: str) -> str:
    """Compute a SHA-256 hex digest to use as a Redis cache key."""
    return hashlib.sha256(identifier.encode("utf-8")).hexdigest()


def _extract_visible_text(html: str) -> str:
    """Extract readable text from raw HTML."""
    if not BeautifulSoup:
        clean = re.sub(r"<[^>]+>", " ", html)
        clean = re.sub(r"\s+", " ", clean).strip()
        return clean
    soup = BeautifulSoup(html, "html.parser")
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

    for pattern in NOT_FOUND_PATTERNS:
        if pattern in text_lower:
            return "not_found", 0.9

    positive_hits = sum(1 for p in VERIFIED_PATTERNS if p in text_lower)

    if positive_hits > 0:
        name_found = False
        if candidate_name:
            name_parts = candidate_name.lower().split()
            name_found = any(part in text_lower for part in name_parts if len(part) > 2)

        if positive_hits >= 2:
            confidence = 0.95 if name_found else 0.85
            return "verified", confidence
        else:
            confidence = 0.80 if name_found else 0.70
            return "verified", confidence

    return "unverifiable", 0.5


def _compute_document_score(status: str, confidence: float) -> float:
    """
    Map (status, confidence) → document_score 0–100.
      verified      : 85–100
      mismatched    : 0–20
      not_found     : 25–40
      unverifiable  : 50
    """
    if status == "verified":
        return round(85.0 + (confidence * 15.0), 1)
    elif status == "mismatched":
        return round(confidence * 20.0, 1)
    elif status == "not_found":
        return round(25.0 + (confidence * 15.0), 1)
    else:
        return 50.0


# =============================================================================
# OCR Text Extractors
# =============================================================================

def _extract_cin_from_text(ocr_text: str) -> Optional[str]:
    """
    Extract the first CIN (Company Identification Number) found in OCR text.
    CIN format: L/U + 5 digits + 2 letters + 4 digits + 3 letters + 6 digits
    Example: U72200MH2014PTC255640
    """
    if not ocr_text:
        return None
    match = _CIN_RE.search(ocr_text.upper())
    return match.group(1) if match else None


def _extract_gstin_from_text(ocr_text: str) -> Optional[str]:
    """Extract the first GSTIN found in OCR text."""
    if not ocr_text:
        return None
    match = _GSTIN_RE.search(ocr_text.upper())
    return match.group(1) if match else None


def _extract_company_domains(ocr_text: str) -> List[str]:
    """
    Extract potential company website domains from OCR text.
    Returns a list of normalised domain strings (no trailing slashes/paths).
    """
    if not ocr_text:
        return []
    domains = []
    for match in _URL_RE.finditer(ocr_text):
        raw = match.group(1).strip()
        # Normalise to just the scheme + host
        raw = re.sub(r'^www\.', 'https://www.', raw) if raw.startswith('www.') else raw
        try:
            # Strip path/query so we only ping the root
            from urllib.parse import urlparse
            parsed = urlparse(raw if '://' in raw else f'https://{raw}')
            domain = f"{parsed.scheme}://{parsed.netloc}"
            if parsed.netloc and domain not in domains:
                domains.append(domain)
        except Exception:
            pass
    return domains


# =============================================================================
# Strategy 1: CIN Verification via MCA21
# =============================================================================

async def _verify_cin(cin: str) -> Optional[Dict[str, Any]]:
    """
    Verify a Company Identification Number (CIN) via MCA21 APIs.
    Tries multiple endpoints for resilience.
    Returns company info dict on success, None on failure.
    """
    cin_upper = cin.upper()

    # Endpoint 1: MCA21 v3 REST API (company master data)
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(
                f"https://api.mca.gov.in/api/v3/company/master/{cin_upper}",
                headers={
                    "User-Agent": "SkillProof/2.0",
                    "Accept": "application/json"
                }
            )
        if resp.status_code == 200:
            data = resp.json()
            if data:
                return data
    except Exception as e:
        print(f"[VerificationEngine] MCA21 CIN v3 API failed: {e}")

    # Endpoint 2: MCA21 efiling company search by CIN
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(
                "https://efiling.mca.gov.in/efiling/SearchCompany",
                params={"companyName": cin_upper, "searchType": "CIN"},
                headers={"User-Agent": "SkillProof/2.0", "Accept": "application/json"}
            )
        if resp.status_code == 200:
            try:
                data = resp.json()
                if isinstance(data, list) and data:
                    return data[0]
                elif isinstance(data, dict) and data:
                    return data
            except Exception:
                pass
    except Exception as e:
        print(f"[VerificationEngine] MCA21 CIN efiling API failed: {e}")

    # Endpoint 3: MCA Legacy portal
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(
                "https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do",
                params={"companyName": cin_upper},
                headers={"User-Agent": "SkillProof/2.0"}
            )
        if resp.status_code == 200 and len(resp.text) > 100:
            # Parse HTML response for company status
            text = _extract_visible_text(resp.text)
            if "active" in text.lower():
                return {"companyStatus": "Active", "source": "mca_legacy", "cin": cin_upper}
    except Exception as e:
        print(f"[VerificationEngine] MCA21 legacy CIN lookup failed: {e}")

    return None


# =============================================================================
# Strategy 2: GSTIN Verification via GST Portal
# =============================================================================

async def _verify_gstin(gstin: str) -> Optional[Dict[str, Any]]:
    """
    Verify a GSTIN via the public GST search API.
    Returns company info dict on success, None on failure.
    """
    gstin_upper = gstin.upper()

    # Endpoint 1: Official GST government API
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.gst.gov.in/commonapi/v1.1/search",
                params={"action": "TP", "gstin": gstin_upper},
                headers={"User-Agent": "SkillProof/2.0", "Accept": "application/json"}
            )
        if resp.status_code == 200:
            data = resp.json()
            sts = str(data.get("sts", "")).lower()
            if "active" in sts or data.get("lgnm"):
                return {
                    "lgnm": data.get("lgnm", ""),
                    "sts": data.get("sts", "Active"),
                    "gstin": gstin_upper,
                    "source": "gst_gov"
                }
    except Exception as e:
        print(f"[VerificationEngine] GST gov API failed: {e}")

    # Endpoint 2: GST Verification via mastergst.com public API
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"https://api.mastergst.com/taxpayers/{gstin_upper}",
                headers={"User-Agent": "SkillProof/2.0", "Accept": "application/json"}
            )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("lgnm") or data.get("tradeName"):
                return {
                    "lgnm": data.get("lgnm", data.get("tradeName", "")),
                    "sts": data.get("sts", "Active"),
                    "gstin": gstin_upper,
                    "source": "mastergst"
                }
    except Exception as e:
        print(f"[VerificationEngine] MasterGST API failed: {e}")

    # Endpoint 3: GST search via taxpayerapi
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"https://taxpayerapi.gst.gov.in/taxpayer/search",
                params={"gstin": gstin_upper},
                headers={"User-Agent": "SkillProof/2.0", "Accept": "application/json"}
            )
        if resp.status_code == 200:
            data = resp.json()
            if data:
                return data if isinstance(data, dict) else data[0]
    except Exception as e:
        print(f"[VerificationEngine] GST taxpayerapi failed: {e}")

    return None


# =============================================================================
# Strategy 3: Dynamic MCA21 Company-Name Search
# =============================================================================

async def _verify_company_mca21_dynamic(company_name: str) -> Optional[Dict[str, Any]]:
    """
    Dynamically search MCA21 for a company by name.
    No whitelist — works for ANY Indian-registered company.
    Returns company info dict if found Active, else None.
    """
    company_clean = company_name.strip()

    # Endpoint 1: MCA21 efiling SearchCompany (JSON)
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            resp = await client.get(
                "https://efiling.mca.gov.in/efiling/SearchCompany",
                params={"companyName": company_clean, "searchType": "CompanyName"},
                headers={
                    "User-Agent": "Mozilla/5.0 (SkillProof Certificate Verifier/2.0)",
                    "Accept": "application/json",
                    "Referer": "https://efiling.mca.gov.in/"
                }
            )
        if resp.status_code == 200:
            try:
                data = resp.json()
                companies = data if isinstance(data, list) else data.get("companyDetails", data.get("data", []))
                if companies:
                    # Find best match
                    for comp in companies[:5]:
                        name_in_resp = str(comp.get("companyName", comp.get("COMPANY_NAME", ""))).lower()
                        search_words = [w for w in company_clean.lower().split() if len(w) > 3]
                        if any(w in name_in_resp for w in search_words):
                            mca_status = str(comp.get("companyStatus", comp.get("STATUS", ""))).lower()
                            return {
                                "companyName": comp.get("companyName", comp.get("COMPANY_NAME", company_clean)),
                                "companyStatus": comp.get("companyStatus", comp.get("STATUS", "Active")),
                                "cin": comp.get("cin", comp.get("CIN", "")),
                                "source": "mca21_efiling",
                                "active": "active" in mca_status or mca_status == ""
                            }
            except Exception:
                pass
    except Exception as e:
        print(f"[VerificationEngine] MCA21 efiling SearchCompany failed: {e}")

    # Endpoint 2: MCA21 legacy portal
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            resp = await client.get(
                "https://www.mca.gov.in/mcafoportal/getCompanyDetails.do",
                params={"companyName": company_clean},
                headers={
                    "User-Agent": "Mozilla/5.0 (SkillProof Certificate Verifier/2.0)",
                    "Accept": "application/json"
                }
            )
        if resp.status_code == 200:
            try:
                data = resp.json()
                companies = data.get("companyDetails", []) or data.get("data", [])
                if companies:
                    comp = companies[0]
                    mca_status = str(comp.get("companyStatus", "")).lower()
                    return {
                        "companyName": comp.get("companyName", company_clean),
                        "companyStatus": comp.get("companyStatus", "Active"),
                        "cin": comp.get("cin", ""),
                        "source": "mca21_legacy",
                        "active": "active" in mca_status
                    }
            except Exception:
                pass
    except Exception as e:
        print(f"[VerificationEngine] MCA21 legacy company lookup failed: {e}")

    # Endpoint 3: MCA API v3 company search
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            resp = await client.get(
                "https://api.mca.gov.in/api/v3/company/search",
                params={"companyName": company_clean, "status": "ACTIVE"},
                headers={
                    "User-Agent": "SkillProof/2.0",
                    "Accept": "application/json"
                }
            )
        if resp.status_code == 200:
            try:
                data = resp.json()
                results = data.get("data", data.get("results", data if isinstance(data, list) else []))
                if results:
                    comp = results[0]
                    return {
                        "companyName": comp.get("company_name", company_clean),
                        "companyStatus": comp.get("company_status", "Active"),
                        "cin": comp.get("cin", ""),
                        "source": "mca_api_v3",
                        "active": True
                    }
            except Exception:
                pass
    except Exception as e:
        print(f"[VerificationEngine] MCA API v3 company search failed: {e}")

    return None


# =============================================================================
# Web Search Fallback (DuckDuckGo search-based CIN/GSTIN extraction)
# =============================================================================

async def _verify_company_via_search(company_name: str) -> Optional[Dict[str, Any]]:
    """
    Search DuckDuckGo HTML for the company name + registry indicators.
    Returns dynamic verification details if matching registry records are found.
    """
    import urllib.parse
    company_clean = company_name.strip()
    query = f"{company_clean} zaubacorp tofler mca registration"
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                return None
                
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            registry_domains = ["zaubacorp.com", "tofler.in", "indiafilings.com", "mca.gov.in", "mca21"]
            matched_registry = None
            matched_title = ""
            matched_link = ""
            matched_snippet = ""
            
            for result_div in soup.find_all('div', class_='result'):
                # Title
                title_div = result_div.find('a', class_='result__a') or result_div.find('a', class_='result__title')
                title_text = title_div.get_text(strip=True) if title_div else ""
                
                # Link
                link_text = ""
                if title_div:
                    href = title_div.get('href', '')
                    if "/l/?" in href:
                        parsed_href = urllib.parse.urlparse(href)
                        params = urllib.parse.parse_qs(parsed_href.query)
                        if "uddg" in params:
                            link_text = params["uddg"][0]
                    else:
                        link_text = href
                
                # Snippet
                snippet_div = result_div.find('a', class_='result__snippet')
                snippet_text = snippet_div.get_text(strip=True) if snippet_div else ""
                
                # Check if this result is from a registered corporate directory
                link_lower = link_text.lower()
                for dom in registry_domains:
                    if dom in link_lower:
                        matched_registry = dom
                        matched_title = title_text
                        matched_link = link_text
                        matched_snippet = snippet_text
                        break
                
                if matched_registry:
                    break
                    
            if matched_registry:
                # Extract CIN/GSTIN if present in search result
                cin = _extract_cin_from_text(matched_snippet) or _extract_cin_from_text(matched_title) or ""
                gstin = _extract_gstin_from_text(matched_snippet) or _extract_gstin_from_text(matched_title) or ""
                
                info_parts = []
                if cin:
                    info_parts.append(f"CIN: {cin}")
                if gstin:
                    info_parts.append(f"GSTIN: {gstin}")
                info_str = " | ".join(info_parts) if info_parts else "Registered Entity"
                
                return {
                    "companyName": company_clean,
                    "companyStatus": "Active",
                    "cin": cin,
                    "gstin": gstin,
                    "registry_hit": True,
                    "registry_domain": matched_registry,
                    "source": f"search_{matched_registry.split('.')[0]}",
                    "active": True,
                    "snippet": f"Web Search Verification ({matched_registry}): '{matched_title}'. Found {info_str}. Snippet: {matched_snippet}"
                }
                
    except Exception as e:
        print(f"[VerificationEngine] Search-based company verification failed: {e}")
        
    return None


async def _search_company_cin_gstin(company_name: str) -> Optional[Dict[str, Any]]:
    """
    Public wrapper around _verify_company_via_search.
    Searches DuckDuckGo for '{company_name} CIN number registration' and
    '{company_name} GSTIN', parses search-result titles/snippets with
    _CIN_RE / _GSTIN_RE, and returns a dict with keys:
      cin, gstin, registry_hit, registry_domain, source, snippet
    Returns None if no relevant result is found or network is unavailable.
    """
    import urllib.parse

    company_clean = company_name.strip()

    queries = [
        f'"{company_clean}" CIN number registration site:zaubacorp.com OR site:tofler.in OR site:mca.gov.in',
        f'"{company_clean}" GSTIN site:zaubacorp.com OR site:tofler.in OR site:indiafilings.com',
    ]

    cin_found       = ""
    gstin_found     = ""
    registry_domain = ""
    best_snippet    = ""
    best_title      = ""

    registry_domains = ["zaubacorp.com", "tofler.in", "indiafilings.com", "mca.gov.in", "mca21"]

    for query in queries:
        url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/115.0.0.0 Safari/537.36"
            )
        }
        try:
            async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                continue

            if BeautifulSoup:
                soup = BeautifulSoup(resp.text, "html.parser")
                for result_div in soup.find_all("div", class_="result"):
                    title_div   = result_div.find("a", class_="result__a") or result_div.find("a", class_="result__title")
                    snippet_div = result_div.find("a", class_="result__snippet")
                    title_text   = title_div.get_text(strip=True)   if title_div   else ""
                    snippet_text = snippet_div.get_text(strip=True) if snippet_div else ""

                    link_text = ""
                    if title_div:
                        href = title_div.get("href", "")
                        if "/l/?" in href:
                            parsed_href = urllib.parse.urlparse(href)
                            params = urllib.parse.parse_qs(parsed_href.query)
                            if "uddg" in params:
                                link_text = params["uddg"][0]
                        else:
                            link_text = href

                    link_lower = link_text.lower()
                    for dom in registry_domains:
                        if dom in link_lower:
                            registry_domain = dom
                            best_title   = title_text
                            best_snippet = snippet_text
                            break

                    combined = f"{title_text} {snippet_text}"
                    c = _extract_cin_from_text(combined)
                    g = _extract_gstin_from_text(combined)
                    if c:
                        cin_found = c
                    if g:
                        gstin_found = g

                    if registry_domain and (cin_found or gstin_found):
                        break
            else:
                combined = resp.text
                c = _extract_cin_from_text(combined)
                g = _extract_gstin_from_text(combined)
                if c:
                    cin_found = c
                if g:
                    gstin_found = g

        except Exception as e:
            print(f"[VerificationEngine] _search_company_cin_gstin query failed: {e}")
            continue

        if registry_domain or cin_found or gstin_found:
            break

    if not (registry_domain or cin_found or gstin_found):
        return None

    return {
        "companyName":     company_clean,
        "cin":             cin_found,
        "gstin":           gstin_found,
        "registry_hit":    bool(registry_domain),
        "registry_domain": registry_domain,
        "source":          f"ddg_search_{registry_domain.split('.')[0] if registry_domain else 'direct'}",
        "title":           best_title,
        "snippet":         best_snippet,
    }




# =============================================================================
# Strategy 4: Website Discovery + Live Ping
# =============================================================================

async def _verify_company_website(base_url: str, company_name: Optional[str] = None) -> Tuple[bool, str]:
    """
    Ping the company website to confirm it is live.
    Optionally checks that the company name appears in the page content.
    Returns (is_live, snippet).
    """
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(
                base_url,
                headers={"User-Agent": "Mozilla/5.0 (SkillProof Certificate Verifier/2.0)"}
            )

        if resp.status_code >= 400:
            return False, ""

        text = _extract_visible_text(resp.text)
        snippet = text[:300] if text else ""

        # Check if company name appears on homepage
        if company_name:
            name_words = [w for w in company_name.lower().split() if len(w) > 3]
            name_on_page = any(w in text.lower() for w in name_words)
            return True, f"Website live. Company name {'found' if name_on_page else 'not explicitly found'} on homepage. {snippet}"

        return True, f"Website is live and responding. {snippet}"

    except Exception as e:
        print(f"[VerificationEngine] Website ping failed for {base_url}: {e}")
        return False, ""


# =============================================================================
# URL-based Verification (unchanged from Phase 1)
# =============================================================================

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
                "User-Agent": "Mozilla/5.0 (SkillProof Certificate Verifier/2.0)"
            })

        if response.status_code != 200:
            status = "unverifiable"
            confidence = 0.5
        else:
            html = response.text
            text = _extract_visible_text(html)
            snippet = text[:300] if text else ""

            if len(text) < 200:
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

    if redis:
        await redis.setex(cache_key, 86400, json.dumps(result))

async def _verify_company_via_falconebiz(company_name: str) -> Optional[Dict[str, Any]]:
    """
    Search Falconebiz API for the company name and scrape its details.
    Returns dynamic verification details if matching records are found active.
    """
    company_clean = company_name.strip()
    search_url = "https://www.falconebiz.com/company/models/search-company.php"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest"
    }
    data = {
        "search": company_clean,
        "ser_len": str(len(company_clean))
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.post(search_url, data=data, headers=headers)
            results = resp.json() if resp.status_code == 200 else []
            
            if not results:
                words = company_clean.split()
                if len(words) > 2:
                    short_search = " ".join(words[:2])
                    data["search"] = short_search
                    data["ser_len"] = str(len(short_search))
                    resp = await client.post(search_url, data=data, headers=headers)
                    results = resp.json() if resp.status_code == 200 else []
            
            if not results or not isinstance(results, list):
                return None
                
            best_match = None
            for item in results:
                label_lower = item.get("label", "").lower()
                words_clean = [w.lower() for w in company_clean.split() if len(w) > 3]
                if any(w in label_lower for w in words_clean):
                    best_match = item
                    break
            
            if not best_match:
                best_match = results[0]
                
            path = best_match.get("path")
            cin = best_match.get("value")
            label = best_match.get("label")
            
            if not path or not cin:
                return None
                
            page_url = f"https://www.falconebiz.com/{path.lstrip('/')}"
            resp = await client.get(page_url, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200:
                if BeautifulSoup:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    for s in soup(["script", "style"]):
                        s.decompose()
                    text_lower = soup.get_text(separator=" ", strip=True).lower()
                else:
                    text_lower = resp.text.lower()
                    
                is_active = "is active" in text_lower or "company status active" in text_lower
                status_str = "Active" if is_active else "Inactive"
                if not is_active and ("struck off" in text_lower or "dissolved" in text_lower):
                    status_str = "Struck off/Dissolved"
                    
                snippet_text = f"Falconebiz Registry Lookup: Verified '{label}' | CIN: {cin} | Status: {status_str}."
                
                return {
                    "companyName": label,
                    "companyStatus": status_str,
                    "cin": cin,
                    "gstin": "",
                    "source": "falconebiz_registry",
                    "active": is_active,
                    "snippet": snippet_text
                }
    except Exception as e:
        print(f"[VerificationEngine] Falconebiz verification failed: {e}")
        
    return None


# =============================================================================
# Main Company Verification — 4-Strategy Dynamic Cascade
# =============================================================================

async def verify_company_mca21(
    company_name: str,
    redis=None,
    raw_ocr_text: str = ""
) -> Dict[str, Any]:
    """
    Multi-strategy DYNAMIC company verification cascade.
    
    Cascade:
      Strategy 1 (CIN): Extract CIN from OCR text → MCA21 CIN lookup
      Strategy 2 (GSTIN): Extract GSTIN from OCR text → GST portal verification
      Strategy 3 (Falconebiz Scraping): Search Falconebiz and verify company status
      Strategy 4 (Web Search Fallback): Search DDG for CIN/GSTIN and registry records (ZaubaCorp/Tofler)
      Strategy 5 (Dynamic MCA21 Name Lookup): Legacy name searches
      Strategy 6 (Website Discovery + Ping): Discover website in OCR and ping
    """
    cache_key = f"verify:{_sha256_key(company_name.lower().strip())}"

    if redis:
        cached = await redis.get(cache_key)
        if cached:
            print(f"[VerificationEngine] Cache hit for company: {company_name}")
            return json.loads(cached)

    status     = "unverifiable"
    confidence = 0.5
    snippet    = ""
    path       = "mca21"
    cin        = None
    gstin      = None

    # ── STRATEGY 1: CIN extraction + MCA21 CIN API ───────────────────────────
    cin = _extract_cin_from_text(raw_ocr_text)
    if cin:
        print(f"[VerificationEngine] Found CIN '{cin}' in OCR text. Verifying via MCA21...")
        cin_data = await _verify_cin(cin)
        if cin_data:
            cin_status = str(
                cin_data.get("companyStatus", cin_data.get("company_status", ""))
            ).lower()
            company_nm = str(
                cin_data.get("companyName", cin_data.get("company_name", company_name))
            )
            is_active = "active" in cin_status or cin_data.get("active", False)
            if is_active or not cin_status:
                status     = "verified"
                confidence = 0.97
                snippet    = (
                    f"CIN Verified via MCA21: {company_nm} | CIN: {cin} | "
                    f"Status: {cin_data.get('companyStatus', 'Active')} | "
                    f"Source: {cin_data.get('source', 'mca21')}"
                )
                path = "mca21_cin"
                print(f"[VerificationEngine] CIN verified: {snippet}")
            elif "strike" in cin_status or "dissolved" in cin_status:
                status     = "not_found"
                confidence = 0.90
                snippet    = f"MCA21 CIN Lookup: {company_nm} | Status: {cin_data.get('companyStatus', '')} (Not Active)"
                path = "mca21_cin"

    # ── STRATEGY 2: GSTIN extraction + GST portal verification ───────────────
    if status not in ("verified",):
        gstin = _extract_gstin_from_text(raw_ocr_text)
        if gstin:
            print(f"[VerificationEngine] Found GSTIN '{gstin}' in OCR text. Verifying via GST portal...")
            gst_data = await _verify_gstin(gstin)
            if gst_data:
                gst_status = str(gst_data.get("sts", "")).lower()
                legal_name = str(gst_data.get("lgnm", "") or gst_data.get("tradeName", ""))
                is_active  = "active" in gst_status or legal_name
                if is_active:
                    status     = "verified"
                    confidence = 0.94
                    snippet    = (
                        f"GST Verified: {legal_name or company_name} | "
                        f"GSTIN: {gstin} | Status: Active | "
                        f"Source: {gst_data.get('source', 'gst_portal')}"
                    )
                    path = "gst_portal"
                    print(f"[VerificationEngine] GST verified: {snippet}")

    # ── STRATEGY 3: Falconebiz Registry Scraping Strategy ───────────────────
    if status not in ("verified",):
        print(f"[VerificationEngine] Verifying via Falconebiz registry for '{company_name}'...")
        falcon_data = await _verify_company_via_falconebiz(company_name)
        if falcon_data:
            is_active = falcon_data.get("active", False)
            if is_active:
                status     = "verified"
                confidence = 0.95
                snippet    = falcon_data["snippet"]
                path       = falcon_data["source"]
                print(f"[VerificationEngine] Falconebiz registry verified: {snippet}")
            else:
                status     = "not_found"
                confidence = 0.88
                snippet    = falcon_data["snippet"]
                path       = falcon_data["source"]
                print(f"[VerificationEngine] Falconebiz registry showed inactive/struck-off: {snippet}")


    # ── STRATEGY 4: Dynamic Web Search Fallback (SearchDDG for CIN/GSTIN) ─────
    if status not in ("verified",):
        print(f"[VerificationEngine] Performing dynamic search-based verification for '{company_name}'...")
        search_data = await _verify_company_via_search(company_name)
        if search_data:
            status     = "verified"
            confidence = 0.88
            snippet    = search_data["snippet"]
            path       = search_data["source"]
            print(f"[VerificationEngine] Web search verification succeeded: {snippet}")

    # ── STRATEGY 5: Dynamic MCA21 company-name search ────────────────────────
    if status not in ("verified",):
        print(f"[VerificationEngine] Searching MCA21 dynamically for '{company_name}'...")
        mca_data = await _verify_company_mca21_dynamic(company_name)
        if mca_data:
            mca_status = str(mca_data.get("companyStatus", "")).lower()
            is_active  = "active" in mca_status or mca_data.get("active", False)
            if is_active:
                status     = "verified"
                confidence = 0.90
                snippet    = (
                    f"MCA21 Name Search: {mca_data.get('companyName', company_name)} | "
                    f"Status: {mca_data.get('companyStatus', 'Active')} | "
                    f"CIN: {mca_data.get('cin', 'N/A')} | "
                    f"Source: {mca_data.get('source', 'mca21')}"
                )
                path = mca_data.get("source", "mca21")
                print(f"[VerificationEngine] MCA21 dynamic search verified: {snippet}")
            elif "strike" in mca_status or "dissolved" in mca_status:
                status     = "not_found"
                confidence = 0.85
                snippet    = (
                    f"MCA21: {mca_data.get('companyName', company_name)} | "
                    f"Status: {mca_data.get('companyStatus', '')} (Struck off/Dissolved)"
                )
                path = mca_data.get("source", "mca21")

    # ── STRATEGY 6: Website discovery + live-ping ─────────────────────────────
    domains = _extract_company_domains(raw_ocr_text)
    if domains:
        print(f"[VerificationEngine] Found {len(domains)} domain(s) in OCR. Pinging: {domains}")
        for domain_url in domains[:3]:  # Try up to 3 domains
            is_live, site_snippet = await _verify_company_website(domain_url, company_name)
            if is_live:
                if status == "verified":
                    confidence = min(confidence + 0.03, 1.0)
                    snippet += f" | Website Confirmed: {domain_url}"
                else:
                    status     = "verified"
                    confidence = 0.72
                    snippet    = (
                        f"Website Verification: {domain_url} is live and active. "
                        f"Company '{company_name}' website confirmed reachable. "
                        f"MCA21 API lookup inconclusive. {site_snippet[:100]}"
                    )
                    path = "website_ping"
                    print(f"[VerificationEngine] Website verification succeeded: {domain_url}")
                break

    # ── Final fallback: unverifiable ─────────────────────────────────────────
    if status == "unverifiable":
        print(
            f"[VerificationEngine] All strategies inconclusive for '{company_name}'. "
            f"CIN={cin if cin else 'N/A'}, GSTIN={gstin if gstin else 'N/A'}, "
            f"Domains={domains}"
        )
        snippet = (
            f"Unable to dynamically verify '{company_name}' via CIN, GSTIN, MCA21 name search, "
            f"or website ping. The company may not be registered on MCA21 portal, "
            f"or OCR text did not contain a CIN/GSTIN identifier."
        )

    doc_score = _compute_document_score(status, confidence)

    result = {
        "verification_path": path,
        "fetch_status": status,
        "fetched_content_snippet": snippet[:500] if snippet else None,
        "document_score": doc_score,
        "confidence": confidence,
        "checked_at": datetime.utcnow().isoformat(),
        "strategies_tried": {
            "cin_found": bool(cin),
            "gstin_found": bool(gstin),
            "domains_found": domains
        }
    }

    if redis:
        await redis.setex(cache_key, 86400, json.dumps(result))

    return result


# =============================================================================
# Main Entry Point
# =============================================================================

async def run_verification(
    verify_url_str: Optional[str],
    company_name: Optional[str],
    candidate_name: Optional[str] = None,
    raw_ocr_text: str = "",
    redis=None
) -> Dict[str, Any]:
    """
    Main entry point. Runs URL verification first, then company cascade.
    Returns a result dict always (never raises).
    """
    if verify_url_str:
        return await verify_url(verify_url_str, candidate_name, redis)

    if company_name:
        return await verify_company_mca21(company_name, redis, raw_ocr_text=raw_ocr_text)

    # Neither URL nor company name available
    return {
        "verification_path": "none",
        "fetch_status": "unverifiable",
        "fetched_content_snippet": None,
        "document_score": 50.0,
        "confidence": 0.5,
        "checked_at": datetime.utcnow().isoformat()
    }
