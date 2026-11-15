# Public Embeds & Feeds

These read-only endpoints make the panel easy to embed and subscribe to. All of
them honor the site lock: when the lock is enabled, visitors must unlock the
page (hold the `site_lock` cookie) before the endpoints return data.

## Inspiration feeds

Subscribe to the inspiration journal from any feed reader.

- RSS 2.0: `/inspiration/feed.xml`
- JSON Feed 1.1: `/inspiration/feed.json`

Both return up to the 30 most recent entries with a plain-text summary, a link
back to the entry page, and the entry image (when present). Responses are cached
for 5 minutes (`Cache-Control: public, max-age=300`).

## Schedule calendar subscription

Mirror the configured schedule into a calendar app (Google / Apple / Outlook):

- ICS: `/api/schedule/ics`

The calendar is generated from the saved courses via the same exporter used by
the admin UI, so weekly recurrence and per-session times are preserved. Add the
URL as a subscribed (read-only) calendar; most clients refresh it periodically.

## Status badge

A compact, single-line status badge for GitHub READMEs and forum signatures.

- Shields.io endpoint JSON (default): `/api/status/badge`
- Standalone SVG: `/api/status/badge?format=svg`
- Custom label: `/api/status/badge?label=waken`

Gating matches the SVG status card: the status card must be enabled and the site
lock satisfied (admins can preview while disabled). When gated out, the badge
renders a neutral `unavailable` state instead of an error.

### Shields.io usage

Point Shields at the JSON endpoint to inherit its styling:

```
https://img.shields.io/endpoint?url=https%3A%2F%2Fyour-domain.com%2Fapi%2Fstatus%2Fbadge
```

### Markdown (direct SVG)

```markdown
![status](https://your-domain.com/api/status/badge?format=svg)
```
