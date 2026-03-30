from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ErrorMessage:
    zh: str
    en: str


class ToolsetError(Exception):
    def __init__(
        self,
        *,
        app_code: str,
        http_status: int,
        message: ErrorMessage,
        details: Any | None = None,
    ):
        super().__init__(message.en)
        self.app_code = app_code
        self.http_status = http_status
        self.message = message
        self.details = details


ERROR_CATALOG: dict[str, ErrorMessage] = {
    "1xx.invalid_request": ErrorMessage(zh="请求格式不正确", en="Invalid request"),
    "2xx.tool_not_found": ErrorMessage(zh="工具不存在", en="Tool not found"),
    "2xx.tool_load_failed": ErrorMessage(zh="工具加载失败", en="Tool load failed"),
    "2xx.tool_invoke_failed": ErrorMessage(zh="工具执行失败", en="Tool invocation failed"),
    "3xx.unauthorized": ErrorMessage(zh="未授权", en="Unauthorized"),
    "3xx.forbidden": ErrorMessage(zh="禁止访问", en="Forbidden"),
    "3xx.signature_invalid": ErrorMessage(zh="签名校验失败", en="Invalid signature"),
    "3xx.rate_limited": ErrorMessage(zh="请求过于频繁", en="Rate limited"),
    "4xx.conflict": ErrorMessage(zh="资源冲突", en="Conflict"),
    "5xx.internal": ErrorMessage(zh="服务内部错误", en="Internal server error"),
}


def error_message(app_code: str) -> ErrorMessage:
    return ERROR_CATALOG.get(app_code, ERROR_CATALOG["5xx.internal"])

