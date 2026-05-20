import { NextRequest, NextResponse } from 'next/server'

import { enforceApiRateLimit } from '@/lib/api-rate-limit'
import {
  getSafeSiteConfig,
  prepareSiteConfigValuesFromPayload,
} from '@/lib/llm-site-config'
import { readJsonObject } from '@/lib/request-json'
import { readEffectiveSiteConfig } from '@/lib/site-settings-read'
import { pickRecordKeys } from '@/lib/site-settings-record'
import { verifySkillsRequest } from '@/lib/skills-auth'

const LLM_SETTINGS_CATEGORY_RATE_LIMIT_MAX = 60
const LLM_SETTINGS_CATEGORY_RATE_LIMIT_WINDOW_MS = 60_000

type LlmSettingsCategoryRouteOptions = {
  bucket: string
  categoryName: string
  allowedKeys: readonly string[]
  read: (config: Record<string, unknown>) => Record<string, unknown>
  persist: (
    preparedValues: Record<string, unknown>,
    requestedBody: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>
}

function createCategoryFieldError(
  categoryName: string,
  allowedKeys: readonly string[],
  receivedKeys: string[],
) {
  const invalidKeys = receivedKeys.filter((key) => !allowedKeys.includes(key))
  if (invalidKeys.length === 0) return null

  const error = new Error(
    `Fields do not belong to ${categoryName} settings: ${invalidKeys.join(', ')}`,
  )
  ;(error as { status?: number; invalidKeys?: string[] }).status = 400
  ;(error as { status?: number; invalidKeys?: string[] }).invalidKeys = invalidKeys
  return error
}

function errorResponse(error: unknown) {
  const status =
    typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : null
  if (error instanceof Error && status !== null) {
    const detail = error as Error & {
      deniedKeys?: unknown
      invalidKeys?: unknown
    }
    const extra =
      Array.isArray(detail.deniedKeys)
        ? { deniedKeys: detail.deniedKeys }
        : Array.isArray(detail.invalidKeys)
          ? { invalidKeys: detail.invalidKeys }
          : {}
    return NextResponse.json(
      { success: false, error: error.message, ...extra },
      { status },
    )
  }
  return null
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function mergeNestedPatchFields(
  body: Record<string, unknown>,
  currentConfig: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...body }
  if (isPlainRecord(body.themeCustomSurface) && isPlainRecord(currentConfig.themeCustomSurface)) {
    next.themeCustomSurface = {
      ...currentConfig.themeCustomSurface,
      ...body.themeCustomSurface,
    }
  }
  return next
}

export function createLlmSettingsCategoryRoute(options: LlmSettingsCategoryRouteOptions) {
  const GET = async (request: NextRequest) => {
    const limitedResponse = await enforceApiRateLimit(request, {
      bucket: `${options.bucket}-get`,
      maxRequests: LLM_SETTINGS_CATEGORY_RATE_LIMIT_MAX,
      windowMs: LLM_SETTINGS_CATEGORY_RATE_LIMIT_WINDOW_MS,
    })
    if (limitedResponse) return limitedResponse

    const auth = await verifySkillsRequest(request)
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
      const data = await getSafeSiteConfig('admin')
      return NextResponse.json({
        success: true,
        data: data ? options.read(data as Record<string, unknown>) : null,
      })
    } catch (error) {
      console.error(`Failed to read LLM ${options.categoryName} settings:`, error)
      return NextResponse.json({ success: false, error: 'Failed to read' }, { status: 500 })
    }
  }

  const PATCH = async (request: NextRequest) => {
    const limitedResponse = await enforceApiRateLimit(request, {
      bucket: `${options.bucket}-patch`,
      maxRequests: LLM_SETTINGS_CATEGORY_RATE_LIMIT_MAX,
      windowMs: LLM_SETTINGS_CATEGORY_RATE_LIMIT_WINDOW_MS,
    })
    if (limitedResponse) return limitedResponse

    const auth = await verifySkillsRequest(request)
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    try {
      const body = await readJsonObject(request)
      const categoryError = createCategoryFieldError(
        options.categoryName,
        options.allowedKeys,
        Object.keys(body),
      )
      if (categoryError) throw categoryError

      const currentConfig = await readEffectiveSiteConfig()
      if (!currentConfig) {
        return NextResponse.json(
          { success: false, error: 'Site configuration not found. Please complete setup first.' },
          { status: 400 },
        )
      }

      const mergedBody = mergeNestedPatchFields(body, currentConfig)
      const preparedValues = await prepareSiteConfigValuesFromPayload(mergedBody)
      const data = await options.persist(
        {
          ...currentConfig,
          ...pickRecordKeys(preparedValues, options.allowedKeys),
        },
        body,
      )
      return NextResponse.json({
        success: true,
        data: data ? options.read(data) : null,
      })
    } catch (error) {
      const knownError = errorResponse(error)
      if (knownError) return knownError

      console.error(`Failed to update LLM ${options.categoryName} settings:`, error)
      return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 })
    }
  }

  return { GET, PATCH }
}
