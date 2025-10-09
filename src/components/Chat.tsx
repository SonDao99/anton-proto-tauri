import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import ThemeToggle from '@/components/ThemeToggle'

type Role = 'user' | 'assistant' | 'tool'

type Message = {
  id: string
  role: Role
  content: string
}

// SSE frames (frontend view)

// type ToolEventFrame = { kind: 'tool_event'; tool?: string; args?: unknown; result?: unknown; error?: string }
// type MaybeEvent = { type?: unknown }

function Chat(): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I’m Anton. Ask me anything, or describe what you want me to do.'
    }
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const canceledRef = useRef(false)
  const [sessionId] = useState<string>(
    () => globalThis.crypto?.randomUUID?.() ?? String(Date.now())
  )
  // const esRef = useRef<EventSource | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const listRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Auto-scroll to bottom on new messages or when sending state changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length, sending])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    const next = Math.min(200, el.scrollHeight)
    el.style.height = `${next}px`
  }, [input])

  // Cleanup EventSource on unmount
  // useEffect(() => {
  //   return () => {
  //     try {
  //       esRef.current?.close()
  //     } catch { /* ignore */ void 0 }
  //     esRef.current = null
  //   }
  // }, [])

  // Setup WebSocket connection
  useEffect(() => {
    // const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${sessionId}`)
    const ws = new WebSocket(`ws://localhost:8000/ws/${sessionId}`)

    
    ws.onopen = () => {
      console.log('WebSocket connected')
    }

    ws.onmessage = (event) => {
      if (canceledRef.current) return
      
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'chunk' && data.content) {
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1]
            if (lastMsg && lastMsg.role === 'assistant' && sending) {
              return prev.map((m, idx) =>
                idx === prev.length - 1
                  ? { ...m, content: m.content + data.content }
                  : m
              )
            } else {
              return [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: data.content }]
            }
          })
        } else if (data.type === 'done') {
          // Streaming complete
          console.log('✅ Streaming complete')
          setSending(false)
        } else if (data.type === 'error') {
          console.error('❌ Backend error:', data.content)
          setSending(false)
          setMessages((prev) => [
            ...prev,
            { id: `e-${Date.now()}`, role: 'assistant', content: `[Error: ${data.content}]` }
          ])
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setSending(false)
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setSending(false)
    }

    wsRef.current = ws

    return () => {
      ws.close()
    }
  }, [sessionId])


  const hasMessages = useMemo(() => messages.length > 0, [messages.length])

  // const newChat = (): void => {
  //   try {
  //     esRef.current?.close()
  //   } catch { /* ignore */ void 0 }
  //   esRef.current = null
  //   canceledRef.current = false
  //   setSending(false)
  //   setMessages([
  //     {
  //       id: 'welcome',
  //       role: 'assistant',
  //       content: 'New chat started. How can I help? Use Shift+Enter for a newline.'
  //     }
  //   ])
  //   setInput('')
  // }

  const newChat = (): void => {
  canceledRef.current = false
  setSending(false)
  setMessages([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'New chat started. How can I help? Use Shift+Enter for a newline.'
    }
  ])
  setInput('')
}


  const stop = (): void => {
    if (!sending) return
    canceledRef.current = true
    try {
      // esRef.current?.close()
      wsRef.current?.close()
    } catch { /* ignore */ void 0 }
    // esRef.current = null
    wsRef.current = null
    setSending(false)
  }

  // const send = async (): Promise<void> => {
  //   const text = input.trim()
  //   if (!text || sending) return

  //   const userMsg: Message = {
  //     id: `u-${Date.now()}`,
  //     role: 'user',
  //     content: text
  //   }

  //   setMessages((prev) => [...prev, userMsg])
  //   setInput('')
  //   setSending(true)
  //   canceledRef.current = false

  //   const assistantId = `a-${Date.now()}`

  //   try {
  //     const es = window.api.chatStream(sessionId, text, {
  //       onToolEvent: (evt: ToolEventFrame) => {
  //         if (canceledRef.current) return
  //         const pretty = typeof evt === 'string' ? evt : JSON.stringify(evt)
  //         setMessages((prev) => [...prev, { id: `t-${Date.now()}`, role: 'tool', content: pretty }])
  //       },
  //       onDelta: (t) => {
  //         if (canceledRef.current) return
  //         const id = assistantId
  //         setMessages((prev) => {
  //           const i = prev.findIndex((m) => m.id === id)
  //           if (i === -1) {
  //             return [...prev, { id, role: 'assistant', content: t }]
  //           }
  //           return prev.map((m) => (m.id === id ? { ...m, content: m.content + t } : m))
  //         })
  //       },
  //       // Align with server "final" shape: { kind: "final", message, actions, tool_calls }
  //       onFinal: (f) => {
  //         if (canceledRef.current) return
  //         const id = assistantId
  //         setMessages((prev) => {
  //           const i = prev.findIndex((m) => m.id === id)
  //           if (i === -1) {
  //             return [...prev, { id, role: 'assistant', content: f?.message ?? '' }]
  //           }
  //           return prev.map((m) => (m.id === id ? { ...m, content: f?.message ?? m.content } : m))
  //         })
  //         setSending(false)
  //         try {
  //           esRef.current?.close()
  //         } catch { /* ignore */ void 0 }
  //         esRef.current = null
  //       },
  //       onError: (err: unknown) => {
  //         if (canceledRef.current) return
  //         // Avoid logging raw Event objects without context
  //         let reason = 'unknown'
  //         if (err instanceof Error) {
  //           reason = err.message
  //         } else if (typeof err === 'object' && err && 'type' in (err as object)) {
  //           const ev = err as MaybeEvent
  //           reason = typeof ev.type === 'string' ? ev.type : String(ev.type)
  //         }
  //         console.error('SSE stream error', { reason })
  //         setSending(false)
  //         const id = assistantId
  //         setMessages((prev) => {
  //           const i = prev.findIndex((m) => m.id === id)
  //           if (i === -1) {
  //             return [...prev, { id, role: 'assistant', content: '\n[stream error]' }]
  //           }
  //           return prev.map((m) => (m.id === id ? { ...m, content: (m.content || '') + '\n[stream error]' } : m))
  //         })
  //         try {
  //           esRef.current?.close()
  //         } catch { /* ignore */ void 0 }
  //         esRef.current = null
  //       }
  //     })
  //     esRef.current = es
  //   } catch (e) {
  //     console.error(e)
  //     setSending(false)
  //   }
  // }

  const send = async (): Promise<void> => {
    const text = input.trim()
    if (!text || sending || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)
    canceledRef.current = false

    try {
      wsRef.current.send(JSON.stringify({ message: text }))
      
      // Auto-stop after response completes (timeout-based)
      setTimeout(() => {
        if (sending && !canceledRef.current) {
          setSending(false)
        }
      }, 30000) // 30 second timeout
    } catch (e) {
      console.error(e)
      setSending(false)
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: 'assistant', content: '[Error sending message]' }
      ])
    }
  }


  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      {/* Header (sticky) */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold">Anton AI</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button size="sm" onClick={newChat}>
            New Chat
          </Button>
          {sending ? (
            <Button variant="destructive" size="sm" onClick={stop}>
              Stop
            </Button>
          ) : null}
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-auto px-4 py-4">
        {!hasMessages ? (
          <div className="mt-20 text-center text-sm text-muted-foreground">
            Start a conversation by typing below.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} />
            ))}
            {sending ? <TypingBubble /> : null}
          </div>
        )}
      </div>

      {/* Composer (sticky bottom) */}
      <div className="sticky bottom-0 z-10 border-t bg-background/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-end gap-2 items-center">
          <div className="flex-1">
            <div className="rounded-xl border border-input bg-background px-3 py-2">
              <Textarea
                ref={textareaRef}
                className="resize-none"
                placeholder="Message the agent..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={sending}
                rows={1}
              />
            </div>
          </div>
          <Button onClick={send} disabled={sending || input.trim().length === 0} size="lg">
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ role, content }: { role: Role; content: string }): React.JSX.Element | null {
  if (!content) return null
  const isUser = role === 'user'
  const bubbleClass = isUser
    ? 'bg-blue-600 text-white'
    : role === 'tool'
      ? 'bg-muted text-foreground border border-input'
      : 'bg-muted text-foreground'
  return (
    <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed text-left ${bubbleClass}`}
      >
        <RenderMessage content={content} />
      </div>
    </div>
  )
}

/**
 * Simple Markdown-ish renderer:
 * - Supports code fences ```lang\n...\n```
 * - Supports inline code `code`
 * - Paragraph breaks on blank lines
 */
function RenderMessage({ content }: { content: string }): React.JSX.Element {
  const blocks = useMemo(() => parseBlocks(content), [content])
  return (
    <div className="prose max-w-none dark:prose-invert prose-pre:my-2 prose-pre:p-0">
      {blocks.map((b, i) =>
        b.type === 'code' ? (
          <pre
            key={`code-${i}`}
            className="overflow-auto rounded-md bg-black/80 p-3 text-sm text-gray-100"
          >
            <code className={`language-${b.lang ?? 'text'}`.trim()}>{b.code}</code>
          </pre>
        ) : (
          <Paragraph key={`p-${i}`} text={b.text} />
        )
      )}
    </div>
  )
}

function Paragraph({ text }: { text: string }): React.JSX.Element {
  // naive inline code: wrap `code` spans
  const parts = text.split(/`([^`]+)`/g)
  return (
    <p className="mb-2 last:mb-0">
      {parts.map((part, idx) =>
        idx % 2 === 1 ? (
          <code key={idx} className="rounded bg-muted px-1 py-0.5 text-[12px]">
            {part}
          </code>
        ) : (
          <span key={idx}>{part}</span>
        )
      )}
    </p>
  )
}

function parseBlocks(
  input: string
): Array<{ type: 'text'; text: string } | { type: 'code'; lang?: string; code: string }> {
  const fence = '```'
  const out: Array<{ type: 'text'; text: string } | { type: 'code'; lang?: string; code: string }> =
    []

  let rest = input
  while (true) {
    const start = rest.indexOf(fence)
    if (start === -1) {
      if (rest.length) out.push({ type: 'text', text: rest })
      break
    }
    const before = rest.slice(0, start)
    if (before.trim().length) out.push({ type: 'text', text: before })
    const afterStart = start + fence.length
    const end = rest.indexOf(fence, afterStart)
    if (end === -1) {
      // no closing fence; treat remainder as text
      out.push({ type: 'text', text: rest })
      break
    }
    const fenced = rest.slice(afterStart, end)
    const nl = fenced.indexOf('\n')
    let lang: string | undefined
    let code: string
    if (nl !== -1) {
      lang = fenced.slice(0, nl).trim() || undefined
      code = fenced.slice(nl + 1)
    } else {
      code = fenced
    }
    out.push({ type: 'code', lang, code })
    rest = rest.slice(end + fence.length)
  }

  // Split text blocks on double newlines into paragraphs
  const expanded: Array<
    { type: 'text'; text: string } | { type: 'code'; lang?: string; code: string }
  > = []
  for (const b of out) {
    if (b.type === 'text') {
      const paras = b.text.split(/\n{2,}/g)
      for (const p of paras) {
        if (p.length) expanded.push({ type: 'text', text: p })
      }
    } else {
      expanded.push(b)
    }
  }
  return expanded
}

function TypingBubble(): React.JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-muted px-4 py-3 text-sm">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-foreground [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-foreground [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-foreground [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  )
}

export default Chat
