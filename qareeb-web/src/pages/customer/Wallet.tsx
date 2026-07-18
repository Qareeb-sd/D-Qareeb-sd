import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import BottomNav from '@/components/BottomNav'
import Logo from '@/components/Logo'
import ReceiptUpload from '@/components/ReceiptUpload'
import { money, toAsciiDigits } from '@/lib/format'
import { useAuth } from '@/store/AuthContext'
import {
  getSettings,
  getWallet,
  listTransactions,
  createTopup,
  uploadTopupProof,
  getMyLoyalty,
  redeemLoyalty,
} from '@/lib/api'
import { Award, Gift } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/** محفظة قريب: الرصيد + التعبئة بتحويل بنكي ورفع إثبات + سجل المعاملات. */
export default function Wallet() {
  const { profile } = useAuth()
  const userId = profile?.id ?? 'demo-user'
  const qc = useQueryClient()
  const navigate = useNavigate()

  // قراءات عبر react-query — إعادة محاولة تلقائية وتخزين مؤقت (يناسب الشبكة الضعيفة).
  // إعادة جلب دورية (وعند العودة للتطبيق) ليظهر الرصيد فور اعتماد الأدمن.
  const live = { refetchInterval: 15000, refetchOnWindowFocus: true as const }
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet', userId],
    queryFn: () => getWallet(userId),
    ...live,
  })
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const {
    data: txs = [],
    isLoading: txLoading,
    isError: txError,
  } = useQuery({
    queryKey: ['transactions', wallet?.id],
    queryFn: () => listTransactions(wallet!.id),
    enabled: Boolean(wallet?.id),
    ...live,
  })
  const loading = walletLoading || (Boolean(wallet) && txLoading)

  const { data: loyalty } = useQuery({
    queryKey: ['loyalty', userId],
    queryFn: getMyLoyalty,
    ...live,
  })
  const [redeeming, setRedeeming] = useState(false)
  const redeem = async () => {
    if (!loyalty || loyalty.points <= 0) return
    if (!window.confirm(`استبدال ${loyalty.points} نقطة بـ ${money(loyalty.points * loyalty.point_value)} في محفظتك؟`))
      return
    setRedeeming(true)
    const { amount, error } = await redeemLoyalty(loyalty.points)
    setRedeeming(false)
    if (error) return alert(error)
    await qc.invalidateQueries({ queryKey: ['loyalty', userId] })
    await qc.invalidateQueries({ queryKey: ['wallet', userId] })
    alert(`تمت إضافة ${money(amount ?? 0)} إلى محفظتك 🎉`)
  }

  const [showTopup, setShowTopup] = useState(false)
  const [amount, setAmount] = useState('')
  const [proof, setProof] = useState<File | null>(null)
  const [done, setDone] = useState(false)

  const topupMut = useMutation({
    mutationFn: async () => {
      // مبلغ صحيح موجب (يقبل الأرقام العربية، ويمنع NaN والصفر/السالب).
      const amt = Number(toAsciiDigits(amount))
      if (!Number.isFinite(amt) || amt < 500) {
        throw new Error('أدخل مبلغاً صحيحاً (٥٠٠ ج.س على الأقل)')
      }
      // إرفاق صورة الإيصال إلزامي — لا يُقبل الطلب بدونها.
      if (!proof) throw new Error('يجب إرفاق صورة إيصال التحويل قبل الإرسال')
      const up = await uploadTopupProof(userId, proof)
      if (up.error) throw new Error(`تعذّر رفع الإثبات: ${up.error}`)
      const proofPath = up.path ?? null
      const { error } = await createTopup(wallet!.id, amt, proofPath)
      if (error) throw new Error(error)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transactions', wallet?.id] })
      void qc.invalidateQueries({ queryKey: ['wallet', userId] })
      setDone(true)
      setAmount('')
      setProof(null)
    },
  })

  const submitTopup = (e: React.FormEvent) => {
    e.preventDefault()
    if (!wallet) return
    topupMut.mutate()
  }
  const submitting = topupMut.isPending
  const error = topupMut.error?.message ?? ''

  return (
    <div className="screen">
      <header className="flex items-center gap-3 px-4 py-4">
        <Logo size={36} rounded={10} />
        <h1 className="text-lg font-bold text-royal">محفظة قريب</h1>
      </header>

      <main className="flex-1 px-4 pb-24">
        {/* بطاقة الرصيد */}
        <div className="rounded-3xl bg-gradient-to-br from-royal to-[#0a2c22] p-6 text-white shadow-float ring-1 ring-sand/40">
          <p className="text-sm text-white/70">رصيدك الحالي</p>
          <p className="mt-1 text-3xl font-extrabold" style={{ color: '#e3c98f' }}>
            {loading ? '…' : money(wallet?.balance ?? 0)}
          </p>
          <button
            onClick={() => setShowTopup((v) => !v)}
            className="press-scale mt-4 rounded-2xl bg-white/15 px-5 py-2.5 font-bold text-white hover:bg-white/25"
          >
            تعبئة الرصيد
          </button>
        </div>

        {/* نقاط الولاء — تظهر عند تفعيلها من الأدمن */}
        {loyalty && loyalty.point_value > 0 && (
          <div className="card mt-4 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sand-soft text-sand-ink">
                <Award className="h-6 w-6" strokeWidth={1.9} />
              </span>
              <div className="flex-1">
                <p className="font-bold text-royal">نقاط الولاء</p>
                <p className="text-xs text-ink-muted">
                  لديك <span className="font-bold text-sand-ink">{loyalty.points}</span> نقطة ={' '}
                  {money(loyalty.points * loyalty.point_value)}
                </p>
              </div>
              <button
                onClick={redeem}
                disabled={redeeming || loyalty.points <= 0}
                className="rounded-xl bg-royal px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {redeeming ? '…' : 'نقداً'}
              </button>
            </div>
            <button
              onClick={() => navigate('/rewards')}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-sand/50 bg-gold-soft py-2.5 text-sm font-bold text-sand-ink"
            >
              <Gift className="h-4 w-4" strokeWidth={2} />
              متجر المكافآت
            </button>
          </div>
        )}

        {/* نموذج التعبئة */}
        {showTopup && (
          <div className="card mt-4 space-y-3 p-4">
            <p className="font-bold">تعبئة بتحويل بنكي</p>
            {settings && (
              <div className="rounded-2xl bg-gold-soft p-3 text-sm text-ink">
                <p>
                  <span className="text-ink-soft">البنك:</span> {settings.bank_name}
                </p>
                <p>
                  <span className="text-ink-soft">اسم الحساب:</span> {settings.bank_account_name}
                </p>
                <p dir="ltr" className="text-left">
                  <span className="text-ink-soft">الرقم:</span> {settings.bank_account_number}
                </p>
              </div>
            )}

            {done ? (
              <div className="rounded-2xl bg-royal-soft p-4 text-center text-sm text-royal">
                تم إرسال طلب التعبئة للمراجعة. سيُضاف الرصيد بعد اعتماد الأدمن.
              </div>
            ) : (
              <form onSubmit={submitTopup} className="space-y-3">
                <div>
                  <label className="label">المبلغ المحوّل</label>
                  <input
                    className="field"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="مثال: 20000"
                    required
                  />
                </div>
                <div>
                  <label className="label">إثبات التحويل (إلزامي)</label>
                  <ReceiptUpload value={proof} onChange={setProof} />
                  {!proof && (
                    <p className="mt-1 text-[11px] text-ink-muted">
                      أرفق صورة إيصال التحويل لتفعيل زرّ الإرسال.
                    </p>
                  )}
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                <button
                  className="btn-gold w-full"
                  type="submit"
                  disabled={submitting || !proof}
                >
                  {submitting ? '…' : 'إرسال للمراجعة'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* سجل المعاملات */}
        <h2 className="mb-2 mt-6 font-bold">سجل المعاملات</h2>
        {loading ? (
          <div className="card h-24 animate-pulse" />
        ) : txError ? (
          <p className="card p-4 text-center text-sm text-ink-soft">تعذّر تحميل سجلّ المعاملات.</p>
        ) : txs.length === 0 ? (
          <p className="card p-4 text-center text-sm text-ink-muted">لا توجد معاملات بعد</p>
        ) : (
          <div className="card divide-y divide-hairline p-0">
            {txs.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{t.note ?? t.type}</p>
                  <p className="text-xs text-ink-muted">
                    {new Date(t.created_at).toLocaleDateString('ar-SD')}
                  </p>
                </div>
                <p
                  className={`font-bold ${t.amount > 0 ? 'text-royal' : 'text-danger'}`}
                  dir="ltr"
                >
                  {t.amount > 0 ? '+' : ''}
                  {money(Math.abs(t.amount))}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
