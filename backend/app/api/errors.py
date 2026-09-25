import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError

from app.services.errors import DomainError, RateLimitedError

logger = logging.getLogger("neurotech.errors")


def _request_id(request: Request) -> str | None:
    return request.scope.get("state", {}).get("request_id")


def _envelope(status_code: int, code: str, message: str, request: Request, **extra) -> JSONResponse:
    body: dict = {"error": {"code": code, "message": message, **extra}}
    request_id = _request_id(request)
    if request_id:
        body["error"]["request_id"] = request_id
    return JSONResponse(status_code=status_code, content=jsonable_encoder(body))


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Drop the submitted input from the echo so passwords and tokens never come back in errors.
        details = [{k: v for k, v in error.items() if k not in {"input", "ctx", "url"}} for error in exc.errors()]
        return _envelope(422, "validation_error", "Request validation failed.", request, details=details)

    @app.exception_handler(DomainError)
    async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
        response = _envelope(exc.status_code, exc.code, str(exc), request)
        if isinstance(exc, RateLimitedError):
            response.headers["Retry-After"] = str(exc.retry_after)
        return response

    @app.exception_handler(HTTPException)
    async def http_error_handler(request: Request, exc: HTTPException) -> JSONResponse:
        default_code = {
            401: "unauthorized",
            403: "forbidden",
            404: "not_found",
            405: "method_not_allowed",
            409: "conflict",
            413: "payload_too_large",
            429: "rate_limited",
            503: "unavailable",
        }
        detail = exc.detail
        if isinstance(detail, dict):
            code = str(detail.get("code") or default_code.get(exc.status_code, "error"))
            message = str(detail.get("message") or detail)
        else:
            code = default_code.get(exc.status_code, "error")
            message = str(detail)
        response = _envelope(exc.status_code, code, message, request)
        if exc.headers:
            response.headers.update(exc.headers)
        return response

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
        logger.warning("integrity error request_id=%s: %s", _request_id(request), exc.orig.__class__.__name__)
        return _envelope(409, "conflict", "The request conflicts with existing data.", request)

    @app.exception_handler(OperationalError)
    async def database_unavailable_handler(request: Request, exc: OperationalError) -> JSONResponse:
        logger.error("database error request_id=%s", _request_id(request), exc_info=exc)
        return _envelope(503, "database_unavailable", "The database is temporarily unavailable.", request)

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        # Never leak stack traces or internals to clients; the request id links the log entry.
        logger.error("unhandled error request_id=%s", _request_id(request), exc_info=exc)
        return _envelope(500, "internal_error", "An unexpected error occurred.", request)
