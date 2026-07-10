import type { ReactNode } from 'react'
import { num } from '@/lib/format'

/** بطاقة مؤشّر (KPI). */
export function StatCard({
  label,
  value,
  hint,
  icon,
  iconBg,
  accent,
}: {
  label: string
  value: string | number
  hint?: string
  icon: string
  iconBg: string
  accent?: string
}) {
  return (
    <div className="card flex items-center gap-4 p-4 transition hover:shadow-lift">
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-ink-muted">{label}</p>
        <p className="mt-0.5 text-2xl font-extrabold" style={{ color: accent ?? '#1A1F1B' }}>
          {value}
        </p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-ink-muted">{hint}</p>}
      </div>
    </div>
  )
}

/** بطاقة تحيط برسم بياني أو محتوى. */
export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="font-bold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

const badgeStyles: Record<string, { bg: string; text: string; label: string }> = {
  completed: { bg: '#E8F1EC', text: '#1B6B3F', label: 'مكتملة' },
  searching: { bg: '#FBF4DD', text: '#A88528', label: 'بحث عن سائق' },
  requested: { bg: '#FBF4DD', text: '#A88528', label: 'مطلوبة' },
  pending: { bg: '#FBF4DD', text: '#A88528', label: 'معلّقة' },
  cancelled: { bg: '#FDECEB', text: '#C5453B', label: 'ملغاة' },
  in_progress: { bg: '#E3EEF7', text: '#3A6FB0', label: 'جارية' },
  arrived: { bg: '#E3EEF7', text: '#3A6FB0', label: 'وصل السائق' },
  accepted: { bg: '#E8F1EC', text: '#1B6B3F', label: 'مقبولة' },
  online: { bg: '#E8F1EC', text: '#1B6B3F', label: 'متصل' },
  offline: { bg: '#F0F0EE', text: '#8B9189', label: 'غير متصل' },
  approved: { bg: '#E8F1EC', text: '#1B6B3F', label: 'معتمد' },
  rejected: { bg: '#FDECEB', text: '#C5453B', label: 'مرفوض' },
}

/** شارة حالة ملوّنة. */
export function StatusBadge({ status }: { status: string }) {
  const s = badgeStyles[status] ?? { bg: '#F0F0EE', text: '#8B9189', label: status }
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}

/** رسم أعمدة SVG بسيط (بلا مكتبات). */
export function BarChart({
  data,
  color = '#1B6B3F',
  format,
  height = 190,
}: {
  data: { label: string; value: number }[]
  color?: string
  format?: (v: number) => string
  height?: number
}) {
  if (!data.length) return <Empty />
  const max = Math.max(...data.map((d) => d.value), 1)
  const bw = 100 / data.length
  return (
    <svg viewBox={`0 0 400 ${height}`} className="w-full">
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1="0"
          y1={30 + (i * (height - 50)) / 4}
          x2="400"
          y2={30 + (i * (height - 50)) / 4}
          stroke="#E5E7E2"
          strokeWidth="1"
        />
      ))}
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 55)
        const x = i * bw + bw * 0.15
        const w = bw * 0.7
        const cx = (x / 100) * 400 + (w / 200) * 400
        return (
          <g key={i}>
            <rect x={(x / 100) * 400} y={height - 25 - h} width={(w / 100) * 400} height={h} rx="4" fill={color} opacity="0.85" />
            <text x={cx} y={height - 30 - h} textAnchor="middle" fontSize="9" fill="#1A1F1B" fontWeight="bold">
              {format ? format(d.value) : d.value}
            </text>
            <text x={cx} y={height - 6} textAnchor="middle" fontSize="10" fill="#8B9189">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** رسم حلقي (Donut) مع وسيلة إيضاح. */
export function DonutChart({
  segments,
  size = 170,
}: {
  segments: { label: string; value: number; color: string }[]
  size?: number
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) return <Empty />
  let acc = 0
  const r = size / 2 - 10
  const cx = size / 2
  const cy = size / 2
  const ir = r * 0.6
  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg, i) => {
          if (seg.value === 0) return null
          const start = (acc / total) * Math.PI * 2 - Math.PI / 2
          acc += seg.value
          const end = (acc / total) * Math.PI * 2 - Math.PI / 2
          const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start)
          const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end)
          const ix1 = cx + ir * Math.cos(start), iy1 = cy + ir * Math.sin(start)
          const ix2 = cx + ir * Math.cos(end), iy2 = cy + ir * Math.sin(end)
          const large = end - start > Math.PI ? 1 : 0
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1} Z`}
              fill={seg.color}
              stroke="white"
              strokeWidth="2"
            />
          )
        })}
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1A1F1B">
          {num(total)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="8" fill="#8B9189">
          الإجمالي
        </text>
      </svg>
      <div className="space-y-1.5">
        {segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-ink-soft">{s.label}</span>
            <span className="font-bold">{num(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Empty() {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 text-ink-muted">
      <span className="text-3xl">📭</span>
      <p className="text-sm">لا توجد بيانات بعد</p>
    </div>
  )
}
