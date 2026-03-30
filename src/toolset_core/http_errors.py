from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse

from toolset_core.context import request_id_var
from toolset_core.errors import ToolsetError, error_message


def negotiate_language(request: Request) -> str:
    value = request.headers.get("accept-language", "")
    if value.lower().startswith("zh"):
        return "zh"
    return "en"


def toolset_error_response(request: Request, err: ToolsetError) -> JSONResponse:
    lang = negotiate_language(request)
    request_id = request_id_var.get() or ""
    msg = err.message.zh if lang == "zh" else err.message.en
    payload: dict[str, Any] = {
        "error": {
            "code": err.app_code,
            "message": msg,
            "details": err.details,
            "request_id": request_id,
        }
    }
    return JSONResponse(status_code=err.http_status, content=payload)


def unexpected_error_response(request: Request, exc: Exception) -> JSONResponse:
    lang = negotiate_language(request)
    request_id = request_id_var.get() or ""
    msg_obj = error_message("5xx.internal")
    msg = msg_obj.zh if lang == "zh" else msg_obj.en
    payload: dict[str, Any] = {
        "error": {
            "code": "5xx.internal",
            "message": msg,
            "details": None,
            "request_id": request_id,
        }
    }
    return JSONResponse(status_code=500, content=payload)

