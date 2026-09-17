# syntax=docker/dockerfile:1
# Build and run the React storefront + FastAPI on one port (8000).

FROM node:22-alpine AS client
WORKDIR /src
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CLIENT_DIST=/app/client-dist \
    MEDIA_DIR=/app/data/media \
    DATABASE_URL=sqlite:////app/data/af_trends.db \
    CORS_ORIGINS=http://localhost:8000,http://127.0.0.1:8000

COPY api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY api/app ./app
COPY --from=client /src/dist /app/client-dist
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Optional seed catalog photos; missing files are skipped and SVGs are generated.
COPY api/media /app/seed-media

EXPOSE 8000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health')"

ENTRYPOINT ["/entrypoint.sh"]
