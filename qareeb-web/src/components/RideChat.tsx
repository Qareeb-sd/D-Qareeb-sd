import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import { listRideMessages, sendRideMessage } from '@/lib/api'
import { subscribeToRideMessages } from '@/lib/realtime'
import type { RideMessage } from '@/lib/types'

/**
 * محادثة داخل الرحلة — زر يفتح لوحة دردشة بين العميل والسائق.
 * يعتمد Realtime مع استقصاء احتياطي كل 4 ثوانٍ (متانة كحال بقية التدفّق).
 */
export default function RideChat({
  rideId,
  myId,
  role,
  otherName,
}: {
  rideId: string
  myId: string
  role: 'customer' | 'driver'
  otherName: string
}) {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<RideMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [lastSeen, setLastSeen] = useState(0) // عدد الرسائل المقروءة
  const listRef = useRef<HTMLDivElement>(null)

  const merge = (incoming: RideMessage[]) =>
    setMsgs((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]))
      for (const m of incoming) map.set(m.id, m)
      return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))
    })

  // جلب أولي + استقصاء احتياطي + اشتراك فوري
  useEffect(() => {
    if (!rideId) return
    let alive = true
    void listRideMessages(rideId).then((m) => alive && merge(m))
    const unsub = subscribeToRideMessages(rideId, (m) => merge([m]))
    const poll = setInterval(() => {
      void listRideMessages(rideId).then((m) => alive && merge(m))
    }, 4000)
    return () => {
      alive = false
      clearInterval(poll)
      unsub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId])

  // تمرير لأسفل عند وصول رسائل والّلوحة مفتوحة
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    if (open) setLastSeen(msgs.length)
  }, [msgs, open])

  const unread = msgs.filter((m, i) => i >= lastSeen && m.sender_id !== myId).length

  const send = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setText('')
    const { error } = await sendRideMessage(rideId, myId, role, body)
    setSending(false)
    if (error) {
      setText(body) // إعادة النص عند الفشل
      return
    }
    void listRideMessages(rideId).then(merge)
  }

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ar-SD', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="press-scale relative flex items-center gap-1.5 rounded-2xl bg-green px-4 py-2 text-sm font-bold text-white"
      >
        <MessageCircle className="h-4 w-4" strokeWidth={2} />
        محادثة
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[950] flex flex-col justify-end bg-black/40 font-plex">
          <button className="flex-1" onClick={() => setOpen(false)} aria-label="إغلاق" />
          <div className="flex h-[75vh] flex-col rounded-t-[24px] bg-white shadow-soft">
            {/* رأس */}
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <div>
                <p className="font-bold text-royal">{otherName}</p>
                <p className="text-[11px] text-ink-muted">محادثة الرحلة</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-ivory text-ink-soft"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            {/* الرسائل */}
            <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {msgs.length === 0 ? (
                <p className="mt-8 text-center text-sm text-ink-muted">
                  لا رسائل بعد. اكتب رسالة للتنسيق حول نقطة الالتقاء.
                </p>
              ) : (
                msgs.map((m) => {
                  const mine = m.sender_id === myId
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                          mine
                            ? 'rounded-br-md bg-green text-white'
                            : 'rounded-bl-md bg-ivory text-ink'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p
                          className={`mt-0.5 text-left text-[10px] ${
                            mine ? 'text-white/70' : 'text-ink-muted'
                          }`}
                          dir="ltr"
                        >
                          {fmtTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* إدخال */}
            <div className="flex items-center gap-2 border-t border-hairline px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
              <input
                className="field flex-1"
                placeholder="اكتب رسالة…"
                maxLength={500}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void send()
                  }
                }}
              />
              <button
                onClick={() => void send()}
                disabled={!text.trim() || sending}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-green text-white disabled:opacity-50"
                aria-label="إرسال"
              >
                <Send className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
