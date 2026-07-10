import { type ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
  icon: string
  iconBg: string
  accent?: string
}

export default function StatCard({
  label,
  value,
  change,
  changeType = 'neutral',
  icon,
  iconBg,
  accent,
}: StatCardProps) {
  const changeColor =
    changeType === 'up'
      ? 'text-green'
      : changeType === 'down'
        ? 'text-danger'
        : 'text-ink-muted'

  return (
    <div className="card flex items-center gap-4 p-5 transition hover:shadow-lift">
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-ink-muted truncate">{label}</p>
        <p className="mt-0.5 text-2xl font-extrabold" style={{ color: accent || '#1A1F1B' }}>
          {value}
        </p>
        {change && (
          <p className={`mt-0.5 text-[11px] font-medium ${changeColor}`}>
            {changeType === 'up' ? '↑' : changeType === 'down' ? '↓' : '•'} {change}
          </p>
        )}
      </div>
    </div>
  )
}
