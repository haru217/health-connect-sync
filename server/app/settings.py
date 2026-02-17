import os


def get_env(name: str, default: str | None = None) -> str:
    v = os.getenv(name, default)
    if v is None:
        raise RuntimeError(f"Missing required env var: {name}")
    return v


TOKEN_PEPPER = get_env("TOKEN_PEPPER", "CHANGE_ME")
REGISTER_ENABLED = os.getenv("REGISTER_ENABLED", "true").lower() in ("1", "true", "yes", "y")
REGISTER_KEY = os.getenv("REGISTER_KEY")  # optional extra guard for /v1/register
GCP_PROJECT = os.getenv("GCP_PROJECT")  # optional; auto-detected in GCP
FIRESTORE_DATABASE = os.getenv("FIRESTORE_DATABASE", "(default)")
