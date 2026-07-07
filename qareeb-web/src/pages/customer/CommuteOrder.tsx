import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import Screen from '@/components/Screen'
import { getService } from '@/data/services'
import {
  getCommuteOrder,
  listCommuteMembers,
  dispatchCommuteOrder,
  inviteLink,
} from '@/lib/commute'
import type { CommuteOrder as Order, CommuteMember } from '@/lib/types'

/** ملخّص طلب الترحيل: الوجهة/الوقت/الأيام + رابط الدعوة + الأعضاء + الإرسال للسائق. */
export default function CommuteOrder() {
  const { id = '' } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [members, setMembers] = useState<CommuteMember[]>([])
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [o, m] = await Promise.all([getCommuteOrder(id), listCommuteMembers(id)])
    setOrder(o)
    setMembers(m)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (!order) {
    return (
      <Screen title="الترحيل" back>
        <p className="card p-6 text-center text-sm text-ink-muted">لم يُعثر على الطلب</p>
      </Screen>
    )
  }

  const service = getService(order.service_id)
  const link = inviteLink(order.invite_code)

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ترحيل قريب', text: 'انضم لمشوار الترحيل', url: link })
        return
      }
    } catch {
      /* المستخدم ألغى المشاركة */
    }
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const dispatch = async () => {
    setBusy(true)
    await dispatchCommuteOrder(order.id)
    await load()
    setBusy(false)
  }

  return (
    <Screen title="ترحيل مشترك" back>
      {/* ملخّص */}
      <div className="card space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="font-bold">{service?.name ?? order.service_id}</p>
          <span
            className={`chip ${order.status === 'dispatched' ? 'bg-green-soft text-green' : 'bg-gold-soft text-gold-deep'}`}
          >
            {order.status === 'dispatched' ? 'أُرسل للسائق' : 'قيد التجميع'}
          </span>
        </div>
        <Row icon="🏢" text={order.dest_address ?? 'مكان العمل'} />
        <Row icon="⏰" text={`الوصول ${order.scheduled_time}${order.round_trip ? ' · ذهاب وإياب' : ''}`} />
        <Row icon="📅" text={order.days.join(' · ')} />
      </div>

      {/* رابط الدعوة */}
      {order.status !== 'dispatched' && (
        <div className="card mt-4 space-y-2 p-4">
          <p className="font-bold">ادعُ الزملاء</p>
          <p className="text-xs text-ink-muted">شارك الرابط — كلٌّ يضيف منزله وينضم.</p>
          <div className="flex gap-2">
            <input className="field flex-1 text-left text-xs" dir="ltr" readOnly value={link} />
            <button className="btn-primary px-4" onClick={share}>
              {copied ? 'تم النسخ ✓' : 'مشاركة'}
            </button>
          </div>
        </div>
      )}

      {/* الأعضاء ونقاط الانطلاق */}
      <div className="card mt-4 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-bold">الركّاب ({members.length})</p>
          <button onClick={load} className="text-sm text-info underline">
            تحديث
          </button>
        </div>
        <div className="divide-y divide-hairline">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-green-soft text-sm">
                🏠
              </span>
              <div className="flex-1">
                <p className="font-medium">
                  {m.name}
                  {m.is_organizer && (
                    <span className="chip mr-2 bg-green-soft text-green">المنظّم</span>
                  )}
                </p>
                <p className="text-xs text-ink-muted">{m.home_address ?? 'منزل'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* الإرسال للسائق */}
      {order.status !== 'dispatched' ? (
        <button className="btn-primary mt-4 w-full" onClick={dispatch} disabled={busy}>
          {busy ? '…' : `أرسل الطلب المجمّع للسائق (${members.length} ركّاب)`}
        </button>
      ) : (
        <p className="mt-4 rounded-2xl bg-green-soft p-4 text-center text-sm text-green">
          تم إرسال الطلب المجمّع للسائق — سيتواصل معكم قبل الموعد.
        </p>
      )}
    </Screen>
  )
}

function Row({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span>{icon}</span>
      <span className="text-ink-soft">{text}</span>
    </div>
  )
}
