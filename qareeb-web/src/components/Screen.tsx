import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackIcon } from './Icons'

interface ScreenProps {
  title?: string
  back?: boolean
  right?: ReactNode
  children: ReactNode
  /** إخفاء الحشو الافتراضي (مثلاً لشاشة الخريطة). */
  bare?: boolean
}

export default function Screen({ title, back, right, children, bare }: ScreenProps) {
  const navigate = useNavigate()

  return (
    <div className="screen">
      {(title || back) && (
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-hairline bg-bg/90 px-4 py-3 backdrop-blur">
          {back && (
            <button
              onClick={() => navigate(-1)}
              aria-label="رجوع"
              className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-green-soft"
            >
              <BackIcon />
            </button>
          )}
          {title && <h1 className="flex-1 text-lg font-bold">{title}</h1>}
          {right}
        </header>
      )}
      <main className={bare ? 'flex-1' : 'flex-1 px-4 py-4'}>{children}</main>
    </div>
  )
}
