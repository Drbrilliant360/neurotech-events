from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.services.payments import PaymentError


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Request validation failed.",
                    "details": exc.errors(),
                }
            },
        )

    @app.exception_handler(PaymentError)
    async def payment_error_handler(request: Request, exc: PaymentError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"error": {"code": exc.code, "message": str(exc)}})

    @app.exception_handler(HTTPException)
    async def http_error_handler(request: Request, exc: HTTPException) -> JSONResponse:
        default_code = {401: "unauthorized", 403: "forbidden", 404: "not_found", 409: "conflict", 503: "unavailable"}
        detail = exc.detail
        if isinstance(detail, dict):
            code = str(detail.get("code") or default_code.get(exc.status_code, "error"))
            message = str(detail.get("message") or detail)
        else:
            code = default_code.get(exc.status_code, "error")
            message = str(detail)
        return JSONResponse(
            status_code=exc.status_code, content={"error": {"code": code, "message": message}}, headers=exc.headers
        )
