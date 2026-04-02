'use client'

import Image from 'next/image'
import { useMemo } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { getSafeUserFacingHref } from '@/lib/external-link'

const DEFAULT_IMG_CLASS = 'max-h-48 rounded-md border border-border my-2'

const baseMarkdownComponents: Omit<Components, 'img'> = {
  h1: ({ children }) => (
    <h3 className="text-base font-semibold mt-3 mb-1 first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="text-base font-semibold mt-3 mb-1 first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold mt-3 mb-1 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1">{children}</h4>,
  h5: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1">{children}</h4>,
  h6: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1">{children}</h4>,
  p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 text-sm mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 text-sm mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ href, children }) => (
    <a
      href={getSafeUserFacingHref(String(href ?? ''))}
      rel="noopener noreferrer nofollow"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ className, children, inline, node: _node, ...rest }: any) => {
    if (inline) {
      return (
        <code className="bg-muted/80 px-1 py-0.5 rounded text-xs font-mono" {...rest}>
          {children}
        </code>
      )
    }
    return (
      <pre className="bg-muted rounded-md p-2 text-xs overflow-x-auto mb-2 max-w-full">
        <code className={className} {...rest}>
          {children}
        </code>
      </pre>
    )
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 text-muted-foreground text-sm my-2">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2">
      <table className="text-sm border border-border rounded-md w-full border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted/50 px-2 py-1 text-left font-medium">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
}

function buildComponents(imageClassName: string): Components {
  return {
    ...baseMarkdownComponents,
    img: ({ src, alt }) =>
      typeof src === 'string' && src ? (
        <Image
          src={src}
          alt={alt || ''}
          width={800}
          height={600}
          className={imageClassName}
        />
      ) : null,
  }
}

export function MarkdownContent({
  markdown,
  className,
  imageClassName = DEFAULT_IMG_CLASS,
}: {
  markdown: string
  className?: string
  /** Tailwind classes for rendered markdown images */
  imageClassName?: string
}) {
  const components = useMemo(() => buildComponents(imageClassName), [imageClassName])
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
