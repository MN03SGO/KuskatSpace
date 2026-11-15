# Dockerfile para TerraAnáloga - NASA Space Apps Challenge 2026
FROM python:3.11-slim-bookworm

# Evitar prompts interactivos y buffers en logs
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

WORKDIR /app

# Instalar dependencias del sistema necesarias para compilar/ejecutar paquetes geoespaciales
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar dependencias Python
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar todo el código del proyecto
COPY . /app/

# Exponer el puerto de FastAPI
EXPOSE 8000

# Comando por defecto para iniciar el servidor de desarrollo
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
