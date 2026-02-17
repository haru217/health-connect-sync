from __future__ import annotations

import hashlib

from fastapi import Header, HTTPException

from . import settings


def hash_token(token: str) -> str:
    # MVP: sha256(pepper + token)
    h = hashlib.sha256()
    h.update((settings.TOKEN_PEPPER + token).encode("utf-8"))
    return h.hexdigest()


def parse_bearer(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization scheme")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty bearer token")
    return token


async def require_device_token(authorization: str | None = Header(default=None)) -> str:
    # Returns raw token; caller can hash and look up device
    return parse_bearer(authorization)
