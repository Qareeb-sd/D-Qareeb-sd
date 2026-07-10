import { useState } from 'react'

interface AdminHeaderProps {
  title: string
  subtitle?: string
}

export default function AdminHeader({ title, subtitle }: AdminHeaderProps) {
  const [search, setSearch] = useState('')

  return (
    <header className="sticky top-0 z-10 border-b border-hairline bg-white/80 px-8 py-4 backdrop-blur-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث سريع..."
              className="w-64 rounded-xl border border-hairline bg-bg px-4 py-2.5 pr-10 text-sm outline-none transition focus:border-green focus:ring-2 focus:ring-green/20"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted">🔍</span>
          </div>

          {/* Notifications */}
          <button className="relative grid h-10 w-10 place-items-center rounded-xl border border-hairline text-lg transition hover:bg-bg">
            🔔
            <span className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
              3
            </span>
          </button>

          {/* Date */}
          <div className="rounded-xl border border-hairline bg-bg px-4 py-2.5 text-sm text-ink-soft">
            {new Date().toLocaleDateString('ar-SD', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>
      </div>
    </header>
  )
}
