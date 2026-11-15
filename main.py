"""Entrypoint FastAPI en la raíz del repo (detección zero-config de Vercel).

Reexporta la misma instancia `app` que `api.main:app` (servicio `api` en vercel.json).
"""
from api.main import app

__all__ = ["app"]
