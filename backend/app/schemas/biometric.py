"""
app/schemas/biometric.py
Pydantic schemas for all biometric API endpoints.
"""

from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Register
# ─────────────────────────────────────────────────────────────────────────────

from typing import List, Optional, Any

class BiometricRegisterRequest(BaseModel):
    session_id:      Optional[UUID] = None
    face_image:      Optional[str] = None
    face_embedding:  Optional[Any] = None
    voice_embedding: Optional[Any] = None


class BiometricStatusResponse(BaseModel):
    session_id:              UUID
    face_registered:         bool
    voice_registered:        bool
    fully_registered:        bool
    face_duplicate_detected: bool
    voice_duplicate_detected: bool
    fraud_flags:             int
    fraud_status:            str
    interview_flagged:       bool
    flag_reasons:            List[str] = []

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────────────────────────────────────
# Duplicate Check
# ─────────────────────────────────────────────────────────────────────────────

class BiometricDuplicateCheckRequest(BaseModel):
    """Check if a face or voice embedding already belongs to another session."""
    session_id:      Optional[UUID] = None
    face_image:      Optional[str] = None
    face_embedding:  Optional[Any] = None
    voice_embedding: Optional[Any] = None


class BiometricDuplicateCheckResponse(BaseModel):
    session_id:            UUID
    face_is_duplicate:     bool
    voice_is_duplicate:    bool
    any_duplicate:         bool
    face_match_distance:   Optional[float] = None   # lower = more similar
    voice_match_similarity: Optional[float] = None  # higher = more similar
    message:               str


# ─────────────────────────────────────────────────────────────────────────────
# Live Verify (registration-time / manual)
# ─────────────────────────────────────────────────────────────────────────────

class BiometricVerifyRequest(BaseModel):
    session_id:      Optional[UUID] = None
    face_embedding:  Optional[Any] = None
    face_image:      Optional[str] = None
    voice_embedding: Optional[Any] = None


class BiometricVerifyResponse(BaseModel):
    session_id:      Optional[UUID] = None
    face_match:      bool
    voice_match:     bool
    face_confidence: float
    voice_confidence: float
    flagged:         bool
    fraud_flags:     int
    fraud_status:    str
    message:         str


# ─────────────────────────────────────────────────────────────────────────────
# Interview Real-Time Verification
# ─────────────────────────────────────────────────────────────────────────────

class InterviewVerifyRequest(BaseModel):
    """
    Sent every N seconds during the live interview.
    Contains the live face descriptor and optional voice embedding
    extracted from the candidate's answer audio.
    """
    session_id:      UUID
    face_embedding:  Optional[List[float]] = None
    voice_embedding: Optional[List[float]] = None


class InterviewVerifyResponse(BaseModel):
    session_id:          UUID
    face_match:          bool
    voice_match:         bool
    face_confidence:     float
    voice_confidence:    float
    face_mismatch_count: int
    voice_mismatch_count: int
    interview_flagged:   bool
    fraud_status:        str
    fraud_flags:         int
    alert_level:         str   # "ok" | "warn" | "flag"
    message:             str
    face_detected:       Optional[bool] = True
    multi_face_detected: Optional[bool] = False
    gaze_direction:      Optional[str] = "center"
    specific_flags:      List[str] = []
    integrity_score:     Optional[float] = 100.0
    tab_switch_count:    Optional[int] = 0
    window_blur_count:   Optional[int] = 0


# ─────────────────────────────────────────────────────────────────────────────
# Violation Report
# ─────────────────────────────────────────────────────────────────────────────

class ViolationReportRequest(BaseModel):
    """
    Sent from the frontend when a gaze or camera violation is detected.
    violation_type: "gaze" | "camera" | "tab_switch" | "window_blur" | "copy_paste" | "secondary_speaker"
    """
    session_id:     UUID
    violation_type: str
    details:        Optional[str] = None


class ViolationReportResponse(BaseModel):
    session_id:          UUID
    gaze_violations:     int
    camera_interruptions: int
    fraud_flags:         int
    interview_flagged:   bool
    fraud_status:        str
    warning_level:       str   # "warn" | "flag"
    message:             str
    flag_reasons:        List[str] = []
    integrity_score:     Optional[float] = 100.0


# ─────────────────────────────────────────────────────────────────────────────
# Anti-Cheating & Proctoring Telemetry Event
# ─────────────────────────────────────────────────────────────────────────────

class TelemetryEventRequest(BaseModel):
    session_id:       UUID
    event_type:       str = Field(..., description="tab_switch, window_blur, copy_paste, secondary_speaker, periodic_face_check, gaze_loss, multi_face")
    details:          Optional[str] = None
    client_timestamp: Optional[str] = None
    metadata:         Optional[dict] = None


class TelemetryEventResponse(BaseModel):
    session_id:             UUID
    event_type:             str
    integrity_score:        float
    fraud_flags:            int
    fraud_status:           str
    interview_flagged:      bool
    tab_switch_count:       int
    window_blur_count:      int
    copy_paste_attempts:    int
    secondary_speaker_count: int
    timeline_event_count:   int
    message:                str
