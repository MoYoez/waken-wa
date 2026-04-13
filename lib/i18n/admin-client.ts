'use client'

import { type AppLanguage, DEFAULT_LANGUAGE } from '@/i18n.config'
import {
  ADMIN_LANGUAGE_COOKIE_NAME,
  LEGACY_ADMIN_LANGUAGE_COOKIE_NAME,
  normalizeRequestLanguage,
} from '@/lib/i18n/request-locale'
import adminEn from '@/public/locales/en/admin.json'
import adminZhCN from '@/public/locales/zh-CN/admin.json'

type DictionaryValue = string | number | boolean | null | DictionaryObject | DictionaryValue[]
type DictionaryObject = { [key: string]: DictionaryValue }

const ADMIN_DICTIONARIES: Record<AppLanguage, DictionaryObject> = {
  en: adminEn as DictionaryObject,
  'zh-CN': adminZhCN as DictionaryObject,
}

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${encodeURIComponent(name)}=`
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length))
    }
  }
  return null
}

function getByPath(object: DictionaryObject, path: string): string | null {
  const parts = path.split('.')
  let current: DictionaryValue = object
  for (const part of parts) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return null
    current = (current as DictionaryObject)[part]
  }
  return typeof current === 'string' ? current : null
}

function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? ''))
}

export function getAdminClientLanguage(): AppLanguage {
  const fromCookie =
    normalizeRequestLanguage(getCookieValue(ADMIN_LANGUAGE_COOKIE_NAME)) ??
    normalizeRequestLanguage(getCookieValue(LEGACY_ADMIN_LANGUAGE_COOKIE_NAME))
  return fromCookie ?? DEFAULT_LANGUAGE
}

export function tAdminClient(
  key: string,
  values?: Record<string, string | number>,
  fallback?: string,
): string {
  const language = getAdminClientLanguage()
  const primary = getByPath(ADMIN_DICTIONARIES[language], key)
  const secondary = getByPath(ADMIN_DICTIONARIES[DEFAULT_LANGUAGE], key)
  const resolved = primary ?? secondary ?? fallback ?? key
  return interpolate(resolved, values)
}
