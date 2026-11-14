"""
app/core/url_safety.py
Protection against server-side request forgery (SSRF).

Certificate verification fetches web addresses found on UPLOADED documents, so
the address is attacker-controlled. Without checks, a forged "certificate"
could make the server fetch internal addresses (this backend, the database
admin, a cloud provider's metadata service at 169.254.169.254, ...) and the
reply snippet was shown back to the uploader.

safe_get() only fetches http/https URLs on standard ports whose host resolves
exclusively to public internet addresses, and re-checks every redirect hop.
"""
import asyncio
import ipaddress
import socket
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx

ALLOWED_PORTS = {None, 80, 443, 8080, 8443}
MAX_REDIRECTS = 5


class UnsafeURL(ValueError):
    """The URL points somewhere the server must not fetch."""


def _is_public_ip(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    return addr.is_global and not addr.is_multicast


async def check_url(url: str) -> str:
    """Raise UnsafeURL unless `url` is safe to fetch. Returns the URL."""
    try:
        parsed = urlparse(url)
    except Exception:
        raise UnsafeURL("Malformed URL")
    if parsed.scheme not in ("http", "https"):
        raise UnsafeURL(f"Scheme '{parsed.scheme}' is not allowed")
    if not parsed.hostname:
        raise UnsafeURL("URL has no host")
    if parsed.username or parsed.password:
        raise UnsafeURL("URLs with credentials are not allowed")
    try:
        port = parsed.port
    except ValueError:
        raise UnsafeURL("Invalid port")
    if port not in ALLOWED_PORTS:
        raise UnsafeURL(f"Port {port} is not allowed")

    host = parsed.hostname
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, port or 443, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise UnsafeURL(f"Host '{host}' does not resolve")
    ips = {info[4][0] for info in infos}
    if not ips or not all(_is_public_ip(ip) for ip in ips):
        raise UnsafeURL(f"Host '{host}' resolves to a private or reserved address")
    return url


async def safe_get(url: str, *, timeout: float = 10.0, headers: Optional[dict] = None,
                   transport: Optional[httpx.AsyncBaseTransport] = None) -> httpx.Response:
    """GET a user-supplied URL, following redirects only to other safe URLs."""
    current = url
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False, transport=transport) as client:
        for _ in range(MAX_REDIRECTS + 1):
            await check_url(current)
            resp = await client.get(current, headers=headers)
            if resp.is_redirect and resp.headers.get("location"):
                current = urljoin(current, resp.headers["location"])
                continue
            return resp
    raise UnsafeURL("Too many redirects")
