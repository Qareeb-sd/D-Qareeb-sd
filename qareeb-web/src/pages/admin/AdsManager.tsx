import { useEffect, useState } from 'react'
import { Images, Upload, Trash2, ExternalLink } from 'lucide-react'
import {
  listAdBanners,
  createAdBanner,
  setAdBannerActive,
  deleteAdBanner,
  uploadAdImage,
  getSettings,
  updateSettings,
} from '@/lib/api'
import { money } from '@/lib/format'
import type { AdBanner, Settings } from '@/lib/types'

type Audience = 'all' | 'customers' | 'drivers'
type Period = 'day' | 'week' | 'month'

const AUD_LABEL: Record<Audience, string> = {
  all: 'التطبيقان (عميل + سائق)',
  customers: 'تطبيق العميل فقط',
  drivers: 'تطبيق السائق فقط',
}
const PERIOD_LABEL: Record<Period, string> = { day: 'يوم', week: 'أسبوع', month: 'شهر' }
const PERIOD_DAYS: Record<Period, number> = { day: 1, week: 7, month: 30 }

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

/** إدارة بنرات الإعلانات المدفوعة (صورة + رابط + مدة يوم/أسبوع/شهر بسعر ثابت). */
export default function AdsManager() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [ads, setAds] = useState<AdBanner[]>([])
  const [loading, setLoading] = useState(true)

  // بطاقة الأسعار (يحفظها الأدمن مرّة).
  const [pDay, setPDay] = useState(0)
  const [pWeek, setPWeek] = useState(0)
  const [pMonth, setPMonth] = useState(0)
  const [savedRates, setSavedRates] = useState('')

  // نموذج الإنشاء
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [title, setTitle] = useState('')
  const [link, setLink] = useState('')
  const [audience, setAudience] = useState<Audience>('all')
  const [period, setPeriod] = useState<Period>('week')
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
  useEffect(() => {
    void getSettings().then((s) => {
      setSettings(s)
      setPDay(s.ad_price_day ?? 0)
      setPWeek(s.ad_price_week ?? 0)
      setPMonth(s.ad_price_month ?? 0)
    })
    reload()
  }, [])

  const priceFor = (p: Period): number => {
    if (p === 'day') return settings?.ad_price_day ?? 0
    if (p === 'week') return settings?.ad_price_week ?? 0
    return settings?.ad_price_month ?? 0
  }
  const currentPrice = priceFor(period)

  const saveRates = async () => {
    setSavedRates('')
    const { error } = await updateSettings({
      ad_price_day: Math.max(0, pDay),
      ad_price_week: Math.max(0, pWeek),
      ad_price_month: Math.max(0, pMonth),
    })
    if (error) return setSavedRates(error)
    const s = await getSettings()
    setSettings(s)
    setSavedRates('حُفظت الأسعار ✓')
  }

  const pickImage = (f: File | null) => {
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : '')
  }

  const submit = async () => {
    if (!file) return setMsg('اختر صورة الإعلان أولاً.')
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
      period,
      days: PERIOD_DAYS[period],
      price: currentPrice,
      start_date: startDate,
    })
    setBusy(false)
    if (error) return setMsg(error)
    setFile(null)
    setPreview('')
    setTitle('')
    setLink('')
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
      {/* بطاقة الأسعار — يحدّدها الأدمن */}
      <div className="card space-y-3 p-4">
        <p className="font-bold text-royal">أسعار الإعلان (يحدّدها الأدمن)</p>
        <p className="text-xs text-ink-muted">
          المُعلِن يدفع مقدّماً حسب المدة المختارة. عدّل الأسعار متى شئت.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-sm">
            <span className="mb-1 block font-bold text-ink-soft">اليوم</span>
            <input
              type="number"
              min={0}
              step={500}
              className="input w-full"
              value={pDay}
              onChange={(e) => setPDay(Math.max(0, Number(e.target.value)))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold text-ink-soft">الأسبوع</span>
            <input
              type="number"
              min={0}
              step={500}
              className="input w-full"
              value={pWeek}
              onChange={(e) => setPWeek(Math.max(0, Number(e.target.value)))}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-bold text-ink-soft">الشهر</span>
            <input
              type="number"
              min={0}
              step={500}
              className="input w-full"
              value={pMonth}
              onChange={(e) => setPMonth(Math.max(0, Number(e.target.value)))}
            />
          </label>
        </div>
        {savedRates && <p className="text-sm font-medium text-green">{savedRates}</p>}
        <button className="btn-outline w-full" onClick={saveRates}>
          حفظ الأسعار
        </button>
      </div>

      {/* نموذج إنشاء إعلان */}
      <div className="card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Images className="h-5 w-5 text-royal" strokeWidth={2} />
          <p className="font-bold text-royal">بنر إعلان جديد</p>
        </div>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-sand py-6 text-sm font-bold text-ink-soft">
          {preview ? (
            <img src={preview} alt="معاينة" className="max-h-32 rounded-xl object-contain" />
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

        {/* أين يظهر */}
        <label className="text-sm">
          <span className="mb-1 block font-bold text-ink-soft">أين يظهر</span>
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

        {/* المدة */}
        <div>
          <span className="mb-1 block text-sm font-bold text-ink-soft">المدة</span>
          <div className="grid grid-cols-3 gap-2">
            {(['day', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-2xl border py-2.5 text-sm font-bold ${
                  period === p
                    ? 'border-royal bg-royal text-white'
                    : 'border-sand bg-sand-soft/40 text-ink-soft'
                }`}
              >
                {PERIOD_LABEL[p]}
                <span className="mt-0.5 block text-[11px] font-medium opacity-80">
                  {money(priceFor(p))}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* تاريخ البدء */}
        <label className="text-sm">
          <span className="mb-1 block font-bold text-ink-soft">تاريخ البدء</span>
          <input
            type="date"
            className="input w-full"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>

        <div className="rounded-2xl border border-sand/50 bg-sand-soft/40 p-3 text-sm">
          يدفع المُعلِن مقدّماً:{' '}
          <span className="font-extrabold text-royal">{money(currentPrice)}</span>{' '}
          <span className="text-ink-muted">({PERIOD_LABEL[period]})</span>
        </div>

        {msg && <p className="text-sm font-medium text-green">{msg}</p>}
        <button className="btn-primary w-full" disabled={busy} onClick={submit}>
          {busy ? '…' : 'نشر الإعلان'}
        </button>
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
                    {a.period ? PERIOD_LABEL[a.period] : `${a.days} يوم`} ·{' '}
                    <span className="font-bold text-royal">{money(a.price)}</span> (مدفوع مقدّماً)
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
