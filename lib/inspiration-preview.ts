import { lexicalTextContent } from '@/lib/inspiration-lexical'

const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\([^)]+\)/g
const LEXICAL_IMAGE_NODE_RE = /"type":"image"/

function countNonEmptyLines(text: string): number {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length
}

function stripMarkdownImages(markdown: string): string {
  return markdown.replace(MARKDOWN_IMAGE_RE, '')
}

function normalizePreviewWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function hasImageAndAtLeastOneTextLine(markdown: string): boolean {
  const hasImage = MARKDOWN_IMAGE_RE.test(markdown)
  MARKDOWN_IMAGE_RE.lastIndex = 0
  if (!hasImage) return false
  const textLineCount = countNonEmptyLines(stripMarkdownImages(markdown))
  return textLineCount >= 1
}

function hasMarkdownImage(markdown: string): boolean {
  const hasImage = MARKDOWN_IMAGE_RE.test(markdown)
  MARKDOWN_IMAGE_RE.lastIndex = 0
  return hasImage
}

/** Heuristic: whether plain text should be interpreted as markdown. */
export function inspirationLooksLikeMarkdown(text: string): boolean {
  const value = text.trim()
  if (!value) return false
  return (
    /^#{1,6}\s/m.test(value) ||
    /^\s*[-*+]\s+/m.test(value) ||
    /^\s*\d+\.\s+/m.test(value) ||
    /```[\s\S]*```/.test(value) ||
    /`[^`]+`/.test(value) ||
    /\[([^\]]+)\]\(([^)]+)\)/.test(value) ||
    /!\[([^\]]*)\]\(([^)]+)\)/.test(value) ||
    /(^|\s)(\*\*|__)[^*_\n]+(\*\*|__)(?=\s|$)/.test(value) ||
    /(^|\s)(\*|_)[^*_\n]+(\*|_)(?=\s|$)/.test(value)
  )
}

/** Plain-text teaser for home list; keeps markdown out of truncated display. */
export function inspirationPlainPreview(markdown: string, maxLen: number): { text: string; truncated: boolean } {
  const text = normalizePreviewWhitespace(
    markdown
    .replace(MARKDOWN_IMAGE_RE, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~]+/g, '')
  )
  if (text.length <= maxLen) return { text: text || '（附图或格式内容）', truncated: false }
  return { text: `${text.slice(0, maxLen).trim()}…`, truncated: true }
}

/** Whether home should offer “full article” instead of inline full markdown. */
export function inspirationNeedsFullPage(markdown: string, maxInlineChars = 220): boolean {
  if (hasMarkdownImage(markdown)) return true
  if (markdown.length > maxInlineChars) return true
  if (countNonEmptyLines(markdown) >= 3) return true
  if (hasImageAndAtLeastOneTextLine(markdown)) return true
  return false
}

export function inspirationPlainPreviewAny(
  markdown: string,
  contentLexical: string | null | undefined,
  maxLen: number,
): { text: string; truncated: boolean } {
  const lexicalText = lexicalTextContent(contentLexical)
  if (!lexicalText) return inspirationPlainPreview(markdown, maxLen)
  const text = normalizePreviewWhitespace(lexicalText)
  if (text.length <= maxLen) {
    return { text: text || '（附图或格式内容）', truncated: false }
  }
  return { text: `${text.slice(0, maxLen).trim()}…`, truncated: true }
}

export function inspirationNeedsFullPageAny(
  markdown: string,
  contentLexical: string | null | undefined,
  maxInlineChars = 220,
): boolean {
  const lexicalText = lexicalTextContent(contentLexical)
  if (hasMarkdownImage(markdown)) return true
  if (lexicalText) {
    if (lexicalText.length > maxInlineChars) return true
    if (countNonEmptyLines(lexicalText) >= 3) return true
    if (typeof contentLexical === 'string' && LEXICAL_IMAGE_NODE_RE.test(contentLexical)) return true
    return false
  }
  if (typeof contentLexical === 'string' && contentLexical.trim()) {
    if (LEXICAL_IMAGE_NODE_RE.test(contentLexical)) return true
    if (/"type":"(heading|quote|list|listitem|code|table)"/.test(contentLexical)) return true
  }
  return inspirationNeedsFullPage(markdown, maxInlineChars)
}
