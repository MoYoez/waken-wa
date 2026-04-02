export async function readJsonBody<T>(request: Request, fallback: T): Promise<T> {
  try {
    return await request.json() as T
  } catch {
    return fallback
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const body = await readJsonBody(request, null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {}
  }
  return body as Record<string, unknown>
}
