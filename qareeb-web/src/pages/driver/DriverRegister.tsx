import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, AlertTriangle, Camera, FileText } from 'lucide-react'
import Screen from '@/components/Screen'
import VehicleImage from '@/components/VehicleImage'
import { useAuth } from '@/store/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'
import { services, getService } from '@/data/services'
import {
  submitDriverApplication,
  getMyDriverApplication,
  uploadDriverDoc,
  type DriverDocKind,
} from '@/lib/api'
import type { DriverApplication } from '@/lib/types'

/**
 * حقول الوثائق/الصور المطلوبة. تسميات الصور تتكيّف مع نوع المركبة
 * (noun) فتقول «صورة السحّاب/الركشة/الهايس…» بدل «السيارة» دائماً.
 */
const docFields: { kind: DriverDocKind; label: (noun: string) => string; photo?: boolean }[] = [
  { kind: 'driving_license', label: () => 'رخصة القيادة' },
  { kind: 'vehicle_license', label: (n) => `رخصة/استمارة ${n}` },
  { kind: 'transport_permit', label: () => 'تصريح النقل' },
  { kind: 'photo_front', label: (n) => `صورة ${n} — أمامية`, photo: true },
  { kind: 'photo_back', label: (n) => `صورة ${n} — خلفية`, photo: true },
  { kind: 'photo_side', label: (n) => `صورة ${n} — جانبية/الأطراف`, photo: true },
  { kind: 'photo_interior', label: (n) => `صورة ${n} — من الداخل`, photo: true },
]

const urlKey: Record<DriverDocKind, keyof DriverApplication> = {
  driving_license: 'driving_license_url',
  vehicle_license: 'vehicle_license_url',
  rental_contract: 'rental_contract_url',
  transport_permit: 'transport_permit_url',
  photo_front: 'photo_front_url',
  photo_back: 'photo_back_url',
  photo_side: 'photo_side_url',
  photo_interior: 'photo_interior_url',
}

/**
 * تسجيل الانضمام كسائق: بيانات + وثائق + صور السيارة.
 * يُرسَل الطلب بحالة "قيد المراجعة" حتى يعتمده الأدمن (عندها يصبح الدور سائقاً).
 */
export default function DriverRegister() {
  const navigate = useNavigate()
  const { session, profile, refreshProfile } = useAuth()
  const userId = profile?.id ?? 'demo-user'

  const [app, setApp] = useState<DriverApplication | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [email, setEmail] = useState('')
  const [vehicleType, setVehicleType] = useState(services[0].id)
  const [plate, setPlate] = useState('')
  const [isRented, setIsRented] = useState(false)
  const [residence, setResidence] = useState('')
  const [files, setFiles] = useState<Partial<Record<DriverDocKind, File>>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // اسم المركبة المختارة للصياغة (السحّاب/الركشة/الهايس…).
  const noun = getService(vehicleType)?.noun ?? 'المركبة'

  useEffect(() => {
    void getMyDriverApplication(userId).then((a) => {
      setApp(a)
      setLoading(false)
    })
  }, [userId])

  const setFile = (kind: DriverDocKind, file: File | null) =>
    setFiles((f) => {
      const next = { ...f }
      if (file) next[kind] = file
      else delete next[kind]
      return next
    })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // تحقّق من الحقول الأساسية.
    if (!fullName.trim() || !phone.trim() || !plate.trim()) {
      return setError('الاسم ورقم الهاتف ولوحة السيارة مطلوبة.')
    }
    const required: DriverDocKind[] = docFields.map((d) => d.kind)
    if (isRented) required.push('rental_contract')
    const missing = required.filter((k) => !files[k])
    if (missing.length) return setError('يرجى إرفاق كل الوثائق والصور المطلوبة.')

    setBusy(true)
    try {
      // ارفع كل ملف واجمع مساراته.
      const urls: Partial<Record<keyof DriverApplication, string>> = {}
      for (const kind of required) {
        const file = files[kind]
        if (!file) continue
        const { path, error } = await uploadDriverDoc(userId, kind, file)
        if (error) throw new Error(`تعذّر رفع «${kind}»: ${error}`)
        if (path) urls[urlKey[kind]] = path
      }

      const { error } = await submitDriverApplication({
        user_id: userId,
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        vehicle_type: vehicleType,
        plate_number: plate.trim(),
        is_rented: isRented,
        residence: residence.trim() || null,
        driving_license_url: urls.driving_license_url ?? null,
        vehicle_license_url: urls.vehicle_license_url ?? null,
        rental_contract_url: urls.rental_contract_url ?? null,
        transport_permit_url: urls.transport_permit_url ?? null,
        photo_front_url: urls.photo_front_url ?? null,
        photo_back_url: urls.photo_back_url ?? null,
        photo_side_url: urls.photo_side_url ?? null,
        photo_interior_url: urls.photo_interior_url ?? null,
      })
      if (error) throw new Error(error)

      const fresh = await getMyDriverApplication(userId)
      setApp(fresh ?? { status: 'pending' } as DriverApplication)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقّع.')
    } finally {
      setBusy(false)
    }
  }

  // غير مسجّل → لدخول السائق (تطبيق منفصل عن العميل).
  if (isSupabaseConfigured && !session) return <Navigate to="/driver/login" replace />

  if (loading) {
    return (
      <Screen title="الانضمام كسائق">
        <div className="flex justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-royal-soft border-t-royal" />
        </div>
      </Screen>
    )
  }

  // معتمد بالفعل → لواجهة السائق.
  if (profile?.role === 'driver' || app?.status === 'approved') {
    return (
      <Screen title="الانضمام كسائق">
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <CheckCircle2 className="h-14 w-14 text-royal" strokeWidth={2} />
          <p className="font-bold">تم اعتماد طلبك — أهلاً بك سائقاً في قريب!</p>
          <button
            className="btn-driver"
            onClick={async () => {
              await refreshProfile()
              navigate('/driver')
            }}
          >
            الذهاب لواجهة السائق
          </button>
        </div>
      </Screen>
    )
  }

  // طلب قيد المراجعة.
  if (app?.status === 'pending' && !showForm) {
    return (
      <Screen title="الانضمام كسائق" back>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Clock className="h-14 w-14 text-sand-ink" strokeWidth={2} />
          <p className="font-bold">طلبك قيد المراجعة</p>
          <p className="max-w-xs text-sm text-ink-soft">
            استلمنا بياناتك ووثائقك، وسيراجعها فريق قريب. سنبلّغك عند الاعتماد.
          </p>
        </div>
      </Screen>
    )
  }

  // طلب مرفوض → أظهر السبب مع خيار إعادة التقديم.
  if (app?.status === 'rejected' && !showForm) {
    return (
      <Screen title="الانضمام كسائق" back>
        <div className="rounded-2xl bg-danger/10 p-5 text-center text-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-danger" strokeWidth={2} />
          <p className="mt-2 font-bold text-danger">تم رفض طلبك السابق.</p>
          {app.review_note && <p className="mt-1 text-ink-soft">السبب: {app.review_note}</p>}
          <button className="btn-driver mt-4" onClick={() => setShowForm(true)}>
            إعادة التقديم
          </button>
        </div>
      </Screen>
    )
  }

  return (
    <Screen title="الانضمام كسائق" back>
      <p className="mb-4 text-sm text-ink-soft">
        سجّل بياناتك ووثائقك للانضمام كسائق. يُراجَع الطلب من إدارة قريب قبل التفعيل.
      </p>

      {error && (
        <p className="mb-4 rounded-2xl bg-danger/10 px-4 py-3 text-center text-sm text-danger">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="label">الاسم الكامل</label>
              <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="الاسم الثلاثي" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">رقم الهاتف</label>
                <input className="field text-left" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+249…" />
              </div>
              <div>
                <label className="label">البريد الإلكتروني</label>
                <input className="field text-left" dir="ltr" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.com" />
              </div>
            </div>

            <div>
              <label className="label">نوع السيارة</label>
              <div className="grid grid-cols-2 gap-2">
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setVehicleType(s.id)}
                    className={`flex items-center gap-2 rounded-2xl border p-2.5 text-right transition ${
                      vehicleType === s.id
                        ? 'border-sand bg-sand/25 font-bold text-royal'
                        : 'border-hairline bg-white text-ink-soft'
                    }`}
                  >
                    <VehicleImage service={s} className="h-9 w-12 shrink-0" />
                    <span className="flex-1 text-sm">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">لوحة السيارة</label>
              <input className="field" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="مثال: خ ط م ١٢٣٤" />
            </div>

            <div>
              <label className="label">السكن / العنوان</label>
              <input className="field" value={residence} onChange={(e) => setResidence(e.target.value)} placeholder="المدينة والحي" />
            </div>

            {/* السيارة مستأجرة؟ */}
            <label className="flex items-center justify-between rounded-2xl border border-hairline bg-white p-3.5">
              <span className="font-medium">السيارة مستأجرة</span>
              <input type="checkbox" checked={isRented} onChange={(e) => setIsRented(e.target.checked)} className="h-5 w-5 accent-green" />
            </label>

            {/* الوثائق والصور */}
            <div className="space-y-3">
              <p className="label">الوثائق وصور {noun}</p>
              {isRented && (
                <FileField
                  label="عقد الإيجار"
                  file={files.rental_contract ?? null}
                  onChange={(f) => setFile('rental_contract', f)}
                />
              )}
              {docFields.map((d) => (
                <FileField
                  key={d.kind}
                  label={d.label(noun)}
                  photo={d.photo}
                  file={files[d.kind] ?? null}
                  onChange={(f) => setFile(d.kind, f)}
                />
              ))}
            </div>

        <button className="btn-driver w-full" type="submit" disabled={busy}>
          {busy ? 'جارٍ الإرسال…' : 'إرسال الطلب للمراجعة'}
        </button>
      </form>
    </Screen>
  )
}

/** حقل رفع ملف (وثيقة أو صورة) مع معاينة الاسم. */
function FileField({
  label,
  file,
  onChange,
  photo,
}: {
  label: string
  file: File | null
  onChange: (f: File | null) => void
  photo?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-white p-3">
      {photo ? (
        <Camera className="h-5 w-5 shrink-0 text-ink-soft" strokeWidth={2} />
      ) : (
        <FileText className="h-5 w-5 shrink-0 text-ink-soft" strokeWidth={2} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        {file && <p className="truncate text-xs text-royal">{file.name}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={photo ? 'image/*' : 'image/*,application/pdf'}
        capture={photo ? 'environment' : undefined}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-bold ${
          file ? 'bg-sand/25 text-royal' : 'bg-hairline text-ink-soft'
        }`}
      >
        {file ? 'تغيير' : 'إرفاق'}
      </button>
    </div>
  )
}
