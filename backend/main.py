"""
Shim de retrocompatibilidad para backend/main.py.
La aplicación FastAPI oficial y unificada reside en api/main.py.
"""
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from api.main import app  # noqa: F401
