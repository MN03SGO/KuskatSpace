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

# Un solo requirements: el de backend/ (D7)
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/backend/requirements.txt

# Codigo del proyecto
COPY . /app/

# La app vive en backend/: se arranca desde ahi (imports y sample_data/ son relativos)
WORKDIR /app/backend

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
