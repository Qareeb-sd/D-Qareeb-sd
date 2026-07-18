import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, Plus, ChevronLeft, MessageSquare } from 'lucide-react'
import {
  listMySupportTickets,
  listSupportMessages,
  openSupportTicket,
  sendSupportMessage,
} from '@/lib/api'
import type { SupportTicket } from '@/lib/types'

/** محادثة الدعم داخل التطبيق — قائمة التذاكر + المحادثة + فتح تذكرة جديدة.
 *  مشترَك بين تطبيق العميل والسائق. */
export default function SupportChat() {
  const qc = useQueryClient()
  const [active, setActive] = useState<SupportTicket | null>(null)
  const [composing, setComposing] = useState(false)

  const {
    data: tickets,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: listMySupportTickets,
    refetchInterval: 20000,
  })

  if (composing)
    return (
      <NewTicket
        onDone={() => {
          setComposing(false)
          void refetch()
        }}
        onCancel={() => setComposing(false)}
      />
    )
  if (active)
    return (
      <Thread
        ticket={active}
        onBack={() => {
          setActive(null)
          void qc.invalidateQueries({ queryKey: ['support-tickets'] })
        }}
      />
    )

  return (
    <div>
      <button
        onClick={() => setComposing(true)}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-royal py-3 font-bold text-white"
      >
        <Plus className="h-5 w-5" strokeWidth={2.2} />
        محادثة جديدة مع الدعم
      </button>

      {isError ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-ink-soft">تعذّر تحميل المحادثات.</p>
          <button onClick={() => void refetch()} className="mt-3 text-sm font-bold text-royal">
            إعادة المحاولة
          </button>
        </div>
      ) : tickets === undefined ? (
        <div className="card h-20 animate-pulse" />
      ) : tickets.length === 0 ? (
        <div className="card p-6 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-ink-muted" strokeWidth={1.6} />
          <p className="mt-2 text-sm text-ink-muted">
            لا توجد محادثات — ابدأ محادثة إن احتجت مساعدة.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t)}
              className="card flex w-full items-center gap-3 p-4 text-right"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-bold text-ink">
                  {t.subject}
                  {t.unread_user && <span className="h-2 w-2 rounded-full bg-danger" />}
                </p>
                <p className="text-xs text-ink-muted">
                  {t.status === 'closed' ? 'مغلقة' : 'مفتوحة'} ·{' '}
                  {new Date(t.last_message_at).toLocaleDateString('ar-SD')}
                </p>
              </div>
              <ChevronLeft className="h-5 w-5 shrink-0 text-ink-muted" strokeWidth={2} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** فتح تذكرة جديدة. */
function NewTicket({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setErr('')
    if (!subject.trim() || !body.trim()) return setErr('اكتب الموضوع والرسالة')
    setBusy(true)
    const { error } = await openSupportTicket(subject.trim(), body.trim())
    setBusy(false)
    if (error) return setErr(error)
    onDone()
  }

  return (
    <div className="card space-y-3 p-4">
      <p className="font-bold text-ink">محادثة جديدة</p>
      <input
        className="field"
        placeholder="الموضوع (مثال: مشكلة في الدفع)"
        maxLength={120}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <textarea
        className="field min-h-[120px] resize-none"
        placeholder="اشرح مشكلتك أو استفسارك…"
        maxLength={1000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {err && <p className="text-sm text-danger">{err}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="flex-1 rounded-2xl bg-royal py-3 font-bold text-white disabled:opacity-60"
        >
          {busy ? '…' : 'إرسال'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-2xl border border-hairline px-4 py-3 text-sm font-bold text-ink-soft"
        >
          إلغاء
        </button>
      </div>
    </div>
  )
}

/** محادثة تذكرة واحدة. */
function Thread({ ticket, onBack }: { ticket: SupportTicket; onBack: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const {
    data: messages,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['support-messages', ticket.id],
    queryFn: () => listSupportMessages(ticket.id),
    refetchInterval: 8000,
  })

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    setText('')
    const { error } = await sendSupportMessage(ticket.id, body)
    setBusy(false)
    if (error) {
      setText(body)
      return alert(error)
    }
    void refetch()
  }

  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="mb-3 flex items-center gap-2">
        <button onClick={onBack} aria-label="رجوع" className="text-ink-soft">
          <ChevronLeft className="h-5 w-5 rotate-180" />
        </button>
        <p className="flex-1 truncate font-bold text-ink">{ticket.subject}</p>
        {ticket.status === 'closed' && (
          <span className="rounded-md bg-ink-muted/10 px-2 py-0.5 text-xs font-bold text-ink-muted">
            مغلقة
          </span>
        )}
      </div>

      <div className="min-h-[240px] flex-1 space-y-2 overflow-y-auto rounded-2xl bg-ivory p-3">
        {isError ? (
          <div className="py-8 text-center">
            <p className="text-sm text-ink-soft">تعذّر تحميل الرسائل.</p>
            <button onClick={() => void refetch()} className="mt-2 text-sm font-bold text-royal">
              إعادة المحاولة
            </button>
          </div>
        ) : messages === undefined ? (
          <div className="h-16 animate-pulse rounded-xl bg-white" />
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">
            لا رسائل بعد — اكتب رسالتك وسيردّ عليك الدعم.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.sender === 'user' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.sender === 'user'
                    ? 'bg-royal text-white'
                    : 'border border-hairline bg-white text-ink'
                }`}
              >
                {m.sender === 'admin' && (
                  <p className="mb-0.5 text-[10px] font-bold text-green">الدعم</p>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                <p
                  className={`mt-0.5 text-[10px] ${
                    m.sender === 'user' ? 'text-white/70' : 'text-ink-muted'
                  }`}
                >
                  {new Date(m.created_at).toLocaleTimeString('ar-SD', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          className="field flex-1"
          placeholder="اكتب رسالتك…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send()
          }}
        />
        <button
          onClick={() => void send()}
          disabled={busy || !text.trim()}
          aria-label="إرسال"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-royal text-white disabled:opacity-50"
        >
          <Send className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
