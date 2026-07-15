import { useEffect, useRef, useState } from 'react'
import { ChevronRight, MapPin, Map as MapIcon, Navigation, X, House, Briefcase, Star } from 'lucide-react'
import { searchPlaces, type PlaceSuggestion } from '@/lib/places'

export interface SavedEntry {
  key: string
  label: string
  address?: string
  pos?: google.maps.LatLngLiteral
}

/**
 * شاشة بحث كاملة (مثل أوبر): تُخفي الخريطة وتستغلّ كامل المساحة لعرض الاقتراحات
 * فوق الكيبورد. تُظهر الأماكن المحفوظة و«موقعي الحالي» و«تحديد على الخريطة»،
 * واقتراحات فورية أثناء الكتابة عبر OpenStreetMap.
 */
export default function LocationSearchPanel({
  field,
  initial,
  saved,
  onPick,
  onUseCurrent,
  onChooseOnMap,
  onClose,
}: {
  field: 'pickup' | 'dropoff'
  initial: string
  saved: SavedEntry[]
  onPick: (p: { pos: google.maps.LatLngLiteral; address: string }) => void
  onUseCurrent?: () => void
  onChooseOnMap: () => void
  onClose: () => void
}) {
  const [q, setQ] = useState(initial)
  const [preds, setPreds] = useState<PlaceSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const text = q.trim()
    if (text.length < 2) {
      setPreds([])
      setLoading(false)
      return
    }
    setLoading(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const r = await searchPlaces(text, ctrl.signal)
        setPreds(r)
      } catch {
        /* أُلغي الطلب */
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q])

  const isPickup = field === 'pickup'
  const dot = isPickup ? 'bg-royal' : 'bg-sand'

  return (
    <div className="fixed inset-0 z-[900] flex flex-col bg-ivory font-plex">
      {/* الهيدر + حقل البحث */}
      <div
        className="bg-white px-4 pb-3 shadow-card"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <div className="flex items-center gap-2 pb-3 pt-1">
          <button
            onClick={onClose}
            className="press-scale grid h-10 w-10 shrink-0 place-items-center rounded-full text-royal"
            aria-label="رجوع"
          >
            <ChevronRight className="h-6 w-6" strokeWidth={2} />
          </button>
          <h1 className="text-[16px] font-bold text-royal">
            {isPickup ? 'نقطة الانطلاق' : 'إلى أين؟'}
          </h1>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-sand/40 bg-ivory/70 px-4 py-3">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
          <input
            ref={inputRef}
            dir="rtl"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={isPickup ? 'اكتب نقطة الانطلاق' : 'اكتب وجهتك'}
            className="min-w-0 flex-1 bg-transparent text-right text-[15px] font-semibold text-royal outline-none placeholder:font-medium placeholder:text-ink-muted/60"
          />
          {q && (
            <button onClick={() => setQ('')} aria-label="مسح" className="shrink-0 text-ink-muted">
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* النتائج تملأ المساحة */}
      <div className="flex-1 overflow-auto px-2 pb-6">
        {/* إجراءات ثابتة */}
        <div className="px-2 pt-2">
          {isPickup && onUseCurrent && (
            <Row icon={Navigation} title="موقعي الحالي" onClick={() => { onUseCurrent(); onClose() }} />
          )}
          <Row icon={MapIcon} title="تحديد على الخريطة" sub="حرّك الدبوس بنفسك" onClick={onChooseOnMap} />
        </div>

        {/* أثناء الكتابة: اقتراحات */}
        {q.trim().length >= 2 ? (
          <div className="mt-1 px-2">
            {loading && preds.length === 0 && (
              <p className="px-2 py-4 text-center text-[13px] text-ink-muted">جارٍ البحث…</p>
            )}
            {!loading && preds.length === 0 && (
              <p className="px-2 py-4 text-center text-[13px] text-ink-muted">لا نتائج — جرّب كلمة أخرى</p>
            )}
            {preds.map((s) => (
              <Row
                key={s.id}
                icon={MapPin}
                title={s.main}
                sub={s.sub}
                onClick={() => onPick({ pos: s.pos, address: s.main })}
              />
            ))}
          </div>
        ) : (
          // القائمة الافتراضية: الأماكن المحفوظة
          <div className="mt-2 px-2">
            <p className="px-2 pb-1 text-[11px] font-bold text-ink-muted">أماكن محفوظة</p>
            {saved.map((p) => {
              const Icon = p.key === 'work' ? Briefcase : p.key === 'favorite' ? Star : House
              return (
                <Row
                  key={p.key}
                  icon={Icon}
                  title={p.label}
                  sub={p.address ?? 'غير محفوظ بعد'}
                  dim={!p.pos}
                  onClick={() => {
                    if (p.pos && p.address) onPick({ pos: p.pos, address: p.address })
                  }}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({
  icon: Icon,
  title,
  sub,
  dim,
  onClick,
}: {
  icon: typeof House
  title: string
  sub?: string
  dim?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="press-scale flex w-full items-center gap-3 rounded-xl px-2 py-3 text-right hover:bg-white"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-card">
        <Icon className="h-[18px] w-[18px] text-sand-ink" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[14px] font-semibold ${dim ? 'text-ink-muted' : 'text-royal'}`}>
          {title}
        </span>
        {sub && <span className="block truncate text-[11.5px] text-ink-muted">{sub}</span>}
      </span>
    </button>
  )
}
