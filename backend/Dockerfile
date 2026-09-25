FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    WEB_CONCURRENCY=2 \
    FORWARDED_ALLOW_IPS=127.0.0.1

COPY pyproject.toml .
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini .

RUN pip install . \
    && useradd --system --uid 10001 --no-create-home appuser

# Never run the API as root.
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).status == 200 else 1)"

# --proxy-headers trusts X-Forwarded-For only from FORWARDED_ALLOW_IPS (set it to the load balancer).
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY} --proxy-headers --forwarded-allow-ips ${FORWARDED_ALLOW_IPS} --no-server-header"]
