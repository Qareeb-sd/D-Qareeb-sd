import { useCallback, useEffect, useState } from 'react'
import Logo from '@/components/Logo'
import DriverNav from '@/components/DriverNav'
import { useAuth } from '@/store/AuthContext'
import { getService } from '@/data/services'
import { listDispatchedCommutes, listCommuteMembers, acceptCommuteOrder } from '@/lib/commute'
import { subscribeToCommuteOrders } from '@/lib/realtime'
import type { CommuteOrder, CommuteMember } from '@/lib/types'

/** واجهة السائق لطلبات الترحيل المجمّعة (كل المنازل + مكان العمل + الوقت). */
export default function DriverCommute() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState<CommuteOrder[]>([])
  const [membersByOrder, setMembersByOrder] = useState<Record<string, CommuteMember[]>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const os = await listDispatchedCommutes()
    const entries = await Promise.all(
      os.map(async (o) => [o.id, await listCommuteMembers(o.id)] as const),
    )
    setOrders(os)
    setMembersByOrder(Object.fromEntries(entries))
    setLoading(false)
  }, [])

  const accept = async (orderId: string) => {
    setBusyId(orderId)
    const { error } = await acceptCommuteOrder(orderId, profile?.id ?? 'demo-user')
    setBusyId(null)
    if (error) return alert(error)
    // الطلب يغادر قائمة "المُرسَلة" فور قبوله.
    setOrders((os) => os.filter((o) => o.id !== orderId))
  }

  useEffect(() => {
    void load()
    // Realtime: حدّث القائمة فور إرسال طلب ترحيل جديد.
    const unsub = subscribeToCommuteOrders(load)
    return unsub
  }, [load])

  return (
    <div className="screen">
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-4">
        <Logo variant="driver" size={36} rounded={10} />
        <h1 className="text-lg font-bold">طلبات الترحيل</h1>
      </header>

      <main className="flex-1 px-4 pt-4 pb-24">
        {loading ? (
          <div className="card h-28 animate-pulse" />
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-24 text-center text-ink-soft">
            <div className="text-4xl">🚐</div>
            <p className="font-bold">لا توجد طلبات ترحيل حالياً</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const service = getService(o.service_id)
              const members = membersByOrder[o.id] ?? []
              return (
                <div key={o.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{service?.name ?? o.service_id}</p>
                    <span className="chip bg-green-soft text-green">{members.length} ركّاب</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">
                    🏢 {o.dest_address ?? 'مكان العمل'} · ⏰ {o.scheduled_time}
                    {o.round_trip ? ' · ذهاب وإياب' : ''}
                  </p>
                  <p className="text-xs text-ink-muted">📅 {o.days.join(' · ')}</p>

                  {/* نقاط الالتقاط المجمّعة */}
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

                  <button
                    onClick={() => accept(o.id)}
                    disabled={busyId === o.id}
                    className="btn-primary mt-3 w-full"
                  >
                    {busyId === o.id ? '…' : 'قبول الترحيل'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <DriverNav />
    </div>
  )
}
