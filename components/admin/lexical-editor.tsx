'use client'

import { LinkNode } from '@lexical/link'
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
} from '@lexical/list'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  HeadingNode,
  QuoteNode,
} from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  type LexicalEditor as LexicalEditorInstance,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import {
  lexicalTextContent,
  normalizeLexicalJsonString,
  parseLexicalJson,
} from '@/lib/inspiration-lexical'
import { cn } from '@/lib/utils'

const tbMD = {
  onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent editor from losing selection when clicking toolbar buttons.
    e.preventDefault()
  },
}

type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'bullet' | 'number'
type TextFmt = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code'

function ToolbarSep() {
  return <div className="mx-0.5 h-4 w-px bg-border/60" />
}

function EditorToolbar({ editor }: { editor: LexicalEditorInstance }) {
  const [blockType, setBlockType] = useState<BlockType>('paragraph')
  const [textFmts, setTextFmts] = useState<Set<TextFmt>>(new Set())

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return

        const anchor = selection.anchor.getNode()
        const top = anchor.getTopLevelElement()

        if (top) {
          if ($isHeadingNode(top)) {
            setBlockType(top.getTag() as BlockType)
          } else if ($isQuoteNode(top)) {
            setBlockType('quote')
          } else if ($isListNode(top)) {
            setBlockType(top.getListType() === 'bullet' ? 'bullet' : 'number')
          } else {
            setBlockType('paragraph')
          }
        }

        const fmts = new Set<TextFmt>()
        if (selection.hasFormat('bold')) fmts.add('bold')
        if (selection.hasFormat('italic')) fmts.add('italic')
        if (selection.hasFormat('underline')) fmts.add('underline')
        if (selection.hasFormat('strikethrough')) fmts.add('strikethrough')
        if (selection.hasFormat('code')) fmts.add('code')
        setTextFmts(fmts)
      })
    })
  }, [editor])

  const toggleBlock = useCallback(
    (type: BlockType) => {
      const target = blockType === type ? 'paragraph' : type

      if (target === 'bullet') {
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
        return
      }
      if (target === 'number') {
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
        return
      }
      if (blockType === 'bullet' || blockType === 'number') {
        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
        if (target === 'paragraph') return
      }

      editor.update(() => {
        const sel = $getSelection()
        if (!$isRangeSelection(sel)) return
        if (target === 'paragraph') $setBlocksType(sel, () => $createParagraphNode())
        else if (target === 'h1') $setBlocksType(sel, () => $createHeadingNode('h1'))
        else if (target === 'h2') $setBlocksType(sel, () => $createHeadingNode('h2'))
        else if (target === 'h3') $setBlocksType(sel, () => $createHeadingNode('h3'))
        else if (target === 'quote') $setBlocksType(sel, () => $createQuoteNode())
      })
    },
    [editor, blockType],
  )

  const on = (f: TextFmt) => textFmts.has(f)
  const fmtBtn = (f: TextFmt) => () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, f)

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-md border border-border/60 bg-muted/20 p-1">
      {/* Undo / Redo */}
      <Button type="button" size="icon-sm" variant="ghost" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} {...tbMD}>
        <Undo2 className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" size="icon-sm" variant="ghost" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} {...tbMD}>
        <Redo2 className="h-3.5 w-3.5" />
      </Button>

      <ToolbarSep />

      {/* Block type */}
      <Toggle size="sm" pressed={blockType === 'h1'} onPressedChange={() => toggleBlock('h1')} {...tbMD} className="h-7 w-7 p-0">
        <Heading1 className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle size="sm" pressed={blockType === 'h2'} onPressedChange={() => toggleBlock('h2')} {...tbMD} className="h-7 w-7 p-0">
        <Heading2 className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle size="sm" pressed={blockType === 'h3'} onPressedChange={() => toggleBlock('h3')} {...tbMD} className="h-7 w-7 p-0">
        <Heading3 className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle size="sm" pressed={blockType === 'quote'} onPressedChange={() => toggleBlock('quote')} {...tbMD} className="h-7 w-7 p-0">
        <Quote className="h-3.5 w-3.5" />
      </Toggle>

      <ToolbarSep />

      {/* Text format */}
      <Toggle size="sm" pressed={on('bold')} onPressedChange={fmtBtn('bold')} {...tbMD} className="h-7 w-7 p-0">
        <Bold className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle size="sm" pressed={on('italic')} onPressedChange={fmtBtn('italic')} {...tbMD} className="h-7 w-7 p-0">
        <Italic className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle size="sm" pressed={on('underline')} onPressedChange={fmtBtn('underline')} {...tbMD} className="h-7 w-7 p-0">
        <Underline className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle size="sm" pressed={on('strikethrough')} onPressedChange={fmtBtn('strikethrough')} {...tbMD} className="h-7 w-7 p-0">
        <Strikethrough className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle size="sm" pressed={on('code')} onPressedChange={fmtBtn('code')} {...tbMD} className="h-7 w-7 p-0">
        <Code className="h-3.5 w-3.5" />
      </Toggle>

      <ToolbarSep />

      {/* Lists */}
      <Toggle size="sm" pressed={blockType === 'bullet'} onPressedChange={() => toggleBlock('bullet')} {...tbMD} className="h-7 w-7 p-0">
        <List className="h-3.5 w-3.5" />
      </Toggle>
      <Toggle size="sm" pressed={blockType === 'number'} onPressedChange={() => toggleBlock('number')} {...tbMD} className="h-7 w-7 p-0">
        <ListOrdered className="h-3.5 w-3.5" />
      </Toggle>
    </div>
  )
}

export function LexicalEditor({
  value,
  onChange,
  onPlainTextChange,
  placeholder = 'Enter content...',
  className,
}: {
  value: string
  onChange: (next: string) => void
  onPlainTextChange?: (plain: string) => void
  placeholder?: string
  className?: string
}) {
  const initialConfig = useMemo(
    () => {
      const normalized = normalizeLexicalJsonString(value)
      return {
        namespace: 'AdminInspirationLexicalEditor',
        editorState: normalized ?? undefined,
        onError(error: Error) {
          console.error('[lexical-editor]', error)
        },
        nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode],
        theme: {
          paragraph: 'mb-2 text-sm leading-relaxed last:mb-0',
          quote: 'my-2 border-l-2 border-border pl-3 text-sm text-muted-foreground',
          heading: {
            h1: 'mb-2 mt-3 text-base font-semibold first:mt-0',
            h2: 'mb-2 mt-3 text-sm font-semibold first:mt-0',
            h3: 'mb-2 mt-3 text-sm font-semibold first:mt-0',
          },
          list: {
            ul: 'mb-2 list-disc space-y-0.5 pl-5 text-sm',
            ol: 'mb-2 list-decimal space-y-0.5 pl-5 text-sm',
            listitem: '',
          },
          link: 'text-primary underline underline-offset-2',
          text: {
            bold: 'font-bold',
            italic: 'italic',
            underline: 'underline underline-offset-2',
            strikethrough: 'line-through',
            underlineStrikethrough: 'underline line-through underline-offset-2',
            code: 'rounded bg-muted/80 px-1 py-0.5 font-mono text-xs',
          },
        },
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={cn('rounded-md border border-border/70 bg-background', className)}>
        <EditorInner
          value={value}
          onChange={onChange}
          onPlainTextChange={onPlainTextChange}
          placeholder={placeholder}
        />
      </div>
    </LexicalComposer>
  )
}

function EditorInner({
  value,
  onChange,
  onPlainTextChange,
  placeholder,
}: {
  value: string
  onChange: (next: string) => void
  onPlainTextChange?: (plain: string) => void
  placeholder: string
}) {
  const [editor] = useLexicalComposerContext()

  return (
    <div className="space-y-2 p-2">
      <EditorToolbar editor={editor} />
      <RichTextPlugin
        contentEditable={
          <ContentEditable className="lexical-editor-content min-h-[220px] rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-sm leading-relaxed outline-none" />
        }
        placeholder={
          <div className="pointer-events-none px-3 py-2 text-sm text-muted-foreground">{placeholder}</div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <ListPlugin />
      <EditorStateSyncPlugin value={value} />
      <OnChangePlugin
        onChange={(editorState) => {
          const json = editorState.toJSON()
          const next = JSON.stringify(json)
          onChange(next)
          onPlainTextChange?.(lexicalTextContent(next))
        }}
      />
    </div>
  )
}

function EditorStateSyncPlugin({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const normalized = normalizeLexicalJsonString(value) ?? createLexicalTextContent('')
    const current = JSON.stringify(editor.getEditorState().toJSON())
    if (current === normalized) return

    try {
      const nextState = editor.parseEditorState(normalized)
      editor.setEditorState(nextState)
    } catch {
      // Ignore invalid external state updates.
    }
  }, [editor, value])

  return null
}

export function createLexicalTextContent(initialText = ''): string {
  const text = initialText.trim()
  const root: Record<string, unknown> = {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: null,
      children: text
        ? [
            {
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
                  text,
                  version: 1,
                },
              ],
            },
          ]
        : [
            {
              type: 'paragraph',
              format: '',
              indent: 0,
              version: 1,
              direction: null,
              children: [],
            },
          ],
    },
  }
  return JSON.stringify(root)
}

export function lexicalHasContent(value: string): boolean {
  const parsed = parseLexicalJson(value)
  if (!parsed) return false
  return lexicalTextContent(parsed).trim().length > 0
}
