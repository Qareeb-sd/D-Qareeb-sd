import { useCallback, useEffect, useState } from 'react'
import { Bus, Building2, Clock, CalendarDays } from 'lucide-react'
import Logo from '@/components/Logo'
import DriverNav from '@/components/DriverNav'
import { useAuth } from '@/store/AuthContext'
import { getService } from '@/data/services'
import {
  listDispatchedCommutes,
  listDriverCommutes,
  listCommuteMembers,
  acceptCommuteOrder,
  settleCommuteDay,
} from '@/lib/commute'
import { subscribeToCommuteOrders } from '@/lib/realtime'
import { money } from '@/lib/format'
import type { CommuteOrder, CommuteMember } from '@/lib/types'

/** واجهة السائق لطلبات الترحيل: المقبولة لديك + المتاحة للقبول. */
export default function DriverCommute() {
  const { profile } = useAuth()
  const driverId = profile?.id ?? 'demo-user'
  const [available, setAvailable] = useState<CommuteOrder[]>([])
  const [mine, setMine] = useState<CommuteOrder[]>([])
  const [membersByOrder, setMembersByOrder] = useState<Record<string, CommuteMember[]>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [avail, own] = await Promise.all([
      listDispatchedCommutes(),
      listDriverCommutes(driverId),
    ])
    const all = [...own, ...avail]
    const entries = await Promise.all(
      all.map(async (o) => [o.id, await listCommuteMembers(o.id)] as const),
    )
    setAvailable(avail)
    setMine(own)
    setMembersByOrder(Object.fromEntries(entries))
    setLoading(false)
  }, [driverId])

  const accept = async (orderId: string) => {
    setBusyId(orderId)
    const { error } = await acceptCommuteOrder(orderId, driverId)
    setBusyId(null)
    if (error) return alert(error)
    void load()
  }

  const settleDay = async (orderId: string) => {
    setBusyId(orderId)
    const { result, error } = await settleCommuteDay(orderId)
    setBusyId(null)
    if (error) return alert(error)
    const r = result ?? { wallet_paid: 0, cash: 0, fallback_cash: 0 }
    alert(
      `تم تحصيل اليوم: ${r.wallet_paid} محفظة · ${r.cash} كاش/بنك` +
        (r.fallback_cash
          ? ` · ${r.fallback_cash} تحوّل لكاش/بنك (رصيد غير كافٍ — حصّل منهم مباشرةً)`
          : ''),
    )
    void load()
  }

  useEffect(() => {
    void load()
    // Realtime لطلباتك المقبولة (تصلك كسائق مُسنَد). أما الطلبات المُرسَلة
    // المتاحة فلا تصل عبر Realtime بعد إحكام الخصوصية (لست طرفاً فيها بعد)،
    // لذا نستطلع كل ٢٠ ثانية لتحديث المتاح.
    const unsub = subscribeToCommuteOrders(load)
    const iv = setInterval(() => void load(), 20000)
    return () => {
      unsub()
      clearInterval(iv)
    }
  }, [load])

  const empty = available.length === 0 && mine.length === 0

  return (
    <div className="screen font-plex bg-ivory">
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-4">
        <Logo variant="driver" size={36} rounded={10} />
        <h1 className="text-lg font-bold">طلبات الترحيل</h1>
      </header>

      <main className="flex-1 px-4 pt-4 pb-24">
        {loading ? (
          <div className="card h-28 animate-pulse" />
        ) : empty ? (
          <div className="flex flex-col items-center gap-2 py-24 text-center text-ink-soft">
            <Bus className="h-10 w-10 text-ink-soft" strokeWidth={2} />
            <p className="font-bold">لا توجد طلبات ترحيل حالياً</p>
          </div>
        ) : (
          <div className="space-y-5">
            {mine.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-ink-soft">رحلاتك المقبولة</h2>
                {mine.map((o) => (
                  <CommuteCard
                    key={o.id}
                    order={o}
                    members={membersByOrder[o.id] ?? []}
                    accepted
                    busy={busyId === o.id}
                    onSettleDay={() => settleDay(o.id)}
                  />
                ))}
              </section>
            )}

            {available.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-ink-soft">طلبات متاحة</h2>
                {available.map((o) => (
                  <CommuteCard
                    key={o.id}
                    order={o}
                    members={membersByOrder[o.id] ?? []}
                    busy={busyId === o.id}
                    onAccept={() => accept(o.id)}
                  />
                ))}
              </section>
            )}
          </div>
        )}
      </main>

      <DriverNav />
    </div>
  )
}

function CommuteCard({
  order: o,
  members,
  accepted,
  busy,
  onAccept,
  onSettleDay,
}: {
  order: CommuteOrder
  members: CommuteMember[]
  accepted?: boolean
  busy?: boolean
  onAccept?: () => void
  onSettleDay?: () => void
}) {
  const service = getService(o.service_id)
  const today = new Date().toISOString().slice(0, 10)
  const settledToday = o.last_settled === today
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="font-bold">{service?.name ?? o.service_id}</p>
        {accepted ? (
          <span className="chip bg-sand/25 text-royal">مقبولة</span>
        ) : (
          <span className="chip-driver">{members.length} ركّاب</span>
        )}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
        <Building2 className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={2} />
        {o.dest_address ?? 'مكان العمل'} ·{' '}
        <Clock className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={2} /> {o.scheduled_time}
        {o.round_trip ? ' · ذهاب وإياب' : ''}
      </p>
      <p className="flex items-center gap-1.5 text-xs text-ink-muted">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={2} />
        {o.days.join(' · ')}
      </p>

      <div className="mt-3 rounded-2xl bg-royal-soft p-3">
        <p className="mb-1 text-xs font-bold text-ink-soft">نقاط الالتقاط</p>
        <ol className="space-y-1">
          {members.map((m, i) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-royal text-[10px] text-white">
                {i + 1}
              </span>
              <span className="flex-1">{m.name}</span>
              {m.fare != null && m.fare > 0 && (
                <span className="text-[11px] font-bold text-royal">
                  {money(m.fare)}
                  <span className="font-normal text-ink-muted">
                    {' '}
                    · {m.pay_method === 'wallet' ? 'محفظة' : 'كاش/بنك'}
                  </span>
                </span>
              )}
              <span className="text-xs text-ink-muted">{m.home_address ?? 'منزل'}</span>
            </li>
          ))}
        </ol>
      </div>

      {accepted ? (
        o.plan === 'monthly' ? (
          <p className="mt-3 rounded-xl bg-royal-soft p-2.5 text-center text-xs text-royal">
            اشتراك شهري مدفوع مقدّماً — يُصرف لك نهاية الشهر. تواصَل مع الركّاب وابدأ في موعدها.
          </p>
        ) : (
          <button
            onClick={onSettleDay}
            disabled={busy || settledToday}
            className="btn-driver mt-3 w-full disabled:opacity-60"
          >
            {busy ? '…' : settledToday ? 'تم تحصيل اليوم ✓' : 'تم ترحيل اليوم (تحصيل)'}
          </button>
        )
      ) : (
        <button onClick={onAccept} disabled={busy} className="btn-driver mt-3 w-full">
          {busy ? '…' : 'قبول الترحيل'}
        </button>
      )}
    </div>
  )
}
