import { useQuery } from '@tanstack/react-query'
import { FileText, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Logo from '@/components/Logo'
import DriverNav from '@/components/DriverNav'
import { useAuth } from '@/store/AuthContext'
import { getDriverWeeklyStatement } from '@/lib/api'
import { money } from '@/lib/format'
import type { WeeklyStatement } from '@/lib/api'

/** كشف حساب أسبوعي للسائق: أرباح كل أسبوع، العمولة، والصافي. */
export default function DriverStatement() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const userId = profile?.id ?? 'demo-user'

  const {
    data: weeks,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['driver-statement', userId],
    queryFn: () => getDriverWeeklyStatement(8),
  })

  return (
    <div className="screen font-plex bg-ivory">
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-4">
        <button onClick={() => navigate(-1)} aria-label="رجوع" className="text-ink-soft">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Logo variant="driver" size={36} rounded={10} />
        <h1 className="text-lg font-bold">كشف الحساب الأسبوعي</h1>
      </header>

      <main className="flex-1 px-4 pb-24">
        <p className="mb-3 mt-1 flex items-center gap-2 text-sm text-ink-muted">
          <FileText className="h-4 w-4" strokeWidth={2} />
          ملخّص أرباحك لكل أسبوع (السبت → الجمعة)
        </p>

        {isError ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-ink-soft">تعذّر تحميل كشف الحساب.</p>
            <button onClick={() => void refetch()} className="mt-3 text-sm font-bold text-royal">
              إعادة المحاولة
            </button>
          </div>
        ) : weeks === undefined ? (
          <div className="card h-28 animate-pulse" />
        ) : weeks.length === 0 || weeks.every((w) => w.rides === 0) ? (
          <p className="card p-6 text-center text-sm text-ink-muted">لا توجد رحلات مكتملة بعد</p>
        ) : (
          <div className="space-y-3">
            {weeks
              .filter((w) => w.rides > 0)
              .map((w) => (
                <WeekCard key={w.week_start} w={w} />
              ))}
          </div>
        )}
      </main>

      <DriverNav />
    </div>
  )
}

function WeekCard({ w }: { w: WeeklyStatement }) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('ar-SD', { day: 'numeric', month: 'short' })
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="font-bold text-royal">
          {fmt(w.week_start)} — {fmt(w.week_end)}
        </p>
        <span className="rounded-md bg-sand-soft px-2 py-0.5 text-xs font-bold text-sand-ink">
          {w.rides} رحلة
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-ivory p-2.5">
          <p className="text-sm font-extrabold text-royal">{money(w.gross)}</p>
          <p className="text-[11px] text-ink-muted">إجمالي الأجرة</p>
        </div>
        <div className="rounded-xl bg-ivory p-2.5">
          <p className="text-sm font-extrabold text-danger">−{money(w.commission)}</p>
          <p className="text-[11px] text-ink-muted">العمولة</p>
        </div>
        <div className="rounded-xl bg-green-soft p-2.5">
          <p className="text-sm font-extrabold text-green">{money(w.net)}</p>
          <p className="text-[11px] text-ink-muted">صافي لك</p>
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink-muted">
        <span>كاش: {money(w.cash_gross)}</span>
        <span>محفظة: {money(w.wallet_gross)}</span>
      </div>
    </div>
  )
}
