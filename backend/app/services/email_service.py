"""
app/services/email_service.py
Email notifications over plain SMTP (works with Gmail app passwords, Outlook,
SendGrid, Mailtrap, etc.).

Design:
- Sending never blocks or breaks a request: notify_* schedule the send in the
  background, and any SMTP error is logged, never raised to the caller.
- With SMTP_HOST unset (development), emails are printed to the console
  instead of sent, so every flow still works without a mail server.
- Every value that comes from a user (names, drive titles) is HTML-escaped.
"""
import asyncio
import html
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import parseaddr
from typing import Optional

from app.config import settings

# Keep references so background sends aren't garbage-collected mid-flight
_pending: set = set()


def is_configured() -> bool:
    return bool(settings.SMTP_HOST)


def _valid_address(addr: Optional[str]) -> bool:
    if not addr:
        return False
    _, email = parseaddr(addr)
    return "@" in email and "." in email.split("@")[-1] and not email.endswith("@example.com")


def _link(path: str) -> str:
    return settings.FRONTEND_URL.rstrip("/") + path


def _render(title: str, paragraphs: list, button_text: Optional[str] = None, button_url: Optional[str] = None):
    """Build (text, html) bodies. `paragraphs` must already be safe HTML for the html part."""
    text = title + "\n\n" + "\n\n".join(_strip_tags(p) for p in paragraphs)
    if button_url:
        text += f"\n\n{button_text}: {button_url}"
    text += "\n\n— SkillProof"

    button = ""
    if button_url:
        button = (
            f'<p style="margin:24px 0"><a href="{html.escape(button_url, quote=True)}" '
            f'style="background:#0377AE;color:#ffffff;padding:12px 20px;border-radius:8px;'
            f'text-decoration:none;font-weight:600;display:inline-block">{html.escape(button_text)}</a></p>'
        )
    body = "".join(f'<p style="margin:0 0 14px;line-height:1.6">{p}</p>' for p in paragraphs)
    html_body = (
        '<!doctype html><html><body style="margin:0;background:#F1F7FC;font-family:Arial,Helvetica,sans-serif;color:#10243A">'
        '<div style="max-width:560px;margin:0 auto;padding:32px 20px">'
        '<div style="font-weight:800;font-size:18px;color:#0377AE;margin-bottom:20px">SkillProof</div>'
        '<div style="background:#ffffff;border:1px solid #D5E5F2;border-radius:12px;padding:28px">'
        f'<h1 style="font-size:20px;margin:0 0 16px">{html.escape(title)}</h1>{body}{button}</div>'
        '<p style="font-size:12px;color:#52677C;margin-top:20px">You received this because you use SkillProof.</p>'
        '</div></body></html>'
    )
    return text, html_body


def _strip_tags(s: str) -> str:
    import re
    return html.unescape(re.sub(r"<[^>]+>", "", s))


def _send_now(to: str, subject: str, text: str, html_body: str) -> bool:
    """Blocking SMTP send. Returns True on success. Never raises."""
    msg = EmailMessage()
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html_body, subtype="html")

    security = (settings.SMTP_SECURITY or "starttls").lower()
    try:
        if security == "ssl":
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20,
                                      context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)
        with server as s:
            if security == "starttls":
                s.starttls(context=ssl.create_default_context())
            if settings.SMTP_USERNAME:
                s.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            s.send_message(msg)
        print(f"[Email] Sent '{subject}' to {to}")
        return True
    except Exception as e:
        print(f"[Email] Could not send '{subject}' to {to}: {e}")
        return False


def send_email(to: Optional[str], subject: str, text: str, html_body: str) -> None:
    """Schedule an email in the background (or log it when SMTP isn't configured)."""
    if not _valid_address(to):
        return
    if not is_configured():
        print(f"[Email] SMTP not configured; would send to {to}: '{subject}'")
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        _send_now(to, subject, text, html_body)
        return
    task = loop.create_task(asyncio.to_thread(_send_now, to, subject, text, html_body))
    _pending.add(task)
    task.add_done_callback(_pending.discard)


# ─────────────────────────────────────────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────────────────────────────────────────

def notify_results_ready(to: str, name: str, session_id, skills: list, score: Optional[float]) -> None:
    skills_txt = html.escape(", ".join(skills) if skills else "your skills")
    score_txt = f" Your overall score is <strong>{score:.1f}%</strong>." if score is not None else ""
    text, body = _render(
        "Your SkillProof results are ready",
        [
            f"Hi {html.escape(name or 'there')},",
            f"Your assessment for <strong>{skills_txt}</strong> has been scored.{score_txt}",
            "Your report includes a score for each skill and feedback on every answer, "
            "with the key points a strong answer would have covered.",
        ],
        "View your report", _link(f"/user/reports/{session_id}"),
    )
    send_email(to, "Your SkillProof results are ready", text, body)


def notify_shortlisted(to: str, name: str, drive_title: str, org_name: str) -> None:
    text, body = _render(
        "You've been shortlisted",
        [
            f"Hi {html.escape(name or 'there')},",
            f"Good news: <strong>{html.escape(org_name or 'the organisation')}</strong> has shortlisted you "
            f"in <strong>{html.escape(drive_title)}</strong>.",
            "They will contact you about the next steps.",
        ],
        "See your placement drives", _link("/user/drives"),
    )
    send_email(to, f"You've been shortlisted: {drive_title}", text, body)


def notify_drive_completion(to: str, org_name: str, drive_id, drive_title: str,
                            candidate_name: str, score: Optional[float]) -> None:
    score_txt = f" with a score of <strong>{score:.1f}%</strong>" if score is not None else ""
    text, body = _render(
        "A candidate completed your drive",
        [
            f"Hi {html.escape(org_name or 'there')},",
            f"<strong>{html.escape(candidate_name or 'A candidate')}</strong> has completed "
            f"<strong>{html.escape(drive_title)}</strong>{score_txt}.",
            "The ranking on the drive page has been updated.",
        ],
        "Open the drive", _link(f"/org/drives/{drive_id}"),
    )
    send_email(to, f"New result in {drive_title}", text, body)


def notify_org_status(to: str, org_name: str, approved: bool, reason: Optional[str] = None) -> None:
    if approved:
        text, body = _render(
            "Your organisation account is approved",
            [
                f"Hi {html.escape(org_name or 'there')},",
                "Your SkillProof organisation account has been approved. You can now sign in, "
                "create placement drives and review candidates.",
            ],
            "Sign in", _link("/org/signin"),
        )
        send_email(to, "Your SkillProof organisation account is approved", text, body)
    else:
        paragraphs = [
            f"Hi {html.escape(org_name or 'there')},",
            "Unfortunately your SkillProof organisation registration was not approved.",
        ]
        if reason:
            paragraphs.append(f"Reason: {html.escape(reason)}")
        text, body = _render("Your organisation registration", paragraphs)
        send_email(to, "Update on your SkillProof organisation registration", text, body)
