import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.deps import DbSession
from app.api.errors import register_error_handlers
from app.api.v1.router import router as api_v1_router
from app.config import get_settings
from app.core.middleware import BodySizeLimitMiddleware, RequestContextMiddleware

settings = get_settings()
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO, format="%(levelname)s %(name)s %(message)s"
)

app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    description="Versioned API for the Neurotech Events platform.",
    debug=settings.debug,
    docs_url="/docs" if settings.docs_visible else None,
    redoc_url="/redoc" if settings.docs_visible else None,
    openapi_url="/openapi.json" if settings.docs_visible else None,
)

# Middleware runs outermost-last: request context wraps everything so every response,
# including CORS preflights and 413s, carries the request id and security headers.
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID"],
    expose_headers=["X-Request-ID", "Retry-After", "Content-Disposition"],
    max_age=600,
)
app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_request_body_bytes)
app.add_middleware(RequestContextMiddleware, hsts=settings.is_hardened)
register_error_handlers(app)
app.include_router(api_v1_router, prefix=settings.api_prefix)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    """Liveness: the process is up. Does not touch the database."""
    return {
        "status": "ok",
        "service": "neurotech-events-api",
        "environment": settings.environment,
    }


@app.get("/health/ready", tags=["system"])
def readiness(db: DbSession) -> JSONResponse:
    """Readiness: the API can reach its database. Load balancers should route on this."""
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(status_code=503, content={"status": "unavailable", "database": "unreachable"})
    return JSONResponse(content={"status": "ok", "database": "reachable"})
