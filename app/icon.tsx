import {
  createDefaultSiteIconResponse,
  SITE_DEFAULT_ICON_CONTENT_TYPE,
  SITE_DEFAULT_ICON_SIZE,
} from '@/lib/site-default-icon'

export const runtime = 'edge'

export const size = SITE_DEFAULT_ICON_SIZE

export const contentType = SITE_DEFAULT_ICON_CONTENT_TYPE

export default function Icon() {
  return createDefaultSiteIconResponse()
}

