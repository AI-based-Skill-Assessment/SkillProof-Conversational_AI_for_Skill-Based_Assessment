import io
import re
import os
import json
from datetime import date
from uuid import UUID
from typing import List, Dict, Any, Tuple
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from PIL import Image

# Import database/repository dependencies
from app.database import get_redis
from app.core.skills_vocab import extract_skills_from_text, normalize_skill
from app.repositories import session_repo, document_repo
from app.schemas.session import VerificationSessionUpdate
from app.schemas.document import DocumentVerificationResultCreate
from app.core.verification_engine import run_verification

# Optional third-party libraries for OCR & QR decoding
try:
    import fitz  # PyMuPDF
except Exception as e:
    print(f"[Ingestion OCR] PyMuPDF (fitz) not available or failed to load: {e}")
    fitz = None

try:
    import pytesseract
    # Configure common Tesseract OCR path on Windows
    TESSERACT_PATHS = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expanduser(r"~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe")
    ]
    for path in TESSERACT_PATHS:
        if os.path.exists(path):
            pytesseract.pytesseract.tesseract_cmd = path
            break
except Exception as e:
    print(f"[Ingestion OCR] pytesseract not available or failed to load: {e}")
    pytesseract = None

try:
    from pdf2image import convert_from_bytes
except Exception as e:
    print(f"[Ingestion OCR] pdf2image not available or failed to load: {e}")
    convert_from_bytes = None

try:
    from pyzbar.pyzbar import decode as decode_qr
except Exception as e:
    print(f"[Ingestion OCR] pyzbar not available or failed to load (usually missing zbar system DLLs): {e}")
    decode_qr = None

try:
    import cv2
    import numpy as np
except Exception as e:
    print(f"[Ingestion OCR] opencv-python not available or failed to load: {e}")
    cv2 = None
    np = None


class IngestionService:
    async def ingest_certificate(
        self, 
        db: AsyncSession, 
        session_id: UUID, 
        file: UploadFile
    ) -> dict:
        """
        PATH A: Process uploaded certificate.
        Extract text via PyMuPDF/Tesseract, find QR codes, parse metadata (company, role, skills, URL),
        populate DB and Redis caching.
        """
        # 1. Update session status to verifying (which maps to ocr_done or verified in DB)
        await session_repo.update_session_status(db, session_id, "verifying")

        # Read file bytes
        file_bytes = await file.read()
        filename = file.filename or "certificate.pdf"
        file_ext = filename.split(".")[-1].lower()

        # 2. Extract raw text & decode QR code
        raw_text = ""
        qr_url = ""

        if file_ext == "pdf":
            raw_text = self._extract_text_from_pdf(file_bytes)
            # Try decoding QR code from rasterized first page
            first_page_image = self._rasterize_pdf_first_page(file_bytes)
            if first_page_image:
                qr_url = self._decode_qr_from_image(first_page_image)
        elif file_ext in ["jpg", "jpeg", "png"]:
            raw_text = self._extract_text_from_image(file_bytes)
            try:
                pil_img = Image.open(io.BytesIO(file_bytes))
                qr_url = self._decode_qr_from_image(pil_img)
            except Exception as e:
                print(f"[Ingestion OCR] PIL Image QR decode failed: {e}")
        else:
            # Fallback to plain text read for demo/txt files
            try:
                raw_text = file_bytes.decode("utf-8", errors="ignore")
            except Exception:
                raw_text = ""

        # 3. Use heuristics/regex to extract metadata from OCR text
        company = self._extract_company(raw_text)
        role = self._extract_role(raw_text)
        skills = extract_skills_from_text(raw_text)
        verify_url = qr_url or self._extract_url(raw_text)

        # 3b. If primary regex failed, run fallback company extractors
        if not company:
            company = self._extract_company_fallback(raw_text)

        # company_for_verify: the best name we have to verify against MCA21
        # This is always non-None if we got ANY company signal from OCR.
        company_for_verify = company if company else None

        # 4. Save metadata to VerificationSession
        update_data = VerificationSessionUpdate(
            extracted_company=company or "Unknown Company",
            extracted_role=role or "Candidate",
            extracted_skills=skills,
            extracted_verify_url=verify_url or None,
            raw_ocr_text=raw_text
        )
        await session_repo.update_session_metadata(db, session_id, update_data)

        # 5. Run Verification Engine immediately to see if we can verify the company or URL
        session_obj = await session_repo.get_session(db, session_id)
        candidate_name = session_obj.candidate_name if session_obj else None
        
        try:
            redis = get_redis()
        except Exception:
            redis = None

        result = await run_verification(
            verify_url_str=verify_url or None,
            company_name=company_for_verify,  # always use extracted name, not None fallback
            candidate_name=candidate_name,
            raw_ocr_text=raw_text,
            redis=redis
        )

        verification_path = result["verification_path"]
        fetch_status = result["fetch_status"]
        doc_score = result["document_score"]

        # Create Document Verification Result entry
        doc_in = DocumentVerificationResultCreate(
            session_id=session_id,
            verification_path=verification_path,
            fetch_status=fetch_status,
            fetched_content_snippet=result.get("fetched_content_snippet") or (raw_text[:200] if raw_text else None),
            document_score=doc_score
        )
        await document_repo.create_document_result(db, doc_in)

        # 6. Cache details in Redis for the interview router
        cache_data = {
            "session_id": str(session_id),
            "detected_skills": skills,
            "verification_url": verify_url,
            "company": company,
            "role": role,
            "is_valid": fetch_status == "verified"
        }
        if redis:
            await redis.setex(f"session:{session_id}:metadata", 3600, json.dumps(cache_data))

        # 7. Update status to verified or ocr_done
        next_status = "verified" if fetch_status == "verified" else "ocr_done"
        await session_repo.update_session_status(db, session_id, next_status)

        return {
            "session_id": session_id,
            "extracted_company": company,
            "extracted_role": role,
            "extracted_skills": skills,
            "extracted_verify_url": verify_url,
            "status": next_status
        }

    async def ingest_skill_only(
        self, 
        db: AsyncSession, 
        session_id: UUID, 
        skill_text: str,
        role: str
    ) -> dict:
        """
        PATH B: Process skill-only input declarations.
        Normalize raw input string against vocabulary.
        """
        # Extract and normalize skills
        skills = extract_skills_from_text(skill_text)
        
        # Save state to session
        update_data = VerificationSessionUpdate(
            extracted_company="Self-Declared",
            extracted_role=role or "Software Developer",
            extracted_skills=skills,
            extracted_verify_url=None,
            raw_ocr_text=skill_text,
            status="ocr_done"
        )
        await session_repo.update_session_metadata(db, session_id, update_data)

        # Create blank DocumentVerificationResult (no cert)
        doc_in = DocumentVerificationResultCreate(
            session_id=session_id,
            verification_path="none",
            fetch_status="unverifiable",
            fetched_content_snippet=f"Self-declared skills: {skill_text}",
            document_score=0.0
        )
        await document_repo.create_document_result(db, doc_in)

        # Cache details in Redis
        try:
            redis = get_redis()
        except Exception:
            redis = None

        if redis:
            cache_data = {
                "session_id": str(session_id),
                "detected_skills": skills,
                "verification_url": None,
                "company": "Self-Declared",
                "role": role,
                "is_valid": False
            }
            await redis.setex(f"session:{session_id}:metadata", 3600, json.dumps(cache_data))

        return {
            "session_id": session_id,
            "extracted_company": "Self-Declared",
            "extracted_role": role,
            "extracted_skills": skills,
            "extracted_verify_url": None,
            "status": "ocr_done"
        }

    # ── OCR & Parsing Helpers ─────────────────────────────────────────

    def _extract_text_from_pdf(self, pdf_bytes: bytes) -> str:
        """Extract text from PDF via PyMuPDF (fitz), with Tesseract OCR fallback."""
        text = ""
        if fitz:
            try:
                doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                for page in doc:
                    text += page.get_text()
                doc.close()
            except Exception as e:
                print(f"[Ingestion OCR] PyMuPDF extraction failed: {e}")

        # Fallback to Tesseract OCR if text is less than 50 characters (e.g. scanned PDF)
        if len(text.strip()) < 50:
            print("[Ingestion OCR] Text < 50 chars. Falling back to Tesseract OCR via pdf2image...")
            text = self._ocr_pdf_via_tesseract(pdf_bytes)

        return text

    def _ocr_pdf_via_tesseract(self, pdf_bytes: bytes) -> str:
        """Rasterize PDF pages to 300 DPI and run Tesseract OCR."""
        if not convert_from_bytes or not pytesseract:
            print("[Ingestion OCR] Fallback aborted: pdf2image or pytesseract not installed.")
            return ""
        
        text = ""
        try:
            # Convert PDF pages to PIL images at 300 DPI
            images = convert_from_bytes(pdf_bytes, dpi=300)
            for i, img in enumerate(images):
                page_text = pytesseract.image_to_string(img)
                text += page_text + "\n"
        except Exception as e:
            print(f"[Ingestion OCR] Tesseract OCR on PDF failed: {e}")
            
        return text

    def _extract_text_from_image(self, image_bytes: bytes) -> str:
        """Extract text directly from an image using Tesseract."""
        if not pytesseract:
            print("[Ingestion OCR] pytesseract not installed. Cannot run image OCR.")
            return ""
        try:
            img = Image.open(io.BytesIO(image_bytes))
            return pytesseract.image_to_string(img)
        except Exception as e:
            print(f"[Ingestion OCR] Image OCR failed: {e}")
            return ""

    def _rasterize_pdf_first_page(self, pdf_bytes: bytes) -> Image.Image | None:
        """Rasterize the first page of a PDF for QR code scanning."""
        if not convert_from_bytes:
            return None
        try:
            images = convert_from_bytes(pdf_bytes, dpi=300, first_page=1, last_page=1)
            if images:
                return images[0]
        except Exception as e:
            print(f"[Ingestion OCR] PDF rasterization for QR failed: {e}")
        return None

    def _decode_qr_from_image(self, pil_img: Image.Image) -> str:
        """Scans a PIL Image to decode any QR code URL."""
        if not decode_qr:
            print("[Ingestion QR] pyzbar not installed. Cannot decode QR code.")
            return ""
        try:
            decoded_objs = decode_qr(pil_img)
            for obj in decoded_objs:
                if obj.data:
                    url = obj.data.decode("utf-8").strip()
                    if url.startswith(("http://", "https://")):
                        print(f"[Ingestion QR] Detected QR URL: {url}")
                        return url
        except Exception as e:
            print(f"[Ingestion QR] QR decoding failed: {e}")
        return ""

    def _extract_company_fallback(self, text: str) -> str:
        """
        Fallback company extractor used when the primary regex fails.
        Tries three sub-strategies in order:
          1. Scan for any line containing a Pvt Ltd / Limited / LLP suffix.
          2. Scan for keyword phrases: 'with <Anything> Pvt', 'at <Anything> Pvt'.
          3. Look for the company name printed as a standalone header (ALL-CAPS or title-case line).
        """
        if not text:
            return ""

        # Sub-strategy 1: any line ending with Pvt Ltd / Limited / LLP suffix
        suffix_line_re = re.compile(
            r'^\s*([A-Z][A-Za-z0-9\s&\.\-]+?(?:Pvt\.?\s*Ltd\.?|Private\s+Limited|Ltd\.?|Limited|LLP|Inc\.?))\s*$',
            re.MULTILINE
        )
        for m in suffix_line_re.finditer(text):
            val = m.group(1).strip()
            if 3 < len(val) < 80:
                return val

        # Sub-strategy 2: flexible 'with|at COMPANY Pvt|Ltd' anywhere
        flex_re = re.compile(
            r'(?:with|at)\s+([A-Z][A-Za-z0-9\s&\.\-]{2,60}?(?:Pvt\.?\s*Ltd\.?|Private\s+Limited|Ltd\.?|Limited|LLP))'
            r'(?=[\s\.,\n]|$)',
            re.IGNORECASE
        )
        m = flex_re.search(text)
        if m:
            val = m.group(1).strip()
            if len(val) > 3:
                return val

        # Sub-strategy 3: Title-case or ALL-CAPS standalone line (likely company letterhead)
        # Looks for short lines (5-60 chars) that are all caps or title-case with no verb words
        skip_words = {"to", "whom", "it", "may", "concern", "date", "dear", "sir", "madam",
                      "this", "letter", "certify", "certificate", "internship", "regards"}
        for line in text.splitlines():
            line = line.strip()
            if 5 < len(line) < 70:
                words = line.split()
                if not words:
                    continue
                lower_words = {w.lower() for w in words}
                if lower_words & skip_words:
                    continue
                # Must look like a company name: starts with capital, no lowercase-only words
                if all(w[0].isupper() for w in words if w.isalpha()):
                    # Has a company-like word
                    company_words = {"technologies", "tech", "solutions", "services", "systems",
                                     "pvt", "ltd", "limited", "llp", "inc", "corp", "labs",
                                     "codeclause", "software", "consulting", "group", "ventures"}
                    if lower_words & company_words:
                        cleaned_line = re.sub(r'^(?:CEO|Director|HR|Manager|Founder|President|Secretary|Sincerely|Regards)\b\s*[\s,:\-]*', '', line, flags=re.IGNORECASE)
                        return cleaned_line.strip()

        return ""

    def _extract_company(self, text: str) -> str:
        """Regex to find company names. Fully dynamic — no hardcoded company names."""
        if not text:
            return ""

        # Ordered from most-specific to least-specific.
        # Each pattern captures the company name in the LAST group.
        patterns = [
            # "internship program with Sudaku CodeClause Pvt Ltd" (CodeClause format)
            r"internship\s+program\s+with\s+([A-Za-z0-9\s,\.&'\-]+?(?:Pvt\.?\s*Ltd\.?|Private\s+Limited|Ltd\.?|Limited|LLP|Inc\.?|Corp\.?))",
            # "internship at [Company Pvt Ltd]"
            r"internship\s+at\s+([A-Za-z0-9\s,\.&'\-]+?(?:Pvt\.?\s*Ltd\.?|Private\s+Limited|Ltd\.?|Limited|LLP|Inc\.?|Corp\.?))",
            # "completed internship at [Company]"
            r"completed\s+internship\s+at\s+([A-Za-z0-9\s,\.&'\-]+?)(?=\s+from|\s+on|\s+during|\.|,|$)",
            # "internship in [Role] at [Company]"
            r"internship\s+in\s+[A-Za-z0-9\s\-\/]+?\s+at\s+([A-Za-z0-9\s,\.&'\-]+?)(?=\s+from|\.|,|$)",
            # "certify that ... has done ... at [Company]"
            r"certify\s+that\s+.{0,100}?\s+at\s+([A-Za-z0-9\s,\.&'\-]+?(?:Pvt\.?\s*Ltd\.?|Private\s+Limited|Ltd\.?|Limited|LLP))(?=\s+from|\.|,|$)",
            # "has successfully completed his internship ... with [Company]"
            r"internship\s+(?:program\s+)?with\s+([A-Za-z0-9\s,\.&'\-]+?)(?=\.|,|\n|$)",
            # Generic: "at [Company Pvt Ltd]" anywhere in text
            r"\bat\s+([A-Za-z][A-Za-z0-9\s,\.&'\-]+?(?:Pvt\.?\s*Ltd\.?|Private\s+Limited|Ltd\.?|Limited|LLP))(?=\s|\.|,|$)",
        ]

        for pat in patterns:
            match = re.search(pat, text, re.IGNORECASE | re.DOTALL)
            if match:
                val = match.groups()[-1].strip()
                val = re.sub(r"\s+", " ", val)
                # Reject overly short or clearly wrong captures
                if len(val) > 3 and val.lower() not in ("the", "his", "her", "a", "an"):
                    cleaned_val = re.sub(r'^(?:CEO|Director|HR|Manager|Founder|President|Secretary|Sincerely|Regards)\b\s*[\s,:\-]*', '', val, flags=re.IGNORECASE)
                    return cleaned_val.strip()

        # Last resort: look for lines in the OCR that contain common company suffixes
        suffix_re = re.compile(
            r'^([A-Z][A-Za-z0-9\s&\.\-]+?(?:Pvt\.?\s*Ltd\.?|Private\s+Limited|Ltd\.?|Limited|LLP|Inc\.?))',
            re.MULTILINE
        )
        found = suffix_re.findall(text)
        if found:
            return found[0].strip()

        return ""

    def _extract_role(self, text: str) -> str:
        """Regex to find role/designation."""
        if not text:
            return ""
        # Patterns: "internship in [Role]", "as a [Role]", "Frontend Development of..."
        patterns = [
            r"internship\s+in\s+([A-Za-z0-9\s\-\/]+?)\s+at",
            r"as\s+a\s+([A-Za-z0-9\s\-\/]+?)(?=\s+at|\s+in|\.|,)",
            r"involved\s+in\s+all\s+the\s+([A-Za-z0-9\s\-\/]+?)(?=\s+of|\s+at|\.|,)"
        ]
        
        for pat in patterns:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                val = match.group(1).strip()
                val = re.sub(r"\s+", " ", val)
                return val
                
        if "frontend development" in text.lower():
            return "Frontend Developer"
        if "ai development" in text.lower():
            return "AI Developer"
        return ""

    def _extract_url(self, text: str) -> str:
        """Regex helper to extract URLs from text block."""
        urls = re.findall(r'(https?://[^\s\)\],;\"]+)', text)
        return urls[0].strip() if urls else ""
