type PaginationOptions = {
  defaultLimit: number
  maxLimit: number
  defaultOffset?: number
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  options: PaginationOptions,
) {
  const limitRaw = Number(searchParams.get('limit') ?? options.defaultLimit)
  const offsetRaw = Number(searchParams.get('offset') ?? options.defaultOffset ?? 0)

  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(options.maxLimit, Math.round(limitRaw)))
    : options.defaultLimit
  const offset = Number.isFinite(offsetRaw)
    ? Math.max(0, Math.round(offsetRaw))
    : options.defaultOffset ?? 0

  return { limit, offset }
}
