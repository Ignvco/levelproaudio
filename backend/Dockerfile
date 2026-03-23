# ── Imagen base ────────────────────────────────────────────
FROM python:3.11-slim

# Variables de entorno para Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Instala dependencias del sistema
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Instala dependencias Python
COPY requirements/ requirements/
RUN pip install --upgrade pip && \
    pip install -r requirements/development.txt

# Copia el código
COPY . .

EXPOSE 8000