# Dockerfile para TerraAnalog - NASA Space Apps Challenge 2026
FROM python:3.11-slim-bookworm

# Evitar prompts interactivos y buffers en logs
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Dependencias del sistema para paquetes geoespaciales
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

# Deps ligeras + pesadas (ráster) para la imagen Docker completa.
# Vercel usa solo requirements.txt de la raíz (sin rasterio).
COPY backend/requirements.txt /app/backend/requirements.txt
COPY backend/requirements-local.txt /app/backend/requirements-local.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/backend/requirements-local.txt

# Codigo del proyecto
COPY . /app/

# App unica: api/main.py (reutiliza connectors/processor de backend/ via sys.path)
EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
