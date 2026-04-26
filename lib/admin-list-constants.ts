/** Default `limit` when query param is omitted (devices list, inspiration list). */
export const ADMIN_LIST_DEFAULT_PAGE_SIZE = 20

/** Max allowed `limit` for admin list query params. */
export const ADMIN_LIST_MAX_PAGE_SIZE = 100

/** Max allowed `limit` for device list queries (devices are few, callers often want all). */
export const ADMIN_DEVICE_LIST_MAX_LIMIT = 500

/** Default page size for API tokens when `limit` is present (pagination mode). */
export const ADMIN_API_TOKENS_PAGE_DEFAULT_SIZE = 10

/** Recent devices joined per token in token list responses. */
export const ADMIN_API_TOKENS_RECENT_DEVICES_LIMIT = 5
