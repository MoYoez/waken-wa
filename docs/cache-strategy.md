# Cache Strategy

This repository does not treat every function as cacheable. Cache is applied only to read-heavy or coordination-sensitive paths, and the preferred default is:

1. in-process memory cache first
2. Redis cache second
3. database or original source last

This document defines when to use that pattern and when not to.

## Standard A

Standard A means:

- read from in-process memory first
- if memory misses, read from Redis
- if Redis misses, read from DB or the original source
- after a source read, backfill memory
- when Redis is enabled, also backfill Redis
- writes should update memory first, then mirror to Redis when appropriate

This is the preferred default for read-heavy state that can tolerate eventual consistency across instances.

Good fits:

- site configuration snapshots
- auth/materialized lookup results
- aggregated activity feed payloads
- lightweight cross-request state that can be rebuilt from DB or a source of truth

Current examples:

- [lib/site-config-cache.ts](../lib/site-config-cache.ts)
- [lib/api-token-auth-cache.ts](../lib/api-token-auth-cache.ts)
- [lib/auth.ts](../lib/auth.ts)
- [lib/activity-feed-cache.ts](../lib/activity-feed-cache.ts)
- [lib/realtime-activity-cache.ts](../lib/realtime-activity-cache.ts)

## Standard A Guardrails

When implementing Standard A:

- memory cache must be treated as disposable
- Redis is a secondary shared cache, not the source of truth
- DB or the original upstream source remains the final source
- cached values must be serializable if they are mirrored into Redis
- cache invalidation must clear both memory and Redis views when both exist
- memory-first should never be used for data that requires cross-instance linearizability

## Serverless Guidance

In serverless environments:

- memory cache is only a best-effort warm cache for the current instance
- Redis is the only shared cache across instances
- any critical behavior must still work after cold start and memory loss
- avoid relying on `setTimeout` or long-lived in-memory queues for correctness

Standard A is still allowed in serverless, but memory should be treated as an optimization only.

## When Not To Use Standard A

Do not force Standard A onto every module.

Avoid it for:

- rate limiting that depends on atomic counters
- write coordination that must be globally consistent across instances
- queues that depend on durable delivery semantics
- short-lived ephemeral code paths where caching adds complexity but little benefit

These cases may need:

- Redis-first atomic operations
- DB-first writes
- dedicated queue semantics
- no cache at all

## Special Cases In This Repo

### Rate Limit

[lib/rate-limit.ts](../lib/rate-limit.ts) should remain Redis-first when Redis is enabled, because the fixed-window counter relies on atomic increment semantics.

### Activity App History

[lib/activity-app-history.ts](../lib/activity-app-history.ts) uses a Standard A style variant:

- memory is the primary pending buffer for the current instance
- Redis mirrors pending entries for cross-instance continuity
- Redis is not treated as an equal second writer during the same-instance flush path

This is intentionally different from a naive dual-write queue, to avoid duplicate counting.

## Recommended Decision Order

Before adding a cache:

1. decide whether the data has a durable source of truth
2. decide whether correctness depends on cross-instance atomicity
3. if no atomicity is required, prefer Standard A
4. if atomicity is required, prefer Redis-first or DB-first designs
5. add explicit invalidation rules before shipping

## Practical Rules For Contributors

- New cache layers should default to Standard A unless there is a clear reason not to
- Do not introduce Redis-only or memory-only caches silently; document why
- If a module intentionally breaks Standard A, add a short comment explaining the reason
- If you add a new cache key space, keep key names versioned
- If you change cache semantics, update this document and any linked AGENTS guidance
