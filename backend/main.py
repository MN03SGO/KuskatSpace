"""
Shim de retrocompatibilidad para backend/main.py.
La aplicación FastAPI oficial y unificada reside en api/main.py.
"""

from api.main import app  # noqa: F401
