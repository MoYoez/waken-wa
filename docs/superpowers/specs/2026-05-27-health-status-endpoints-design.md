# Health & Status Endpoints

**Date:** 2026-05-27
**Scope:** Two new lightweight API routes for monitoring and online status.

---

## Endpoints

### `GET /api/health`

Pure liveness check for external monitoring (UptimeRobot, Uptime Kuma, etc.).

- **Auth:** None
- **Response:** `200 OK` — `{ "status": "ok" }`
- **No database query**, zero overhead

### `GET /api/status`

Online status detail for the site owner.

- **Auth:** Site lock (same as `/api/activity` GET). Returns 403 if site is locked.
- **Response:**

```json
{ "success": true, "data": { "isOnline": true } }
```

- `isOnline` = true when any device has a non-expired `user_activities` row or a realtime cache entry (same logic as `components/user-profile.tsx` line 76: `Boolean(feed?.activeStatuses?.length)`)

---

## Files

| File | Action |
|------|--------|
| `app/api/health/route.ts` | Create |
| `app/api/status/route.ts` | Create |

No schema changes. No existing files modified.

---

## Notes

- Both routes export `dynamic = 'force-dynamic'` and `revalidate = 0` per project convention.
- Status endpoint reuses `isSiteLockSatisfied()` from `lib/auth.ts` for site lock check.
- Status endpoint queries `user_activities` directly (check `expiresAt > now`) rather than calling the full `getActivityFeedData()` to stay lightweight.
