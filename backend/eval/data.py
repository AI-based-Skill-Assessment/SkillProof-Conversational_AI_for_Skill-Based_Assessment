"""
eval/data.py
Load evaluation data from the SkillProof database or from a JSON file.

JSON format (lets you evaluate on data collected elsewhere):
{
  "templates": [{"subject": "p01", "face": [...128 floats...], "voice": [...]}],
  "probes":    [{"subject": "p01", "modality": "face", "embedding": [...],
                 "session": "s1", "time": "2026-11-20T10:00:00", "claimed": "p01"}]
}
"subject" is who was REALLY in front of the camera; "claimed" (optional,
defaults to subject) is who they claimed to be. A probe with
claimed != subject is a deliberate impostor attempt.
"""
import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional


@dataclass
class Probe:
    subject: str            # true identity
    claimed: str            # identity claimed in the session
    modality: str           # "face" | "voice"
    embedding: list
    session: Optional[str] = None
    time: Optional[datetime] = None
    call_id: Optional[str] = None


@dataclass
class Dataset:
    templates: Dict[str, Dict[str, list]] = field(default_factory=dict)   # subject -> {"face": .., "voice": ..}
    probes: List[Probe] = field(default_factory=list)

    def summary(self) -> str:
        nf = sum(1 for p in self.probes if p.modality == "face")
        nv = sum(1 for p in self.probes if p.modality == "voice")
        attacks = sum(1 for p in self.probes if p.claimed != p.subject)
        return (f"{len(self.templates)} enrolled subjects, {nf} face probes, {nv} voice probes, "
                f"{attacks} deliberate impostor probes")


def _parse_time(v) -> Optional[datetime]:
    if not v:
        return None
    if isinstance(v, datetime):
        return v
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return None


def load_json(path: str) -> Dataset:
    raw = json.load(open(path, encoding="utf-8"))
    ds = Dataset()
    for t in raw.get("templates", []):
        ds.templates[str(t["subject"])] = {k: t.get(k) for k in ("face", "voice") if t.get(k)}
    for p in raw.get("probes", []):
        ds.probes.append(Probe(
            subject=str(p["subject"]), claimed=str(p.get("claimed", p["subject"])),
            modality=p["modality"], embedding=p["embedding"],
            session=p.get("session"), time=_parse_time(p.get("time")), call_id=p.get("call_id"),
        ))
    return ds


def load_db(impostor_sessions: Optional[Dict[str, str]] = None) -> Dataset:
    """
    Enrolment templates = users' registered face/voice; probes = biometric_probes
    (logged during interviews with RESEARCH_LOGGING=true).
    impostor_sessions: {session_id: true_subject_label} for sessions where the
    study team had someone OTHER than the account owner take the interview.
    """
    return asyncio.run(_load_db(impostor_sessions or {}))


async def _load_db(impostor_sessions: Dict[str, str]) -> Dataset:
    from sqlalchemy import select
    from app.database import async_session_factory
    from app.models.research import BiometricProbe
    from app.models.user import User

    ds = Dataset()
    async with async_session_factory() as db:
        users = (await db.execute(select(User))).scalars().all()
        for u in users:
            t = {}
            if u.face_embedding:
                t["face"] = u.face_embedding
            if u.voice_embedding:
                t["voice"] = u.voice_embedding
            if t:
                ds.templates[str(u.id)] = t
        probes = (await db.execute(select(BiometricProbe).order_by(BiometricProbe.created_at))).scalars().all()
        for p in probes:
            if not p.subject_user_id:
                continue
            claimed = str(p.subject_user_id)
            true_subject = impostor_sessions.get(str(p.session_id), claimed)
            ds.probes.append(Probe(
                subject=true_subject, claimed=claimed, modality=p.modality, embedding=p.embedding,
                session=str(p.session_id) if p.session_id else None, time=p.created_at, call_id=str(p.call_id),
            ))
    return ds
