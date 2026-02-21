from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib import error, request

from app.openclaw_ingest import build_legacy_event_id


def _read_env_api_key(env_path: Path) -> str | None:
    if not env_path.exists():
        return None
    for line in env_path.read_text(encoding="utf-8").splitlines():
        t = line.strip()
        if not t or t.startswith("#"):
            continue
        if not t.startswith("API_KEY="):
            continue
        return t.split("=", 1)[1].strip().strip('"')
    return None


def _resolve_api_key(script_dir: Path, cli_key: str | None) -> str:
    if cli_key:
        return cli_key
    env_key = os.getenv("API_KEY")
    if env_key:
        return env_key
    file_key = _read_env_api_key(script_dir / ".env")
    if file_key:
        return file_key
    raise RuntimeError("API_KEY not found. Set --api-key or pc-server/.env")


def _post_json(url: str, api_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = request.Request(
        url=url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Api-Key": api_key,
        },
    )
    try:
        with request.urlopen(req, timeout=20) as resp:
            text = resp.read().decode("utf-8")
            return json.loads(text) if text else {}
    except error.HTTPError as exc:
        body_text = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP_{exc.code}: {body_text}") from exc
    except Exception as exc:
        raise RuntimeError(f"NETWORK: {exc}") from exc


def _safe_name(path: Path) -> str:
    return path.name.replace(":", "_")


def _unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    stem = path.stem
    suffix = path.suffix
    parent = path.parent
    idx = 1
    while True:
        cand = parent / f"{stem}_{idx}{suffix}"
        if not cand.exists():
            return cand
        idx += 1


def _candidate_files(pending_dir: Path) -> list[Path]:
    files: list[Path] = []
    inbox = pending_dir / "inbox"
    if inbox.exists():
        files.extend(sorted(inbox.glob("*.jsonl")))

    # Backward compatibility: old location pending/*.jsonl
    for p in sorted(pending_dir.glob("*.jsonl")):
        if p.is_file():
            files.append(p)
    return files


def _normalize_payload(obj: Any, file_name: str, line_no: int, raw_line: str) -> dict[str, Any]:
    if not isinstance(obj, dict):
        raise ValueError("line is not a JSON object")

    payload = dict(obj)
    event_id = payload.get("event_id") or payload.get("eventId")
    if not isinstance(event_id, str) or not event_id.strip():
        payload["event_id"] = build_legacy_event_id(file_name, line_no, raw_line)

    if "source" not in payload:
        payload["source"] = "openclaw"
    return payload


def process_file(path: Path, *, endpoint: str, api_key: str) -> list[str]:
    errors_out: list[str] = []
    raw = path.read_text(encoding="utf-8").splitlines()
    for line_no, line in enumerate(raw, start=1):
        if not line.strip():
            continue
        try:
            parsed = json.loads(line)
            payload = _normalize_payload(parsed, path.name, line_no, line)
            _post_json(endpoint, api_key, payload)
        except Exception as exc:
            errors_out.append(f"line {line_no}: {exc}")
    return errors_out


def archive_file(path: Path, pending_dir: Path) -> None:
    day = datetime.now().date().isoformat()
    archive_dir = pending_dir / "archive" / day
    archive_dir.mkdir(parents=True, exist_ok=True)
    dest = _unique_path(archive_dir / _safe_name(path))
    shutil.move(str(path), str(dest))


def error_file(path: Path, pending_dir: Path, errors_out: list[str]) -> None:
    error_dir = pending_dir / "error"
    error_dir.mkdir(parents=True, exist_ok=True)
    dest = _unique_path(error_dir / _safe_name(path))
    shutil.move(str(path), str(dest))
    err_path = dest.with_suffix(dest.suffix + ".err")
    err_path.write_text("\n".join(errors_out) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Import pending OpenClaw nutrition JSONL files.")
    parser.add_argument("--pending-dir", default="../pending", help="Pending dir path")
    parser.add_argument("--base-url", default="http://localhost:8765", help="PC server base URL")
    parser.add_argument("--api-key", default=None, help="API key (optional)")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    pending_dir = Path(args.pending_dir)
    if not pending_dir.is_absolute():
        pending_dir = (script_dir / pending_dir).resolve()
    pending_dir.mkdir(parents=True, exist_ok=True)

    api_key = _resolve_api_key(script_dir, args.api_key)
    endpoint = args.base_url.rstrip("/") + "/api/openclaw/ingest"

    files = _candidate_files(pending_dir)
    if not files:
        print(f"[import-pending] no jsonl files in {pending_dir}")
        return 0

    file_errors = 0
    for path in files:
        errors_out = process_file(path, endpoint=endpoint, api_key=api_key)
        if errors_out:
            file_errors += 1
            error_file(path, pending_dir, errors_out)
            print(f"[import-pending] error: {path.name} ({len(errors_out)} line errors)")
        else:
            archive_file(path, pending_dir)
            print(f"[import-pending] imported: {path.name}")

    print(
        f"[import-pending] done files={len(files)} error_files={file_errors} endpoint={endpoint}"
    )
    return 1 if file_errors > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
