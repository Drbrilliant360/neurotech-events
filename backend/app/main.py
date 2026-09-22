from fastapi import FastAPI

from app.api.errors import register_error_handlers
from app.api.v1.router import router as api_v1_router
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Versioned API for the Neurotech Events platform.",
    debug=settings.debug,
)

register_error_handlers(app)
app.include_router(api_v1_router, prefix=settings.api_prefix)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "neurotech-events-api",
        "environment": settings.environment,
    }
