FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY server.py ./

# Persistent volume mount point for SQLite
RUN mkdir -p /data

# Fly.io uses port 8080; DB stored on persistent volume
ENV PORT=8080
ENV DB_PATH=/data/hc_sync.db
# UDP discovery is not needed in cloud
ENV DISCOVERY_ENABLED=false

CMD ["python", "server.py"]
