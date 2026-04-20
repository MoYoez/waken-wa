import Redis from 'ioredis'

const LUA_FIXED_WINDOW_INCR = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return c
`

const LUA_HSET_MANY_AND_FIXED_WINDOW_INCR = `
if ((#ARGV - 1) % 2) ~= 0 then
  return redis.error_reply('field/value pairs expected')
end
if #ARGV > 1 then
  redis.call('HSET', KEYS[1], unpack(ARGV, 2))
end
local c = redis.call('INCR', KEYS[2])
if c == 1 then
  redis.call('EXPIRE', KEYS[2], ARGV[1])
end
return c
`

export type RedisWithFixedWindowIncr = Redis & {
  fixedWindowIncr(key: string, ttlSeconds: string): Promise<number>
  hsetManyAndFixedWindowIncr(
    hashKey: string,
    lockKey: string,
    ttlSeconds: string,
    ...fieldValues: string[]
  ): Promise<number>
}

export function ensureFixedWindowIncrCommand(client: Redis): void {
  const marked = client as Redis & { __wakenFixedWindowIncr?: boolean }
  if (marked.__wakenFixedWindowIncr) return
  marked.__wakenFixedWindowIncr = true
  client.defineCommand('fixedWindowIncr', {
    numberOfKeys: 1,
    lua: LUA_FIXED_WINDOW_INCR.trim(),
  })
}

export function ensureHSetManyAndFixedWindowIncrCommand(client: Redis): void {
  const marked = client as Redis & { __wakenHSetManyAndFixedWindowIncr?: boolean }
  if (marked.__wakenHSetManyAndFixedWindowIncr) return
  marked.__wakenHSetManyAndFixedWindowIncr = true
  client.defineCommand('hsetManyAndFixedWindowIncr', {
    numberOfKeys: 2,
    lua: LUA_HSET_MANY_AND_FIXED_WINDOW_INCR.trim(),
  })
}
