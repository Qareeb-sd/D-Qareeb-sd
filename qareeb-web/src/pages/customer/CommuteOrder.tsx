import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Building2, Clock, Calendar, Users, House, Wallet, type LucideIcon } from 'lucide-react'
import Screen from '@/components/Screen'
import { getService } from '@/data/services'
import { money } from '@/lib/format'
import {
  getCommuteOrder,
  listCommuteMembers,
  dispatchCommuteOrder,
  inviteLink,
  inviteShareText,
} from '@/lib/commute'
import { subscribeToCommuteMembers } from '@/lib/realtime'
import { useAuth } from '@/store/AuthContext'
import type { CommuteOrder as Order, CommuteMember } from '@/lib/types'

/** ملخّص طلب الترحيل: الوجهة/الوقت/الأيام + رابط الدعوة + الأعضاء + الإرسال للسائق. */
export default function CommuteOrder() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
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
    // Realtime: حدّث القائمة فور انضمام راكب جديد.
    const unsub = subscribeToCommuteMembers(id, load)
    return unsub
  }, [id, load])

  if (!order) {
    return (
      <Screen title="الترحيل" back>
        <p className="card p-6 text-center text-sm text-ink-muted">لم يُعثر على الطلب</p>
      </Screen>
    )
  }

  const service = getService(order.service_id)
  const code = order.invite_code
  const link = inviteLink(code)
  const shareText = inviteShareText(code)

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'ترحيل قريب',
          text: shareText,
          ...(link ? { url: link } : {}),
        })
        return
      }
    } catch {
      /* المستخدم ألغى المشاركة */
    }
    try {
      await navigator.clipboard.writeText(shareText)
    } catch {
      /* لا حرج — الرمز ظاهر */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  // المنظّم فقط من يرسل الطلب المجمّع للسائق (بقية الركّاب يشاهدون الحالة فقط).
  const isOrganizer = order.organizer_id != null && order.organizer_id === profile?.id

  const dispatch = async () => {
    setBusy(true)
    try {
      await dispatchCommuteOrder(order.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'تعذّر إرسال الطلب للسائق، تحقّق من اتصالك وحاول مجدداً.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="ترحيل مشترك" back>
      {/* ملخّص */}
      <div className="card space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="font-bold">{service?.name ?? order.service_id}</p>
          <span
            className={`chip ${order.status === 'dispatched' ? 'bg-royal-soft text-royal' : 'bg-gold-soft text-gold-deep'}`}
          >
            {order.status === 'dispatched' ? 'أُرسل للسائق' : 'قيد التجميع'}
          </span>
        </div>
        <Row icon={Building2} text={order.dest_address ?? 'مكان العمل'} />
        <Row
          icon={Clock}
          text={`الذهاب ${order.scheduled_time}${
            order.round_trip && order.return_time ? ` · الإياب ${order.return_time}` : ''
          }`}
        />
        <Row icon={Calendar} text={order.days.join(' · ')} />
        <Row icon={Users} text={`الركّاب ${members.length} / ${service?.seats ?? 4}`} />
        <Row
          icon={Wallet}
          text={order.plan === 'monthly' ? 'اشتراك شهري (دفع مقدّم)' : 'دفع يومي (محفظة أو كاش/بنك للسائق)'}
        />
      </div>

      {/* دعوة الزملاء بالرمز */}
      {order.status !== 'dispatched' && (
        <div className="card mt-4 space-y-3 p-4">
          <p className="font-bold text-royal">ادعُ الزملاء</p>
          <p className="text-xs text-ink-muted">
            شارك رمز الدعوة — كلٌّ يفتح «قريب ← ترحيل ← انضمام برمز» ويضيف منزله.
          </p>
          {/* الرمز بارز */}
          <div className="flex items-center justify-center rounded-2xl bg-royal-soft py-3">
            <span dir="ltr" className="text-2xl font-extrabold tracking-[0.35em] text-royal">
              {code}
            </span>
          </div>
          <button
            className="btn-primary w-full"
            onClick={share}
          >
            {copied ? 'تم النسخ ✓' : 'مشاركة رمز الدعوة'}
          </button>
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
              <span className="grid h-9 w-9 place-items-center rounded-full bg-royal-soft text-royal">
                <House className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <div className="flex-1">
                <p className="font-medium">
                  {m.name}
                  {m.is_organizer && (
                    <span className="chip mr-2 bg-royal-soft text-royal">المنظّم</span>
                  )}
                </p>
                <p className="text-xs text-ink-muted">{m.home_address ?? 'منزل'}</p>
              </div>
              {m.fare != null && m.fare > 0 && (
                <div className="shrink-0 text-left">
                  <p className="text-sm font-bold text-royal">{money(m.fare)}</p>
                  <p className="text-[10px] text-ink-muted">
                    {order.plan === 'monthly'
                      ? m.sub_status === 'ended'
                        ? 'انتهى'
                        : 'يومياً'
                      : m.pay_method === 'wallet'
                        ? 'محفظة'
                        : 'كاش/بنك'}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* الإرسال للسائق — المنظّم فقط، والبقية يرون حالة الطلب */}
      {order.status === 'dispatched' ? (
        <p className="mt-4 rounded-2xl bg-royal-soft p-4 text-center text-sm text-royal">
          تم إرسال الطلب المجمّع للسائق — سيتواصل معكم قبل الموعد.
        </p>
      ) : isOrganizer ? (
        <button className="btn-primary mt-4 w-full" onClick={dispatch} disabled={busy}>
          {busy ? '…' : `أرسل الطلب المجمّع للسائق (${members.length} ركّاب)`}
        </button>
      ) : (
        <p className="mt-4 rounded-2xl bg-gold-soft p-4 text-center text-sm text-gold-deep">
          بانتظار أن يرسل المنظّم الطلب المجمّع للسائق.
        </p>
      )}
    </Screen>
  )
}

function Row({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-sand-ink" strokeWidth={1.8} />
      <span className="text-ink-soft">{text}</span>
    </div>
  )
}
