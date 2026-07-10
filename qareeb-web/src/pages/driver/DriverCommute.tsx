import { useCallback, useEffect, useState } from 'react'
import Logo from '@/components/Logo'
import DriverNav from '@/components/DriverNav'
import { useAuth } from '@/store/AuthContext'
import { getService } from '@/data/services'
import {
  listDispatchedCommutes,
  listDriverCommutes,
  listCommuteMembers,
  acceptCommuteOrder,
} from '@/lib/commute'
import { subscribeToCommuteOrders } from '@/lib/realtime'
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

  useEffect(() => {
    void load()
    // Realtime: حدّث القوائم فور إرسال/قبول طلب ترحيل.
    const unsub = subscribeToCommuteOrders(load)
    return unsub
  }, [load])

  const empty = available.length === 0 && mine.length === 0

  return (
    <div className="screen">
      <header className="flex items-center gap-3 border-b-2 border-lemon px-4 py-4">
        <Logo variant="driver" size={36} rounded={10} />
        <h1 className="text-lg font-bold">طلبات الترحيل</h1>
      </header>

      <main className="flex-1 px-4 pt-4 pb-24">
        {loading ? (
          <div className="card h-28 animate-pulse" />
        ) : empty ? (
          <div className="flex flex-col items-center gap-2 py-24 text-center text-ink-soft">
            <div className="text-4xl">🚐</div>
            <p className="font-bold">لا توجد طلبات ترحيل حالياً</p>
          </div>
        ) : (
          <div className="space-y-5">
            {mine.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-ink-soft">رحلاتك المقبولة</h2>
                {mine.map((o) => (
                  <CommuteCard key={o.id} order={o} members={membersByOrder[o.id] ?? []} accepted />
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
}: {
  order: CommuteOrder
  members: CommuteMember[]
  accepted?: boolean
  busy?: boolean
  onAccept?: () => void
}) {
  const service = getService(o.service_id)
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="font-bold">{service?.name ?? o.service_id}</p>
        {accepted ? (
          <span className="chip bg-lemon/30 text-green-dark">مقبولة</span>
        ) : (
          <span className="chip-driver">{members.length} ركّاب</span>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        🏢 {o.dest_address ?? 'مكان العمل'} · ⏰ {o.scheduled_time}
        {o.round_trip ? ' · ذهاب وإياب' : ''}
      </p>
      <p className="text-xs text-ink-muted">📅 {o.days.join(' · ')}</p>

      <div className="mt-3 rounded-2xl bg-green-mint p-3">
        <p className="mb-1 text-xs font-bold text-ink-soft">نقاط الالتقاط</p>
        <ol className="space-y-1">
          {members.map((m, i) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-green text-[10px] text-white">
                {i + 1}
              </span>
              <span className="flex-1">{m.name}</span>
              <span className="text-xs text-ink-muted">{m.home_address ?? 'منزل'}</span>
            </li>
          ))}
        </ol>
      </div>

      {accepted ? (
        <p className="mt-3 text-center text-xs text-ink-muted">
          تواصَل مع الركّاب وابدأ رحلة الترحيل في موعدها.
        </p>
      ) : (
        <button onClick={onAccept} disabled={busy} className="btn-driver mt-3 w-full">
          {busy ? '…' : 'قبول الترحيل'}
        </button>
      )}
    </div>
  )
}
