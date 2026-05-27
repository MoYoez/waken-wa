const MAX_CSS_URL_LENGTH = 2048

type SanitizeCssTextOptions = {
  declarationValue?: boolean
}

function ToString(value: unknown): string {
  return String(value ?? '')
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

function DecodeHtmlEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X'
      const codePoint = isHex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return ''
      try {
        return String.fromCodePoint(codePoint)
      } catch {
        return ''
      }
    }
    const replacement = NAMED_HTML_ENTITIES[body.toLowerCase()]
    return replacement ?? match
  })
}

const HTML_BLOCK_TAG_NAMES =
  'script|style|iframe|noscript|noembed|noframes|template|xmp|plaintext'
const HTML_BLOCK_TAG_REGEX = new RegExp(
  `<\\s*(${HTML_BLOCK_TAG_NAMES})\\b[^>]*>[\\s\\S]*?<\\s*/\\s*\\1\\s*>`,
  'gi',
)
const HTML_DANGLING_BLOCK_OPEN_REGEX = new RegExp(
  `<\\s*(${HTML_BLOCK_TAG_NAMES})\\b[\\s\\S]*$`,
  'i',
)

function StripHtml(input: string): string {
  return input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(HTML_BLOCK_TAG_REGEX, '')
    .replace(HTML_DANGLING_BLOCK_OPEN_REGEX, '')
    .replace(/<\/?[a-z!][^>]*>/gi, '')
}

function StripTemplateTokens(input: string): string {
  return input
    .replace(/\{\{[\s\S]*?\}\}/g, '')
    .replace(/<%[\s\S]*?%>/g, '')
    .replace(/\$\{[\s\S]*?\}/g, '')
}

export function SanitizePlainText(input: unknown, maxLength?: number): string {
  const raw = ToString(input)
  const bounded =
    typeof maxLength === 'number' && Number.isFinite(maxLength)
      ? raw.slice(0, Math.max(0, Math.round(maxLength)))
      : raw
  const decoded = DecodeHtmlEntities(bounded)
  const stripped = StripHtml(decoded)
  return StripTemplateTokens(stripped).trim()
}

const SAFE_URL_PREFIXES = [
  'http://',
  'https://',
  'data:image/',
  'data:font/',
  'blob:',
  'mailto:',
  'tel:',
  '/',
  './',
  '../',
  '#',
  '?',
]

export function SanitizeUrl(input: unknown): string {
  const raw = SanitizePlainText(input, MAX_CSS_URL_LENGTH).replace(/^["']|["']$/g, '').trim()
  if (!raw) return ''
  if (/\s/.test(raw)) return ''
  const lower = raw.toLowerCase()
  return SAFE_URL_PREFIXES.some((prefix) => lower.startsWith(prefix)) ? raw : ''
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
