import { useEffect, useRef, useState } from 'react'
import { MapPin, Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import Screen from '@/components/Screen'
import LocationPicker from '@/components/LocationPicker'
import { useAuth } from '@/store/AuthContext'
import { KHARTOUM } from '@/theme'
import { GOOGLE_MAPS_API_KEY } from '@/lib/maps'
import { reverseGeocode } from '@/lib/geocode'
import { loadLastPos } from '@/lib/geo'
import {
  SAVED_SLOTS,
  type SavedKey,
  type SavedPlace,
  loadPlaces,
  savePlace,
  removePlace,
} from '@/lib/savedPlaces'

/**
 * إدارة العناوين المحفوظة — يعرض المنزل/العمل/المفضلة، ويسمح بتعديل كلٍّ منها
 * (تحديد على الخريطة مع اسم عنوان حقيقي) أو حذفه. مصدر التخزين مشترك مع شاشة
 * تحديد الرحلة، فيظهر أثر التعديل فوراً في اختيار الوجهة.
 */
export default function Addresses() {
  const { profile } = useAuth()
  const [places, setPlaces] = useState<Record<string, SavedPlace>>(() => loadPlaces(profile?.id))
  const [editing, setEditing] = useState<SavedKey | null>(null)

  return (
    <Screen title="العناوين المحفوظة" back>
      <p className="mb-3 text-sm text-ink-soft">
        احفظ أماكنك المتكرّرة لتختارها بلمسة عند طلب رحلة.
      </p>
      <div className="space-y-3">
        {SAVED_SLOTS.map(({ key, label, icon: Icon }) => {
          const place = places[key]
          const isEditing = editing === key
          return (
            <div key={key} className="card p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-mint">
                  <Icon className="h-5 w-5 text-green" strokeWidth={1.9} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">{label}</p>
                  <p className="truncate text-[13px] text-ink-muted">
                    {place ? place.address : 'غير محدّد'}
                  </p>
                </div>
                {!isEditing &&
                  (place ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditing(key)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-hairline text-green"
                        aria-label="تعديل"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.9} />
                      </button>
                      <button
                        onClick={() => setPlaces(removePlace(profile?.id, places, key))}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-hairline text-danger"
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.9} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditing(key)}
                      className="flex items-center gap-1 rounded-xl bg-green px-3 py-2 text-[13px] font-bold text-white"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.2} />
                      إضافة
                    </button>
                  ))}
              </div>

              {isEditing && (
                <PlaceEditor
                  initial={place ? { lat: place.lat, lng: place.lng } : loadLastPos() ?? KHARTOUM}
                  onCancel={() => setEditing(null)}
                  onSave={(p) => {
                    setPlaces(savePlace(profile?.id, places, key, p))
                    setEditing(null)
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </Screen>
  )
}

/** محرّر موقع واحد: خريطة بمؤشّر مركزي + اسم عنوان حقيقي + حفظ/إلغاء. */
function PlaceEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: google.maps.LatLngLiteral
  onSave: (p: SavedPlace) => void
  onCancel: () => void
}) {
  const [pos, setPos] = useState<google.maps.LatLngLiteral>(initial)
  const [addr, setAddr] = useState('موقع محدّد من الخريطة')
  const reqId = useRef(0)

  // اسم عنوان حقيقي بعد استقرار الدبوس (يستبدل الصياغة الاحتياطية).
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return
    const myId = ++reqId.current
    const t = setTimeout(() => {
      void reverseGeocode(pos).then((a) => {
        if (a && myId === reqId.current) setAddr(a)
      })
    }, 600)
    return () => clearTimeout(t)
  }, [pos.lat, pos.lng])

  return (
    <div className="mt-3 space-y-2">
      <LocationPicker center={initial} onChange={setPos} className="h-56" />
      <p className="flex items-center gap-1.5 text-[13px] text-ink-soft">
        <MapPin className="h-4 w-4 shrink-0 text-green" strokeWidth={1.9} />
        <span className="truncate">{addr}</span>
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ lat: pos.lat, lng: pos.lng, address: addr })}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green px-3 py-2.5 text-sm font-bold text-white"
        >
          <Check className="h-4 w-4" strokeWidth={2.2} />
          حفظ الموقع
        </button>
        <button
          onClick={onCancel}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-hairline bg-ivory px-3 py-2.5 text-sm font-bold text-ink-soft"
        >
          <X className="h-4 w-4" strokeWidth={2.2} />
          إلغاء
        </button>
      </div>
    </div>
  )
}
