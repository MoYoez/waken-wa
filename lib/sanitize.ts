import DOMPurify, { type Config } from 'isomorphic-dompurify'

const PLAIN_TEXT_SANITIZE_CONFIG: Config = {
  ALLOWED_ATTR: [],
  ALLOWED_TAGS: [],
  KEEP_CONTENT: true,
  SAFE_FOR_TEMPLATES: true,
}

const MAX_CSS_URL_LENGTH = 2048

type SanitizeCssTextOptions = {
  declarationValue?: boolean
}

function ToString(value: unknown): string {
  return String(value ?? '')
}

export function SanitizePlainText(input: unknown, maxLength?: number): string {
  const raw = ToString(input)
  const bounded =
    typeof maxLength === 'number' && Number.isFinite(maxLength)
      ? raw.slice(0, Math.max(0, Math.round(maxLength)))
      : raw
  return String(DOMPurify.sanitize(bounded, PLAIN_TEXT_SANITIZE_CONFIG)).trim()
}

export function SanitizeUrl(input: unknown): string {
  const raw = SanitizePlainText(input, MAX_CSS_URL_LENGTH).replace(/^["']|["']$/g, '').trim()
  if (!raw) return ''
  if (DOMPurify.isValidAttribute('img', 'src', raw)) return raw
  if (DOMPurify.isValidAttribute('a', 'href', raw)) return raw
  return ''
}

export function SanitizeCssUrls(css: string): string {
  const re = /url\s*\(/gi
  let last = 0
  let out = ''
  let match: RegExpExecArray | null

  while ((match = re.exec(css)) !== null) {
    const start = match.index
    out += css.slice(last, start)
    let cursor = start + match[0].length
    while (cursor < css.length && /\s/.test(css[cursor])) cursor += 1

    let inner = ''
    const quote = css[cursor]
    if (quote === '"' || quote === "'") {
      cursor += 1
      while (cursor < css.length) {
        if (css[cursor] === '\\' && cursor + 1 < css.length) {
          inner += css[cursor] + css[cursor + 1]
          cursor += 2
          continue
        }
        if (css[cursor] === quote) {
          cursor += 1
          break
        }
        inner += css[cursor]
        cursor += 1
      }
    } else {
      while (cursor < css.length && css[cursor] !== ')') {
        inner += css[cursor]
        cursor += 1
      }
    }

    while (cursor < css.length && /\s/.test(css[cursor])) cursor += 1
    if (css[cursor] === ')') cursor += 1

    const safeUrl = SanitizeUrl(inner)
    out += safeUrl ? `url(${JSON.stringify(safeUrl)})` : 'none'
    last = cursor
    re.lastIndex = cursor
  }

  out += css.slice(last)
  return out
}

function StripCssControlTokens(css: string): string {
  return css
    .replace(/@import\b[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/behavior\s*:/gi, '')
}

export function SanitizeCssText(
  input: unknown,
  maxLength: number,
  options: SanitizeCssTextOptions = {},
): string {
  const sanitized = StripCssControlTokens(SanitizeCssUrls(SanitizePlainText(input, maxLength)))
  return options.declarationValue ? sanitized.replace(/[{}]/g, '') : sanitized
}
