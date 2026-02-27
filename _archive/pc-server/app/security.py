from __future__ import annotations

import os

from fastapi import Header, HTTPException


def require_api_key(x_api_key: str | None = Header(default=None, alias="X-Api-Key")) -> None:
    expected = os.getenv("API_KEY")
    if not expected:
        # Fail closed: if API_KEY not set, do not accept requests.
        raise HTTPException(status_code=500, detail="Server misconfigured: API_KEY not set")
    if not x_api_key or x_api_key != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")
