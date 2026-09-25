# Build context: repository root (the image bundles the authentic data catalog).
#   docker build -f data-service/Dockerfile .
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY data-service/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY data-service/app/ ./app/
COPY data-service/celery_app.py data-service/seed_data.py ./

# Served artefacts produced by scripts/build_authentic_dataset.py
COPY frontend/public/api/ ./data/api/
COPY frontend/public/tiles/ ./data/tiles/
COPY frontend/public/data/ ./data/data/
ENV OCEAN_DATA_ROOT=/app/data

EXPOSE 8000
# Render (and similar hosts) inject PORT; default to 8000 for docker compose.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]
