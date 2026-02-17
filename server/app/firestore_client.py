from __future__ import annotations

from google.cloud import firestore

from . import settings


_client: firestore.Client | None = None


def get_client() -> firestore.Client:
    global _client
    if _client is None:
        # In GCP, credentials are auto-provided (service account).
        # Locally, use `gcloud auth application-default login`.
        if settings.GCP_PROJECT:
            _client = firestore.Client(project=settings.GCP_PROJECT, database=settings.FIRESTORE_DATABASE)
        else:
            _client = firestore.Client(database=settings.FIRESTORE_DATABASE)
    return _client
