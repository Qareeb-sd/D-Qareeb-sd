import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { searchPlaces, placeCoords, type PlaceSuggestion } from '@/lib/places'

export interface Picked {
  pos: google.maps.LatLngLiteral
  address: string
}

type Suggestion = PlaceSuggestion

/**
 * حقل عنوان مع اقتراحات فورية عبر **خرائط قوقل (Places)** متى توفّر مفتاحها،
 * وإلا OpenStreetMap ثم قائمة محلية — فلا يتعطّل البحث أبداً. يُرجع الموقع عند
 * الاختيار (يُحلّ إحداثيات نتيجة قوقل عند النقر).
 */
export default function PlaceSearch({
  value,
  onChange,
  onPick,
  onFocus,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  onPick: (p: Picked) => void
  onFocus?: () => void
  placeholder?: string
  className?: string
}) {
  const [preds, setPreds] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const q = value.trim()
    if (q.length < 2) {
      setPreds([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const results = await searchPlaces(q, ctrl.signal)
        setPreds(results)
        setOpen(true)
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        setPreds([])
      }
    }, 300)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [value])

  // إغلاق القائمة عند النقر خارجها.
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const pick = async (s: Suggestion) => {
    setOpen(false)
    onChange(s.main)
    // نتائج قوقل بلا إحداثيات — تُحلّ عند الاختيار عبر معرّف المكان.
    if (s.placeId && s.pos.lat === 0 && s.pos.lng === 0) {
      const pos = await placeCoords(s.placeId)
      if (pos) onPick({ pos, address: s.main })
      return
    }
    onPick({ pos: s.pos, address: s.main })
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <input
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          onFocus?.()
          if (preds.length > 0) setOpen(true)
        }}
        placeholder={placeholder}
      />
      {open && preds.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-auto rounded-2xl border border-hairline bg-white shadow-lift">
          {preds.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => pick(s)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-right hover:bg-ivory"
              >
                <MapPin className="h-4 w-4 shrink-0 text-sand-ink" strokeWidth={1.8} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-royal">{s.main}</span>
                  {s.sub && <span className="block truncate text-[11px] text-ink-muted">{s.sub}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
