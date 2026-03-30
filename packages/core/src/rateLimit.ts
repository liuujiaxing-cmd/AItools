import { Redis } from "ioredis";

export type RateLimitRule = { capacity: number; refillPerSecond: number };

export class TokenBucketLimiter {
  constructor(private redis: Redis, private prefix = "rl") {}

  async allow(key: string, rule: RateLimitRule) {
    const now = Date.now() / 1000;
    const redisKey = `${this.prefix}:${key}`;
    const script = `
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
`;
    const allowed = await this.redis.eval(script, 1, redisKey, String(now), String(rule.capacity), String(rule.refillPerSecond));
    return Boolean(Number(allowed));
  }
}

