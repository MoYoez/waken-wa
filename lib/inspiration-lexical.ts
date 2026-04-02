import type { LexicalNode, LexicalRoot } from '@/types'

const UUID_IN_PATH_RE =
  /\/api\/inspiration\/img\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isLexicalRoot(value: unknown): value is LexicalRoot {
  if (!isObject(value)) return false
  const root = value.root
  if (!isObject(root)) return false
  return Array.isArray(root.children)
}

export function parseLexicalJson(input: unknown): LexicalRoot | null {
  if (!input) return null
  if (typeof input === 'string') {
    const raw = input.trim()
    if (!raw) return null
    try {
      const parsed: unknown = JSON.parse(raw)
      return isLexicalRoot(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  if (isLexicalRoot(input)) return input
  return null
}

export function normalizeLexicalJsonString(input: unknown): string | null {
  const parsed = parseLexicalJson(input)
  if (!parsed) return null
  return JSON.stringify(parsed)
}

function collectText(node: LexicalNode, output: string[]): void {
  if (typeof node.text === 'string' && node.text.length > 0) {
    output.push(node.text)
  }
  if (node.type === 'linebreak') {
    output.push('\n')
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectText(child, output)
    if (
      node.type === 'paragraph' ||
      node.type === 'heading' ||
      node.type === 'quote' ||
      node.type === 'listitem'
    ) {
      output.push('\n')
    }
  }
}

export function lexicalTextContent(input: unknown): string {
  const parsed = parseLexicalJson(input)
  if (!parsed) return ''
  const out: string[] = []
  collectText(parsed.root, out)
  return out.join('').replace(/\n{3,}/g, '\n\n').trim()
}

export function lexicalHasVisibleText(input: unknown): boolean {
  return lexicalTextContent(input).trim().length > 0
}

function collectNodeStrings(node: LexicalNode, output: string[]): void {
  if (typeof node.text === 'string' && node.text.length > 0) output.push(node.text)
  if (typeof node.url === 'string' && node.url.length > 0) output.push(node.url)
  if (typeof node.src === 'string' && node.src.length > 0) output.push(node.src)
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectNodeStrings(child, output)
  }
}

export function extractInspirationImagePublicKeysFromLexical(input: unknown): string[] {
  const parsed = parseLexicalJson(input)
  if (!parsed) return []
  const strings: string[] = []
  collectNodeStrings(parsed.root, strings)
  const keys = new Set<string>()
  const re = new RegExp(UUID_IN_PATH_RE.source, 'gi')
  for (const value of strings) {
    let m: RegExpExecArray | null
    while ((m = re.exec(value)) !== null) keys.add(m[1].toLowerCase())
    re.lastIndex = 0
  }
  return [...keys]
}

export function appendParagraphTextToLexical(input: unknown, text: string): string {
  const value = text.trim()
  const parsed =
    parseLexicalJson(input) ?? {
      root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        direction: null,
        children: [],
      },
    }
  if (!value) return JSON.stringify(parsed)
  const root = parsed.root as LexicalNode & { children: LexicalNode[] }
  if (!Array.isArray(root.children)) root.children = []
  root.children.push({
    type: 'paragraph',
    format: '',
    indent: 0,
    version: 1,
    direction: null,
    children: [
      {
        type: 'text',
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        text: value,
        version: 1,
      } as unknown as LexicalNode,
    ],
  } as unknown as LexicalNode)
  return JSON.stringify(parsed)
}
