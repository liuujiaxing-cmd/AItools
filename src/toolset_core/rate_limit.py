from __future__ import annotations

import time
from dataclasses import dataclass

import asyncio
from typing import Dict, Tuple

from redis.asyncio import Redis


@dataclass(frozen=True)
class RateLimitRule:
    capacity: int
    refill_per_second: float


class TokenBucketLimiter:
    def __init__(self, redis: Redis, *, prefix: str = "rl"):
        self.redis = redis
        self.prefix = prefix

    async def allow(self, key: str, rule: RateLimitRule) -> bool:
        now = time.time()
        redis_key = f"{self.prefix}:{key}"

        script = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refill = tonumber(ARGV[3])

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then tokens = capacity end
if ts == nil then ts = now end

local delta = math.max(0, now - ts)
tokens = math.min(capacity, tokens + delta * refill)

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call('HSET', key, 'tokens', tokens, 'ts', now)
redis.call('EXPIRE', key, math.ceil(capacity / refill * 2))
return allowed
"""
        allowed = await self.redis.eval(script, 1, redis_key, str(now), str(rule.capacity), str(rule.refill_per_second))
        return bool(int(allowed))


class InMemoryTokenBucketLimiter:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._buckets: Dict[str, Tuple[float, float]] = {}

    async def allow(self, key: str, rule: RateLimitRule) -> bool:
        now = time.time()
        async with self._lock:
            tokens, ts = self._buckets.get(key, (float(rule.capacity), now))
            delta = max(0.0, now - ts)
            tokens = min(float(rule.capacity), tokens + delta * float(rule.refill_per_second))
            allowed = tokens >= 1.0
            if allowed:
                tokens -= 1.0
            self._buckets[key] = (tokens, now)
            return allowed
