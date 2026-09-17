#!/bin/sh
set -eu

mkdir -p /app/data/media/catalog /app/data/media/products
if [ -d /app/seed-media/catalog ]; then
  find /app/seed-media/catalog -mindepth 1 -maxdepth 1 -exec cp -an {} /app/data/media/catalog/ \;
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
