from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any


@dataclass
class _Entry:
    value: Any
    expires_at: float


class TTLCache:
    def __init__(self, *, max_items: int = 2048):
        self.max_items = max_items
        self._data: dict[str, _Entry] = {}

    def get(self, key: str) -> Any | None:
        e = self._data.get(key)
        if not e:
            return None
        if time.time() >= e.expires_at:
            self._data.pop(key, None)
            return None
        return e.value

    def set(self, key: str, value: Any, *, ttl_seconds: int) -> None:
        if ttl_seconds <= 0:
            return
        if len(self._data) >= self.max_items:
            oldest = next(iter(self._data.keys()), None)
            if oldest:
                self._data.pop(oldest, None)
        self._data[key] = _Entry(value=value, expires_at=time.time() + ttl_seconds)

