import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

export interface Picked {
  pos: google.maps.LatLngLiteral
  address: string
}

interface Suggestion {
  id: string
  main: string
  sub?: string
  pos: google.maps.LatLngLiteral
}

/**
 * أماكن شائعة في السودان كبديل محلي عند تعذّر الوصول للإنترنت،
 * حتى تعمل الاقتراحات دائماً (مثال: «مطار» ← «مطار الخرطوم الدولي»).
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

// مركز الانحياز (الخرطوم) وصندوق السودان لتصفية النتائج.
const BIAS = { lat: 15.5, lon: 32.55 }
const SUDAN_BBOX = '21.8,8.6,39.1,22.3' // minLon,minLat,maxLon,maxLat

/** بناء عنوان ثانوي من حقول Photon المتاحة. */
function subOf(p: Record<string, string>): string {
  return [p.street, p.district, p.city, p.county, p.state]
    .filter((x, i, a) => x && a.indexOf(x) === i)
    .slice(0, 2)
    .join('، ')
}

async function searchPhoton(q: string, signal: AbortSignal): Promise<Suggestion[]> {
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
    `&limit=7&lang=default&lat=${BIAS.lat}&lon=${BIAS.lon}&bbox=${SUDAN_BBOX}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('photon')
  const data = (await res.json()) as {
    features: { properties: Record<string, string>; geometry: { coordinates: [number, number] } }[]
  }
  return data.features
    .filter((f) => f.geometry?.coordinates)
    .map((f, i) => {
      const p = f.properties
      const main = p.name || p.street || p.city || p.state || 'موقع'
      return {
        id: `${p.osm_id ?? i}-${i}`,
        main,
        sub: subOf(p) || undefined,
        pos: { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] },
      }
    })
}

function searchLocal(q: string): Suggestion[] {
  return LOCAL_PLACES.filter((p) => p.name.includes(q))
    .slice(0, 6)
    .map((p) => ({ id: p.name, main: p.name, pos: { lat: p.lat, lng: p.lng } }))
}

/**
 * حقل عنوان مع اقتراحات فورية عبر OpenStreetMap (Photon) — مجاني وبلا مفتاح،
 * يعمل داخل السودان بأسماء عربية، مع انحياز للخرطوم وتصفية داخل السودان.
 * يعود لقائمة محلية عند تعذّر الشبكة. يُرجع الموقع عند الاختيار.
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
        const results = await searchPhoton(q, ctrl.signal)
        setPreds(results.length ? results : searchLocal(q))
        setOpen(true)
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        // تعذّرت الشبكة → البديل المحلي بلا تعطّل.
        setPreds(searchLocal(q))
        setOpen(true)
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

  const pick = (s: Suggestion) => {
    setOpen(false)
    onChange(s.main)
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
