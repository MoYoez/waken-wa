'use client'

import Image from 'next/image'
import { Fragment } from 'react'

import { getSafeUserFacingHref } from '@/lib/external-link'
import { parseLexicalJson } from '@/lib/inspiration-lexical'
import type { LexicalNode } from '@/types'

const IMAGE_MD_RE = /!\[[^\]]*]\(([^)]+)\)/g

function applyTextFormat(text: string, format?: number): React.ReactNode {
  let out: React.ReactNode = text
  const f = Number(format ?? 0)
  if (f & 16) out = <code className="rounded bg-muted/80 px-1 py-0.5 text-xs">{out}</code>
  if (f & 8) out = <u>{out}</u>
  if (f & 4) out = <s>{out}</s>
  if (f & 2) out = <em>{out}</em>
  if (f & 1) out = <strong>{out}</strong>
  return out
}

function renderTextNode(node: LexicalNode, key: string): React.ReactNode {
  const text = String(node.text ?? '')
  if (!text) return null
  const chunks: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  const re = new RegExp(IMAGE_MD_RE.source, 'g')
  while ((match = re.exec(text)) !== null) {
    const start = match.index
    if (start > last) {
      const raw = text.slice(last, start)
      chunks.push(<Fragment key={`${key}-txt-${start}`}>{applyTextFormat(raw, node.format)}</Fragment>)
    }
    const src = String(match[1] ?? '').trim()
    if (src) {
      chunks.push(
        <Image
          key={`${key}-img-${start}`}
          src={src}
          alt=""
          width={1200}
          height={900}
          className="my-3 max-h-[min(70vh,24rem)] w-auto rounded-md border border-border/60"
        />,
      )
    }
    last = start + match[0].length
  }
  if (last < text.length) {
    chunks.push(<Fragment key={`${key}-tail`}>{applyTextFormat(text.slice(last), node.format)}</Fragment>)
  }
  return chunks.length > 0 ? chunks : applyTextFormat(text, node.format)
}

function renderChildren(nodes: LexicalNode[] | undefined, keyPrefix: string): React.ReactNode {
  if (!Array.isArray(nodes) || nodes.length === 0) return null
  return nodes.map((node, idx) => renderNode(node, `${keyPrefix}-${idx}`))
}

function renderNode(node: LexicalNode, key: string): React.ReactNode {
  const type = node.type ?? ''
  if (type === 'text') {
    return <Fragment key={key}>{renderTextNode(node, key)}</Fragment>
  }
  if (type === 'linebreak') {
    return <br key={key} />
  }
  if (type === 'paragraph') {
    return (
      <p key={key} className="mb-2 text-sm leading-relaxed last:mb-0">
        {renderChildren(node.children, key)}
      </p>
    )
  }
  if (type === 'heading') {
    const tag = node.tag === 'h1' || node.tag === 'h2' || node.tag === 'h3' ? node.tag : 'h3'
    if (tag === 'h1') {
      return (
        <h3 key={key} className="mb-2 mt-3 text-base font-semibold first:mt-0">
          {renderChildren(node.children, key)}
        </h3>
      )
    }
    return (
      <h4 key={key} className="mb-2 mt-3 text-sm font-semibold first:mt-0">
        {renderChildren(node.children, key)}
      </h4>
    )
  }
  if (type === 'quote') {
    return (
      <blockquote key={key} className="my-2 border-l-2 border-border pl-3 text-sm text-muted-foreground">
        {renderChildren(node.children, key)}
      </blockquote>
    )
  }
  if (type === 'list') {
    const isOrdered = node.listType === 'number'
    const Tag = isOrdered ? 'ol' : 'ul'
    return (
      <Tag key={key} className={`${isOrdered ? 'list-decimal' : 'list-disc'} mb-2 space-y-0.5 pl-5 text-sm`}>
        {renderChildren(node.children, key)}
      </Tag>
    )
  }
  if (type === 'listitem') {
    return <li key={key}>{renderChildren(node.children, key)}</li>
  }
  if (type === 'link') {
    const href = getSafeUserFacingHref(String(node.url ?? ''))
    return (
      <a key={key} href={href || '#'} rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-2">
        {renderChildren(node.children, key)}
      </a>
    )
  }
  return <Fragment key={key}>{renderChildren(node.children, key)}</Fragment>
}

export function LexicalContent({
  content,
  className,
}: {
  content: string | null | undefined
  className?: string
}) {
  const parsed = parseLexicalJson(content)
  if (!parsed) return null
  const children = Array.isArray(parsed.root.children) ? (parsed.root.children as LexicalNode[]) : []
  if (children.length === 0) return null
  return <div className={className}>{children.map((node, i) => renderNode(node, `root-${i}`))}</div>
}
