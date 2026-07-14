import { useEffect, useState } from 'react'
import { Crown, Wallet, Landmark, Upload, Clock, CheckCircle2 } from 'lucide-react'
import {
  getSettings,
  getMyVipRequest,
  requestVip,
  uploadTopupProof,
} from '@/lib/api'
import { money } from '@/lib/format'
import type { Driver, Settings, VipRequest } from '@/lib/types'

/**
 * بطاقة الاشتراك في VIP للسائق — تظهر عندما لا يكون الاشتراك سارياً.
 * خياران: الدفع من المحفظة (فوري) أو تحويل بنكي بإيصال (اعتماد أدمن).
 */
export default function VipSubscribe({
  driver,
  userId,
  onChanged,
}: {
  driver: Driver
  userId: string
  onChanged: () => void
}) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [req, setReq] = useState<VipRequest | null>(null)
  const [mode, setMode] = useState<'idle' | 'transfer'>('idle')
  const [proof, setProof] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [loaded, setLoaded] = useState(false)

  const reload = () => {
    void getMyVipRequest(userId).then(setReq)
  }

  useEffect(() => {
    void Promise.all([getSettings(), getMyVipRequest(userId)]).then(([s, r]) => {
      setSettings(s)
      setReq(r)
      setLoaded(true)
    })
  }, [userId])

  if (!loaded || !settings) return null

  const fee = settings.vip_subscription_fee ?? 0
  const now = Date.now()
  const vipActive =
    Boolean(driver.vip) &&
    Boolean(driver.vip_paid_until) &&
    new Date(driver.vip_paid_until as string).getTime() > now

  // اشتراك ساري → لا نعرض بطاقة الاشتراك (تُعرض حالته في مكان آخر).
  if (vipActive) return null
  // الاشتراك غير مفعّل من الأدمن.
  if (fee <= 0) return null

  // طلب قيد المراجعة (تحويل بنكي).
  if (req && req.status === 'pending') {
    return (
      <div className="mt-4 rounded-2xl border border-sand bg-sand-soft/40 p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-sand-ink" strokeWidth={2} />
          <p className="font-bold text-royal">طلب اشتراك VIP قيد المراجعة</p>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          استلمنا طلبك بقيمة <span className="font-bold text-royal">{money(req.amount)}</span>.
          سيُفعّل اشتراكك فور اعتماد التحويل من الإدارة.
        </p>
      </div>
    )
  }

  const submitWallet = async () => {
    setBusy(true)
    setMsg('')
    const { error } = await requestVip('wallet')
    setBusy(false)
    if (error) return setMsg(error)
    setMsg('تم تفعيل اشتراك VIP من محفظتك ✓')
    reload()
    onChanged()
  }

  const submitTransfer = async () => {
    if (!proof) return setMsg('أرفق صورة إيصال التحويل أولاً.')
    setBusy(true)
    setMsg('')
    const up = await uploadTopupProof(userId, proof)
    if (up.error) {
      setBusy(false)
      return setMsg(up.error)
    }
    const { error, status } = await requestVip('bank_transfer', up.path ?? null)
    setBusy(false)
    if (error) return setMsg(error)
    if (status === 'pending') {
      setMsg('أُرسل طلبك — بانتظار اعتماد الإدارة.')
      setMode('idle')
      setProof(null)
      reload()
    }
  }

  const bank = settings.bank_name || settings.bank_account_number

  return (
    <div className="mt-4 rounded-2xl border border-sand bg-gradient-to-br from-royal to-[#0A2C22] p-4 text-white">
      <div className="flex items-center gap-2">
        <Crown className="h-5 w-5 text-sand" strokeWidth={2} />
        <p className="font-bold">اشترك كسائق VIP</p>
      </div>
      <p className="mt-1 text-sm text-white/75">
        بلا عمولة على رحلاتك مقابل اشتراك شهري ثابت. الرسم الحالي:{' '}
        <span className="font-bold text-sand">{money(fee)}</span> / شهر.
      </p>

      {req && req.status === 'rejected' && (
        <p className="mt-2 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/80">
          طلبك السابق لم يُعتمد{req.note ? ` — ${req.note}` : ''}. يمكنك المحاولة من جديد.
        </p>
      )}

      {mode === 'idle' ? (
        <div className="mt-3 space-y-2">
          <button
            onClick={submitWallet}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sand py-3 font-extrabold text-royal disabled:opacity-60"
          >
            <Wallet className="h-[18px] w-[18px]" strokeWidth={2} />
            {busy ? '…' : 'ادفع من المحفظة'}
          </button>
          <button
            onClick={() => setMode('transfer')}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/25 py-3 font-bold text-white disabled:opacity-60"
          >
            <Landmark className="h-[18px] w-[18px]" strokeWidth={2} />
            تحويل بنكي بإيصال
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {bank && (
            <div className="rounded-xl bg-white/10 p-3 text-sm">
              <p className="mb-1 font-bold text-sand">حوّل المبلغ إلى:</p>
              {settings.bank_name && <p>البنك: {settings.bank_name}</p>}
              {settings.bank_account_name && <p>الاسم: {settings.bank_account_name}</p>}
              {settings.bank_account_number && (
                <p dir="ltr" className="text-left">
                  الحساب: {settings.bank_account_number}
                </p>
              )}
            </div>
          )}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/30 py-3 text-sm font-bold text-white">
            <Upload className="h-[18px] w-[18px]" strokeWidth={2} />
            {proof ? proof.name : 'أرفق صورة الإيصال'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={submitTransfer}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-sand py-3 font-extrabold text-royal disabled:opacity-60"
            >
              <CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={2} />
              {busy ? '…' : 'إرسال الطلب'}
            </button>
            <button
              onClick={() => {
                setMode('idle')
                setProof(null)
              }}
              disabled={busy}
              className="flex-1 rounded-2xl border border-white/25 py-3 font-bold text-white"
            >
              رجوع
            </button>
          </div>
        </div>
      )}

      {msg && <p className="mt-2 text-center text-sm font-medium text-sand">{msg}</p>}
    </div>
  )
}
