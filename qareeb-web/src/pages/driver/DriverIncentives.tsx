import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Trophy, CheckCircle2, Gift } from 'lucide-react'
import Logo from '@/components/Logo'
import { useAuth } from '@/store/AuthContext'
import { getMyIncentives } from '@/lib/api'
import { money } from '@/lib/format'
import type { MyIncentive } from '@/lib/types'

const periodLabel: Record<MyIncentive['period'], string> = {
  daily: 'يومي',
  weekly: 'أسبوعي',
}

/** حوافز الكابتن — أهداف يومية/أسبوعية تضبطها الإدارة مع مكافأة تلقائية للرصيد. */
export default function DriverIncentives() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const userId = profile?.id ?? 'demo-user'
  const { data: incentives, isLoading } = useQuery({
    queryKey: ['my-incentives', userId],
    queryFn: getMyIncentives,
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
  })

  return (
    <div className="screen font-plex bg-ivory">
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-4">
        <button onClick={() => navigate(-1)} className="grid h-9 w-9 place-items-center rounded-full bg-ivory">
          <ChevronRight className="h-5 w-5 text-royal" strokeWidth={2} />
        </button>
        <Logo variant="driver" size={32} rounded={9} />
        <h1 className="text-lg font-bold">حوافزي ومكافآتي</h1>
      </header>

      <main className="flex-1 px-4 pb-10 pt-4">
        <p className="mb-4 rounded-2xl bg-sand-soft/60 px-4 py-3 text-[13px] text-royal">
          أكمل عدد الرحلات المطلوب خلال الفترة لتُضاف المكافأة إلى رصيدك تلقائياً.
        </p>

        {isLoading ? (
          <div className="space-y-3">
            <div className="card h-28 animate-pulse" />
            <div className="card h-28 animate-pulse" />
          </div>
        ) : !incentives || incentives.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 p-8 text-center">
            <Gift className="h-10 w-10 text-ink-muted" strokeWidth={1.5} />
            <p className="text-sm text-ink-muted">لا توجد حوافز فعّالة حالياً. تابعنا قريباً!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incentives.map((inc) => (
              <IncentiveCard key={inc.id} inc={inc} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function IncentiveCard({ inc }: { inc: MyIncentive }) {
  const done = Math.min(inc.progress, inc.target_rides)
  const pct = Math.min(100, Math.round((inc.progress / inc.target_rides) * 100))
  const remaining = Math.max(0, inc.target_rides - inc.progress)

  return (
    <div
      className={`card p-4 ${inc.claimed ? 'border border-green/40 bg-green-soft/30' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-bold text-royal">
            <Trophy className="h-4 w-4 text-sand-ink" strokeWidth={2} />
            {inc.title}
          </p>
          <span className="mt-1 inline-block chip bg-sand-soft text-xs text-sand-ink">
            {periodLabel[inc.period]}
          </span>
        </div>
        <div className="shrink-0 text-left">
          <p className="text-xs text-ink-muted">المكافأة</p>
          <p className="font-extrabold text-green">{money(inc.reward)}</p>
        </div>
      </div>

      {/* شريط التقدّم */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-bold text-royal">
            {done} / {inc.target_rides} رحلة
          </span>
          {inc.claimed ? (
            <span className="flex items-center gap-1 font-bold text-green">
              <CheckCircle2 className="h-4 w-4" /> تم المنح
            </span>
          ) : remaining === 0 ? (
            <span className="font-bold text-green">اكتمل — بانتظار الإضافة</span>
          ) : (
            <span className="text-ink-muted">باقٍ {remaining}</span>
          )}
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-hairline">
          <div
            className={`h-full rounded-full transition-all ${inc.claimed ? 'bg-green' : 'bg-sand-ink'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
