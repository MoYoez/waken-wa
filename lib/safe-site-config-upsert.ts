type SiteConfigUpsertArgs = {
  where: { id: number }
  update: Record<string, unknown>
  create: Record<string, unknown>
}

function getUnknownArgumentName(error: unknown): string | null {
  const message = String((error as { message?: unknown })?.message ?? '')
  const match = message.match(/Unknown argument `([^`]+)`/)
  return match?.[1] ?? null
}

export async function safeSiteConfigUpsert(
  prismaClient: any,
  args: SiteConfigUpsertArgs
) {
  const update = { ...args.update }
  const create = { ...args.create }

  for (let i = 0; i < 30; i += 1) {
    try {
      return await prismaClient.siteConfig.upsert({
        where: args.where,
        update,
        create,
      })
    } catch (error) {
      const unknownArg = getUnknownArgumentName(error)
      if (!unknownArg) {
        throw error
      }

      const hasUnknown =
        Object.prototype.hasOwnProperty.call(update, unknownArg) ||
        Object.prototype.hasOwnProperty.call(create, unknownArg)

      if (!hasUnknown) {
        throw error
      }

      delete update[unknownArg]
      delete create[unknownArg]
    }
  }

  throw new Error('siteConfig upsert retries exhausted')
}
