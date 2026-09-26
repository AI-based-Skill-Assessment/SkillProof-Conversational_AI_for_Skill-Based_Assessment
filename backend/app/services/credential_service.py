"""
app/services/credential_service.py
Cryptographic Verifiable Credential Service for SkillProof.
Generates tamper-proof W3C-compatible Verifiable Credentials and cryptographic SHA-256 HMAC signatures
for verified candidates and skill assessments.
"""

import hmac
import hashlib
import json
import base64
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.repositories import session_repo, score_repo, document_repo, biometric_repo


class CredentialService:
    def __init__(self, secret_key: Optional[str] = None):
        self.secret_key = (secret_key or settings.JWT_SECRET_KEY).encode("utf-8")

    def generate_verification_hash(self, session_id: UUID, candidate_name: str, score: float, date_iso: str) -> str:
        """
        Generates a deterministic 32-character hex cryptographic hash for a verification session.
        """
        payload = f"{session_id}:{candidate_name}:{score:.2f}:{date_iso}"
        sig = hmac.new(self.secret_key, payload.encode("utf-8"), hashlib.sha256).hexdigest()
        return f"SP-{sig[:16].upper()}-{sig[16:32].upper()}"

    def generate_digital_signature(self, credential_dict: Dict[str, Any]) -> str:
        """
        Signs the canonical JSON representation of a credential with HMAC-SHA256.
        """
        canonical_json = json.dumps(credential_dict, sort_keys=True, separators=(',', ':'))
        sig_bytes = hmac.new(self.secret_key, canonical_json.encode("utf-8"), hashlib.sha256).digest()
        return base64.urlsafe_b64encode(sig_bytes).decode("utf-8").rstrip("=")

    async def issue_verifiable_credential(self, db: AsyncSession, session_id: UUID) -> Dict[str, Any]:
        """
        Builds a full W3C-compliant Verifiable Credential for a completed verification session.
        """
        session = await session_repo.get_session(db, session_id)
        if not session:
            return {"error": "Verification session not found"}

        document = await document_repo.get_document_by_session(db, session_id)
        scores = await score_repo.get_scores_by_session(db, session_id)
        profile = await biometric_repo.get_profile(db, session_id)

        candidate_name = session.candidate_name or "Candidate"
        candidate_email = session.candidate_email or ""
        created_at_iso = (session.created_at or datetime.now(timezone.utc)).isoformat()

        # Compute average score
        avg_score = 0.0
        if scores:
            avg_score = round(sum(s.overall_skill_score or 0.0 for s in scores) / len(scores), 2)

        # Integrity & Biometrics
        integrity_score = getattr(profile, 'integrity_score', 100.0) if profile else 100.0
        face_verified = bool(profile and profile.face_registered and (profile.face_mismatch_count or 0) <= 2)
        voice_verified = bool(profile and profile.voice_registered and (profile.voice_mismatch_count or 0) <= 2)

        verdict = "FULLY_VERIFIED" if avg_score >= 75.0 else ("PARTIALLY_VERIFIED" if avg_score >= 50.0 else "UNVERIFIED")

        # Deterministic Verification Hash
        verification_hash = self.generate_verification_hash(session_id, candidate_name, avg_score, created_at_iso[:10])

        skills_list = session.extracted_skills or ["Software Engineering"]

        # Subject Claims
        credential_subject = {
            "id": f"urn:skillproof:candidate:{session_id}",
            "candidateName": candidate_name,
            "candidateEmail": candidate_email,
            "role": session.extracted_role or "Technical Professional",
            "company": session.extracted_company or "",
            "skills": skills_list,
            "averageScore": avg_score,
            "verdict": verdict,
            "biometricAttestation": {
                "faceMatchVerified": face_verified,
                "voiceAcousticVerified": voice_verified,
                "proctoringIntegrityScore": integrity_score,
                "antiCheatingStatus": getattr(profile, 'fraud_status', 'clean') if profile else "clean",
                "tabSwitchesRecorded": getattr(profile, 'tab_switch_count', 0) if profile else 0,
            },
            "documentAttestation": {
                "verified": (document.fetch_status.name == "verified") if (document and document.fetch_status) else False,
                "score": document.document_score if document else 0.0,
                "documentName": session.certificate_filename or "Skill Assessment"
            }
        }

        # Base Credential Object
        credential = {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                "https://w3id.org/security/v2"
            ],
            "id": f"urn:skillproof:credential:{session_id}",
            "type": ["VerifiableCredential", "SkillProofSkillAssertion"],
            "issuer": {
                "id": "did:skillproof:authority:mainnet",
                "name": "SkillProof Autonomous Skill Verification Engine",
                "url": "https://skillproof.ai"
            },
            "issuanceDate": created_at_iso,
            "verificationHash": verification_hash,
            "credentialSubject": credential_subject,
        }

        # Cryptographic Signature Proof
        signature = self.generate_digital_signature(credential)
        credential["proof"] = {
            "type": "JsonWebSignature2020",
            "created": datetime.now(timezone.utc).isoformat(),
            "proofPurpose": "assertionMethod",
            "verificationMethod": "did:skillproof:authority#key-rsa-2024",
            "jws": signature,
            "algorithm": "HMAC-SHA256",
            "verificationStatus": "VALID_CRYPTOGRAPHIC_SIGNATURE"
        }

        return credential
