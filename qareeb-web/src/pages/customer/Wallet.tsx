import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import BottomNav from '@/components/BottomNav'
import Logo from '@/components/Logo'
import ReceiptUpload from '@/components/ReceiptUpload'
import { money } from '@/lib/format'
import { useAuth } from '@/store/AuthContext'
import {
  getSettings,
  getWallet,
  listTransactions,
  createTopup,
  uploadTopupProof,
} from '@/lib/api'

/** محفظة قريب: الرصيد + التعبئة بتحويل بنكي ورفع إثبات + سجل المعاملات. */
export default function Wallet() {
  const { profile } = useAuth()
  const userId = profile?.id ?? 'demo-user'
  const qc = useQueryClient()

  // قراءات عبر react-query — إعادة محاولة تلقائية وتخزين مؤقت (يناسب الشبكة الضعيفة).
  // إعادة جلب دورية (وعند العودة للتطبيق) ليظهر الرصيد فور اعتماد الأدمن.
  const live = { refetchInterval: 15000, refetchOnWindowFocus: true as const }
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet', userId],
    queryFn: () => getWallet(userId),
    ...live,
  })
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const { data: txs = [], isLoading: txLoading } = useQuery({
    queryKey: ['transactions', wallet?.id],
    queryFn: () => listTransactions(wallet!.id),
    enabled: Boolean(wallet?.id),
    ...live,
  })
  const loading = walletLoading || (Boolean(wallet) && txLoading)

  const [showTopup, setShowTopup] = useState(false)
  const [amount, setAmount] = useState('')
  const [proof, setProof] = useState<File | null>(null)
  const [done, setDone] = useState(false)

  const topupMut = useMutation({
    mutationFn: async () => {
      // ارفع إثبات التحويل (إن وُجد) إلى Storage ثم أرسل طلب التعبئة بمساره.
      let proofPath: string | null = null
      if (proof) {
        const up = await uploadTopupProof(userId, proof)
        if (up.error) throw new Error(`تعذّر رفع الإثبات: ${up.error}`)
        proofPath = up.path ?? null
      }
      const { error } = await createTopup(wallet!.id, Number(amount), proofPath)
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
                  <label className="label">إثبات التحويل</label>
                  <ReceiptUpload value={proof} onChange={setProof} />
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                <button className="btn-gold w-full" type="submit" disabled={submitting}>
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
