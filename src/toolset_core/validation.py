from __future__ import annotations

from typing import Any

from jsonschema import Draft202012Validator

from toolset_core.errors import ToolsetError, error_message


def validate_jsonschema(*, schema: dict[str, Any], data: Any) -> None:
    if not schema:
        return
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(data), key=lambda e: e.path)
    if not errors:
        return
    first = errors[0]
    raise ToolsetError(
        app_code="1xx.invalid_request",
        http_status=400,
        message=error_message("1xx.invalid_request"),
        details={"reason": "schema_validation", "message": first.message, "path": list(first.path)},
    )

