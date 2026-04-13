import {
  createInstance,
  type FlatNamespace,
  type KeyPrefix,
} from 'i18next'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'

import i18nConfig, { type AppLanguage } from '@/i18n.config'
import {
  ADMIN_LANGUAGE_COOKIE_NAME,
  getAdminLanguageFromCookie,
  getLanguageFromAcceptLanguage,
  getLocaleLanguageFromCookie,
  I18N_LANGUAGE_HEADER_NAME,
  LEGACY_ADMIN_LANGUAGE_COOKIE_NAME,
  NEXT_LOCALE_COOKIE_NAME,
  normalizeRequestLanguage,
} from '@/lib/i18n/request-locale'

function namespacePrefersAdminLanguage(ns: string | string[] | undefined): boolean {
  const namespaces = Array.isArray(ns) ? ns : ns ? [ns] : []
  return namespaces.some((item) => item === 'admin' || item === 'auth')
}

async function detectServerLanguage(ns: string | string[] | undefined): Promise<AppLanguage> {
  const headerStore = await headers()
  const cookieStore = await cookies()
  const preferAdminLanguage = namespacePrefersAdminLanguage(ns)

  const fromHeader = normalizeRequestLanguage(headerStore.get(I18N_LANGUAGE_HEADER_NAME))
  if (fromHeader) return fromHeader

  if (preferAdminLanguage) {
    const fromAdminCookie = getAdminLanguageFromCookie(
      cookieStore.get(ADMIN_LANGUAGE_COOKIE_NAME)?.value,
      cookieStore.get(LEGACY_ADMIN_LANGUAGE_COOKIE_NAME)?.value,
    )
    if (fromAdminCookie) return fromAdminCookie
  }

  const fromPublicCookie = getLocaleLanguageFromCookie(
    cookieStore.get(NEXT_LOCALE_COOKIE_NAME)?.value,
  )
  if (fromPublicCookie) return fromPublicCookie

  return getLanguageFromAcceptLanguage(headerStore.get('accept-language'))
}

type ResourceNamespace = Record<string, unknown>
type ResourceMap = Record<string, Record<string, ResourceNamespace>>

async function loadNamespace(
  lng: AppLanguage,
  ns: string,
): Promise<ResourceNamespace> {
  const loader = (
    i18nConfig as typeof i18nConfig & {
      resourceLoader?: (language: string, namespace: string) => Promise<ResourceNamespace>
    }
  ).resourceLoader

  if (!loader) return {}
  return loader(lng, ns)
}

const loadNamespaceCached = cache(loadNamespace)

type GetTOptions<KPrefix extends string | undefined = undefined> = {
  keyPrefix?: KPrefix
  lng?: string
}

export async function getT<
  Ns extends FlatNamespace = FlatNamespace,
  KPrefix extends KeyPrefix<Ns> = undefined,
>(
  ns?: Ns | Ns[],
  options: GetTOptions<KPrefix> = {},
) {
  const defaultNamespace = i18nConfig.defaultNS ?? 'common'
  const fallbackLng = i18nConfig.fallbackLng as AppLanguage
  const lng =
    normalizeRequestLanguage(options.lng) ??
    (await detectServerLanguage(
      typeof ns === 'string' || Array.isArray(ns) ? ns : undefined,
    ))
  const namespaces = [
    ...new Set((ns ? (Array.isArray(ns) ? ns : [ns]) : (i18nConfig.ns ?? [defaultNamespace])) as string[]),
  ]
  const resolvedNs = (ns ? (Array.isArray(ns) ? ns[0] : ns) : defaultNamespace) as string

  const resources: ResourceMap = {
    [lng]: Object.fromEntries(
      await Promise.all(
        namespaces.map(async (namespace) => [
          namespace,
          await loadNamespaceCached(lng, namespace),
        ] as const),
      ),
    ),
  }

  if (fallbackLng !== lng) {
    resources[fallbackLng] = Object.fromEntries(
      await Promise.all(
        namespaces.map(async (namespace) => [
          namespace,
          await loadNamespaceCached(fallbackLng, namespace),
        ] as const),
      ),
    )
  }

  const i18n = createInstance()
  await i18n.init({
    lng,
    fallbackLng,
    defaultNS: defaultNamespace,
    ns: namespaces,
    resources,
    supportedLngs: i18nConfig.supportedLngs,
    interpolation: { escapeValue: false },
    ...i18nConfig.i18nextOptions,
  })

  return {
    t: i18n.getFixedT(lng, resolvedNs, options.keyPrefix as string | undefined),
    i18n,
    lng,
  }
}

export async function getLayoutResources(lng: AppLanguage): Promise<ResourceMap> {
  const defaultNamespace = i18nConfig.defaultNS ?? 'common'
  const namespaces = [...(i18nConfig.ns ?? [defaultNamespace])]
  const supportedLngs = (i18nConfig.supportedLngs ?? [lng]) as AppLanguage[]

  const loadForLanguage = async (language: AppLanguage) => {
    const entries = await Promise.all(
      namespaces.map(async (ns) => [ns, await loadNamespace(language, ns)] as const),
    )
    return Object.fromEntries(entries)
  }

  const languageOrder = [lng, ...supportedLngs.filter((item) => item !== lng)]
  const resources: ResourceMap = {}

  for (const language of languageOrder) {
    resources[language] = await loadForLanguage(language)
  }

  return resources
}
