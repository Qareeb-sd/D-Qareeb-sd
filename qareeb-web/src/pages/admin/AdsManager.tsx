import { useEffect, useMemo, useState } from 'react'
import { Images, Upload, Trash2, ExternalLink } from 'lucide-react'
import {
  listAdBanners,
  createAdBanner,
  setAdBannerActive,
  deleteAdBanner,
  uploadAdImage,
} from '@/lib/api'
import { money } from '@/lib/format'
import type { AdBanner } from '@/lib/types'

type Audience = 'all' | 'customers' | 'drivers'
const AUD_LABEL: Record<Audience, string> = {
  all: 'الكل (العميل + السائق)',
  customers: 'العملاء فقط',
  drivers: 'السائقون فقط',
}

/** حالة البنر حسب التواريخ والتفعيل. */
function statusOf(a: AdBanner): { label: string; color: string } {
  if (!a.active) return { label: 'موقوف', color: '#8A8A8A' }
  const today = new Date(new Date().toISOString().slice(0, 10))
  const start = new Date(a.start_date)
  const end = new Date(a.start_date)
  end.setDate(end.getDate() + a.days)
  if (today < start) return { label: 'مجدول', color: '#A88528' }
  if (today >= end) return { label: 'منتهٍ', color: '#B23A48' }
  return { label: 'نشط', color: '#1B6B3F' }
}

function endDate(a: AdBanner): string {
  const end = new Date(a.start_date)
  end.setDate(end.getDate() + a.days)
  return end.toISOString().slice(0, 10)
}

/** إدارة بنرات الإعلانات المدفوعة (صورة + رابط + سعر يومي × أيام). */
export default function AdsManager() {
  const [ads, setAds] = useState<AdBanner[]>([])
  const [loading, setLoading] = useState(true)

  // نموذج الإنشاء
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>('')
  const [title, setTitle] = useState('')
  const [link, setLink] = useState('')
  const [audience, setAudience] = useState<Audience>('all')
  const [dailyPrice, setDailyPrice] = useState(0)
  const [days, setDays] = useState(7)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const reload = () => {
    setLoading(true)
    void listAdBanners().then((a) => {
      setAds(a)
      setLoading(false)
    })
  }
  useEffect(reload, [])

  const total = useMemo(() => days * Math.max(0, dailyPrice), [days, dailyPrice])
  const revenue = useMemo(
    () => ads.reduce((s, a) => s + a.days * Number(a.daily_price || 0), 0),
    [ads],
  )

  const pickImage = (f: File | null) => {
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : '')
  }

  const submit = async () => {
    if (!file) return setMsg('اختر صورة الإعلان أولاً.')
    if (days < 1) return setMsg('عدد الأيام يجب أن يكون ١ على الأقل.')
    setBusy(true)
    setMsg('')
    const up = await uploadAdImage(file)
    if (up.error || !up.url) {
      setBusy(false)
      return setMsg(up.error ?? 'تعذّر رفع الصورة.')
    }
    const { error } = await createAdBanner({
      title: title.trim() || null,
      image_url: up.url,
      link_url: link.trim() || null,
      audience,
      daily_price: Math.max(0, dailyPrice),
      days,
      start_date: startDate,
    })
    setBusy(false)
    if (error) return setMsg(error)
    // تصفير النموذج
    setFile(null)
    setPreview('')
    setTitle('')
    setLink('')
    setDailyPrice(0)
    setDays(7)
    setMsg('نُشر الإعلان ✓')
    reload()
  }

  const toggle = async (a: AdBanner) => {
    await setAdBannerActive(a.id, !a.active)
    reload()
  }
  const remove = async (a: AdBanner) => {
    if (!confirm('حذف هذا الإعلان نهائياً؟')) return
    await deleteAdBanner(a.id)
    reload()
  }

  return (
    <div className="space-y-4">
      {/* نموذج إنشاء إعلان */}
      <div className="card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Images className="h-5 w-5 text-royal" strokeWidth={2} />
          <p className="font-bold text-royal">بنر إعلان جديد</p>
        </div>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-sand py-6 text-sm font-bold text-ink-soft">
          {preview ? (
            <img src={preview} alt="معاينة" className="max-h-40 rounded-xl object-contain" />
          ) : (
            <>
              <Upload className="h-[18px] w-[18px]" strokeWidth={2} />
              اختر صورة الإعلان (بانر)
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
          />
        </label>

        <input
          className="input w-full"
          placeholder="اسم المُعلن/الحملة (اختياري — يراه الأدمن فقط)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="input w-full"
          placeholder="الرابط عند الضغط (اختياري) — https://..."
          value={link}
          onChange={(e) => setLink(e.target.value)}
          dir="ltr"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-bold text-ink-soft">الجمهور</span>
            <select
              className="input w-full"
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
            >
              <option value="all">{AUD_LABEL.all}</option>
              <option value="customers">{AUD_LABEL.customers}</option>
              <option value="drivers">{AUD_LABEL.drivers}</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold text-ink-soft">تاريخ البدء</span>
            <input
              type="date"
              className="input w-full"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold text-ink-soft">السعر اليومي (ج.س)</span>
            <input
              type="number"
              min={0}
              step={500}
              className="input w-full"
              value={dailyPrice}
              onChange={(e) => setDailyPrice(Math.max(0, Number(e.target.value)))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold text-ink-soft">عدد الأيام</span>
            <input
              type="number"
              min={1}
              step={1}
              className="input w-full"
              value={days}
              onChange={(e) => setDays(Math.max(1, Math.floor(Number(e.target.value))))}
            />
          </label>
        </div>

        <div className="rounded-2xl border border-sand/50 bg-sand-soft/40 p-3 text-sm">
          الإجمالي المستحقّ:{' '}
          <span className="font-extrabold text-royal">{money(total)}</span>{' '}
          <span className="text-ink-muted">({days} يوم × {money(dailyPrice)})</span>
        </div>

        {msg && <p className="text-sm font-medium text-green">{msg}</p>}
        <button className="btn-primary w-full" disabled={busy} onClick={submit}>
          {busy ? '…' : 'نشر الإعلان'}
        </button>
      </div>

      {/* إيراد الإعلانات */}
      <div className="card flex items-center justify-between p-4">
        <span className="font-bold text-ink-soft">إجمالي إيراد الإعلانات</span>
        <span className="text-lg font-extrabold text-royal">{money(revenue)}</span>
      </div>

      {/* قائمة الإعلانات */}
      {loading ? (
        <p className="text-center text-sm text-ink-muted">جارٍ التحميل…</p>
      ) : ads.length === 0 ? (
        <p className="text-center text-sm text-ink-muted">لا توجد إعلانات بعد.</p>
      ) : (
        <div className="space-y-3">
          {ads.map((a) => {
            const st = statusOf(a)
            return (
              <div key={a.id} className="card flex gap-3 p-3">
                <img
                  src={a.image_url}
                  alt={a.title ?? 'إعلان'}
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-bold text-ink">{a.title || 'إعلان'}</p>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                      style={{ backgroundColor: st.color }}
                    >
                      {st.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-ink-muted">
                    {AUD_LABEL[a.audience]} · {a.start_date} ← {endDate(a)}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-soft">
                    {a.days} يوم × {money(a.daily_price)} ={' '}
                    <span className="font-bold text-royal">{money(a.days * Number(a.daily_price))}</span>
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      onClick={() => toggle(a)}
                      className="rounded-lg bg-hairline px-2.5 py-1 text-[12px] font-bold text-ink-soft"
                    >
                      {a.active ? 'إيقاف' : 'تفعيل'}
                    </button>
                    {a.link_url && (
                      <a
                        href={a.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg bg-hairline px-2.5 py-1 text-[12px] font-bold text-royal"
                      >
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} /> الرابط
                      </a>
                    )}
                    <button
                      onClick={() => remove(a)}
                      className="flex items-center gap-1 rounded-lg bg-danger/10 px-2.5 py-1 text-[12px] font-bold text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} /> حذف
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
