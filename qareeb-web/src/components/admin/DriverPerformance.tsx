import { useEffect, useState } from 'react'
import { Star, TrendingUp } from 'lucide-react'
import { getDriverPerformance, type DriverPerf } from '@/lib/api'
import { money, num } from '@/lib/format'
import { exportCsv } from '@/lib/csv'

const RANGES = [
  { days: 7, label: '٧ أيام' },
  { days: 30, label: '٣٠ يوماً' },
  { days: 90, label: '٩٠ يوماً' },
]

/** لوحة أداء السائقين: رحلات/تقييم/إيرادات/إلغاءات مرتّبة. */
export default function DriverPerformance() {
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState<DriverPerf[] | null>(null)

  useEffect(() => {
    setRows(null)
    void getDriverPerformance(days).then(setRows)
  }, [days])

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-bold">
          <TrendingUp className="h-5 w-5 text-green" strokeWidth={2} />
          أداء السائقين
        </p>
        <div className="flex items-center gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                days === r.days ? 'bg-green text-white' : 'bg-ivory text-ink-soft'
              }`}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() =>
              rows &&
              exportCsv(
                'driver-performance',
                [
                  { key: 'name', label: 'السائق' },
                  { key: 'phone', label: 'الهاتف' },
                  { key: 'rating', label: 'التقييم' },
                  { key: 'rides', label: 'الرحلات' },
                  { key: 'earnings', label: 'الإيرادات' },
                  { key: 'cancels', label: 'الإلغاءات' },
                ],
                rows.map((r) => ({
                  name: r.name ?? '',
                  phone: r.phone,
                  rating: r.rating ?? '',
                  rides: r.rides,
                  earnings: Math.round(r.earnings),
                  cancels: r.cancels,
                })),
              )
            }
            className="rounded-full border border-hairline px-3 py-1 text-xs font-bold text-royal"
          >
            CSV
          </button>
        </div>
      </div>

      {rows === null ? (
        <div className="h-24 animate-pulse rounded-xl bg-ivory" />
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">لا بيانات في هذه المدّة.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-right text-sm">
            <thead>
              <tr className="border-b border-hairline text-xs text-ink-muted">
                <th className="py-2 font-medium">السائق</th>
                <th className="py-2 text-center font-medium">التقييم</th>
                <th className="py-2 text-center font-medium">الرحلات</th>
                <th className="py-2 text-center font-medium">الإيرادات</th>
                <th className="py-2 text-center font-medium">الإلغاءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-b border-hairline/60">
                  <td className="py-2.5">
                    <p className="font-bold text-royal">{r.name ?? 'سائق'}</p>
                    <p className="text-[11px] text-ink-muted" dir="ltr">
                      {r.phone}
                    </p>
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-sand" fill="currentColor" strokeWidth={2} />
                      {r.rating ?? '—'}
                    </span>
                  </td>
                  <td className="text-center font-bold text-royal">{num(r.rides)}</td>
                  <td className="text-center font-bold text-green">{money(r.earnings)}</td>
                  <td className="text-center">
                    <span className={r.cancels > 0 ? 'font-bold text-danger' : 'text-ink-muted'}>
                      {num(r.cancels)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
