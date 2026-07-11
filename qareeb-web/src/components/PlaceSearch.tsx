import { useEffect, useRef, useState } from 'react'
import { useMaps } from '@/store/MapsContext'
import { isMapsConfigured } from '@/lib/maps'

export interface Picked {
  pos: google.maps.LatLngLiteral
  address: string
}

interface Suggestion {
  id: string
  main: string
  sub?: string
  placeId?: string
  pos?: google.maps.LatLngLiteral
}

/**
 * أماكن شائعة في الخرطوم كبديل عند غياب مفتاح خرائط قوقل،
 * حتى تعمل اقتراحات الكتابة (مثال: «مطار» ← «مطار الخرطوم الدولي»).
 */
const LOCAL_PLACES: { name: string; lat: number; lng: number }[] = [
  { name: 'مطار الخرطوم الدولي', lat: 15.5895, lng: 32.5532 },
  { name: 'جامعة الخرطوم', lat: 15.6035, lng: 32.532 },
  { name: 'السوق العربي (وسط الخرطوم)', lat: 15.633, lng: 32.523 },
  { name: 'مستشفى الخرطوم', lat: 15.554, lng: 32.535 },
  { name: 'الخرطوم بحري', lat: 15.64, lng: 32.533 },
  { name: 'أم درمان', lat: 15.6445, lng: 32.4777 },
  { name: 'سوق أم درمان', lat: 15.647, lng: 32.479 },
  { name: 'كافوري', lat: 15.66, lng: 32.56 },
  { name: 'حي الرياض', lat: 15.57, lng: 32.58 },
  { name: 'المنشية', lat: 15.59, lng: 32.57 },
  { name: 'شمبات', lat: 15.67, lng: 32.51 },
  { name: 'استاد الخرطوم', lat: 15.585, lng: 32.545 },
  { name: 'جامعة السودان للعلوم والتكنولوجيا', lat: 15.61, lng: 32.523 },
  { name: 'جبل أولياء', lat: 15.24, lng: 32.5 },
]

/**
 * حقل عنوان مع اقتراحات: عبر Google Places عند تفعيل المفتاح،
 * وإلا قائمة أماكن الخرطوم الشائعة. يُرجع الموقع عند الاختيار.
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
  const { isLoaded } = useMaps()
  const [preds, setPreds] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const q = value.trim()
    if (q.length < 2) {
      setPreds([])
      return
    }
    const t = setTimeout(() => {
      const usePlaces =
        isMapsConfigured && isLoaded && typeof google !== 'undefined' && google.maps?.places
      if (usePlaces) {
        const svc = new google.maps.places.AutocompleteService()
        svc.getPlacePredictions(
          { input: q, componentRestrictions: { country: 'sd' }, language: 'ar' },
          (res) => {
            setPreds(
              (res ?? []).slice(0, 6).map((p) => ({
                id: p.place_id,
                main: p.structured_formatting?.main_text ?? p.description,
                sub: p.structured_formatting?.secondary_text,
                placeId: p.place_id,
              })),
            )
            setOpen(true)
          },
        )
      } else {
        const matches = LOCAL_PLACES.filter((p) => p.name.includes(q)).slice(0, 6)
        setPreds(matches.map((p) => ({ id: p.name, main: p.name, pos: { lat: p.lat, lng: p.lng } })))
        setOpen(true)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [value, isLoaded])

  // إغلاق القائمة عند النقر خارجها.
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const pick = (s: Suggestion) => {
    setOpen(false)
    onChange(s.main)
    if (s.pos) {
      onPick({ pos: s.pos, address: s.main })
      return
    }
    if (s.placeId && typeof google !== 'undefined' && google.maps?.places) {
      const svc = new google.maps.places.PlacesService(document.createElement('div'))
      svc.getDetails({ placeId: s.placeId, fields: ['geometry', 'name'] }, (place) => {
        const loc = place?.geometry?.location
        if (loc) onPick({ pos: { lat: loc.lat(), lng: loc.lng() }, address: place?.name || s.main })
      })
    }
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
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-2xl border border-hairline bg-white shadow-lift">
          {preds.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => pick(s)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-right hover:bg-green-soft"
              >
                <span className="text-ink-muted">📍</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{s.main}</span>
                  {s.sub && <span className="block truncate text-xs text-ink-muted">{s.sub}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
