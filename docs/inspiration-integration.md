# Inspiration API Guide

This document describes the public integration endpoints for inspiration entries. It is intended for device clients, scripts, and other automation clients.

Unified API reference:

- Scalar API Reference: `/api-reference`
- OpenAPI JSON: `/api/openapi.json`

## 1. Endpoint Scope

Currently available endpoints:

- `GET /api/inspiration/entries`: publicly read the inspiration list
- `POST /api/inspiration/entries`: create an inspiration entry
- `DELETE /api/inspiration/entries?id=...`: delete an inspiration entry, admin only
- `POST /api/inspiration/assets`: upload inline image assets
- `GET /api/inspiration/img/{publicKey}`: publicly read an image

## 2. Authentication

Public read endpoints:

- `GET /api/inspiration/entries`
- `GET /api/inspiration/img/{publicKey}`

Write endpoints support either:

- an admin `session` cookie
- or `Authorization: Bearer <API_TOKEN>`

Notes:

- `GET /api/inspiration/entries` is still affected by the site access lock. If the site is locked, unlock the page first.
- Bearer Token writes may also be restricted by the admin **Allowed Device Hashes for Inspiration** rule.
- `attachCurrentStatus` can be used with both admin `session` writes and Bearer Token writes.
- When using Bearer Token writes with current status attached, the client must provide its current device identity through `X-Device-Key` or `generatedHashKey`, and it may only attach the status of that same device.

## 3. Common Integration Flows

### Send a Text Entry Directly

Send the following payload to `POST /api/inspiration/entries`:

```json
{
  "title": "Today",
  "content": "A short note from device side."
}
```

### Upload an Image, Then Create an Entry

1. Call `POST /api/inspiration/assets`
2. Read the returned `publicKey` and `url`
3. Reference the image URL in client content, or keep the asset URL for later use

### Inline Image Upload

You can also send `imageDataUrl` directly in `POST /api/inspiration/entries`, but this is better suited for small images.

## 4. Recommendations

- Treat `/api-reference` as the source of truth for structured fields, status codes, and examples.
- If you are building a device integration, also read [activity-reporting.md](./activity-reporting.md).
