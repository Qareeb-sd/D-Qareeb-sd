import AdminSidebar from '@/admin/components/AdminSidebar'
import AdminHeader from '@/admin/components/AdminHeader'
import ChartCard from '@/admin/components/ChartCard'
import { money, num } from '@/lib/format'

const serviceBreakdown = [
  { service: 'قريب عادي', rides: 540, revenue: 702000, color: '#1B6B3F' },
  { service: 'قريب نسائي', rides: 210, revenue: 378000, color: '#E85C9E' },
  { service: 'أمجاد', rides: 180, revenue: 288000, color: '#3A6FB0' },
  { service: 'هايس', rides: 95, revenue: 285000, color: '#52584E' },
  { service: 'ركشة', rides: 320, revenue: 144000, color: '#2B2F2C' },
  { service: 'مشوار مفتوح', rides: 45, revenue: 157500, color: '#C9A138' },
  { service: 'سحاب', rides: 28, revenue: 336000, color: '#8B9189' },
]

function DonutChart({ segments, size = 140 }: {
  segments: { label: string; value: number; color: string }[]
  size?: number
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  let acc = 0
  const r = size / 2 - 10
  const cx = size / 2
  const cy = size / 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const start = (acc / total) * Math.PI * 2 - Math.PI / 2
        acc += seg.value
        const end = (acc / total) * Math.PI * 2 - Math.PI / 2
        const x1 = cx + r * Math.cos(start)
        const y1 = cy + r * Math.sin(start)
        const x2 = cx + r * Math.cos(end)
        const y2 = cy + r * Math.sin(end)
        const large = end - start > Math.PI ? 1 : 0
        return (
          <path
            key={i}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
            fill={seg.color}
            stroke="white"
            strokeWidth="2"
          />
        )
      })}
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1A1F1B">
        {num(total)}
      </text>
    </svg>
  )
}

export default function AdminReports() {
  return (
    <div className="flex min-h-screen bg-bg" dir="rtl">
      <AdminSidebar />
      <div className="mr-64 flex flex-1 flex-col">
        <AdminHeader title="التقارير والإحصائيات" subtitle="تحليل شامل لأداء المنصة" />
        <main className="flex-1 px-8 py-6">
          {/* Summary Cards */}
          <div className="mb-6 grid grid-cols-4 gap-4">
            {[
              { label: 'إجمالي الرحلات', value: num(1418), sub: 'هذا الشهر' },
              { label: 'إجمالي الإيرادات', value: money(2290500), sub: 'شامل العمولة' },
              { label: 'عمولة المنصة', value: money(343575), sub: '١٥٪ من الإيرادات' },
              { label: 'متوسط قيمة الرحلة', value: money(1615), sub: 'للكل خدمة' },
            ].map((s) => (
              <div key={s.label} className="card p-5 text-center">
                <p className="text-xs text-ink-muted">{s.label}</p>
                <p className="mt-1 text-xl font-extrabold text-green">{s.value}</p>
                <p className="mt-0.5 text-[10px] text-ink-muted">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Service Breakdown */}
            <ChartCard title="توزيع الرحلات حسب الخدمة" subtitle="الشهر الجاري">
              <div className="flex items-center gap-6">
                <DonutChart segments={serviceBreakdown.map((s) => ({ label: s.service, value: s.rides, color: s.color }))} />
                <div className="flex-1 space-y-2">
                  {serviceBreakdown.map((s) => (
                    <div key={s.service} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="flex-1 text-xs text-ink-soft">{s.service}</span>
                      <span className="text-xs font-bold">{num(s.rides)}</span>
                      <span className="text-[10px] text-ink-muted w-16 text-left">{money(s.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>

            {/* Monthly Comparison */}
            <ChartCard title="الإيرادات الشهرية" subtitle="مقارنة السنة">
              <div className="space-y-3">
                {[
                  { month: 'يناير', revenue: 1800000 },
                  { month: 'فبراير', revenue: 2100000 },
                  { month: 'مارس', revenue: 1950000 },
                  { month: 'أبريل', revenue: 2300000 },
                  { month: 'مايو', revenue: 2500000 },
                  { month: 'يونيو', revenue: 2290500 },
                ].map((m) => {
                  const max = 2500000
                  const pct = (m.revenue / max) * 100
                  return (
                    <div key={m.month} className="flex items-center gap-3">
                      <span className="w-16 text-xs text-ink-muted">{m.month}</span>
                      <div className="flex-1 h-5 rounded-full bg-bg overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-20 text-xs font-bold text-left">{money(m.revenue)}</span>
                    </div>
                  )
                })}
              </div>
            </ChartCard>
          </div>
        </main>
      </div>
    </div>
  )
}
