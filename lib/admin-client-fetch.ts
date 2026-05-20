'use client'

import type { SuccessResponse } from '@/types/admin-query'

export type AdminClientFetchError = string | ((response: Response) => string)

export type AdminClientFetchOptions = Omit<RequestInit, 'body'> & {
  fallbackError?: AdminClientFetchError
  json?: unknown
}

export type AdminClientFetchResult<TJson extends SuccessResponse<unknown>> = {
  json: TJson
  response: Response
}

export async function readJson<T>(response: Response): Promise<T | null> {
  return response.json().catch(() => null)
}

function BuildRequestInit(options: AdminClientFetchOptions = {}): RequestInit {
  const { fallbackError: _fallbackError, headers, json, ...init } = options
  if (typeof json === 'undefined') return { ...init, headers }

  const requestHeaders = new Headers(headers)
  if (!requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  return {
    ...init,
    body: JSON.stringify(json),
    headers: requestHeaders,
  }
}

function ResolveFallbackError(
  fallbackError: AdminClientFetchError | undefined,
  response: Response,
): string {
  return typeof fallbackError === 'function'
    ? fallbackError(response)
    : fallbackError || `HTTP ${response.status}`
}

function ResolveApiError(
  response: Response,
  json: SuccessResponse<unknown> | null,
  fallbackError: AdminClientFetchError | undefined,
): string {
  return typeof json?.error === 'string' && json.error
    ? json.error
    : ResolveFallbackError(fallbackError, response)
}

export async function fetchAdminSuccess<TJson extends SuccessResponse<unknown>>(
  input: RequestInfo | URL,
  options: AdminClientFetchOptions = {},
): Promise<AdminClientFetchResult<TJson>> {
  const response = await fetch(input, BuildRequestInit(options))
  const json = await readJson<TJson>(response)
  if (!response.ok || !json?.success) {
    throw new Error(ResolveApiError(response, json, options.fallbackError))
  }
  return { json, response }
}

export async function fetchAdminData<TData>(
  input: RequestInfo | URL,
  options: AdminClientFetchOptions = {},
): Promise<TData> {
  const { json, response } = await fetchAdminSuccess<SuccessResponse<TData>>(input, options)
  if (typeof json.data === 'undefined') {
    throw new Error(ResolveApiError(response, json, options.fallbackError))
  }
  return json.data
}

export async function fetchAdminVoid(
  input: RequestInfo | URL,
  options: AdminClientFetchOptions = {},
): Promise<void> {
  await fetchAdminSuccess<SuccessResponse<unknown>>(input, options)
}

export async function fetchAdminOk(
  input: RequestInfo | URL,
  options: AdminClientFetchOptions = {},
): Promise<Response> {
  const response = await fetch(input, BuildRequestInit(options))
  if (!response.ok) {
    throw new Error(ResolveFallbackError(options.fallbackError, response))
  }
  return response
}
