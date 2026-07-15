import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  Landmark,
  Clock,
  CheckCircle2,
  XCircle,
  Wallet as WalletIcon,
  Plus,
} from 'lucide-react'
import Logo from '@/components/Logo'
import DriverNav from '@/components/DriverNav'
import { useAuth } from '@/store/AuthContext'
import {
  getSettings,
  getWallet,
  listDriverTransactions,
  getMyWithdrawals,
  requestWithdrawal,
  createTopup,
  uploadTopupProof,
} from '@/lib/api'
import { money } from '@/lib/format'
import type { Settings } from '@/lib/types'

/** بداية اليوم بتوقيت الجهاز (لتجميع أرباح اليوم). */
function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** محفظة السائق: الرصيد + ملخّص الأرباح (اليوم/الأسبوع/الصافي) + سحب + سجل. */
export default function DriverWallet() {
  const { profile } = useAuth()
  const userId = profile?.id ?? 'demo-user'
  const qc = useQueryClient()

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['driver-wallet', userId],
    queryFn: () => getWallet(userId),
  })
  const { data: txs = [], isLoading: txLoading } = useQuery({
    queryKey: ['driver-transactions', wallet?.id],
    queryFn: () => listDriverTransactions(wallet!.id),
    enabled: Boolean(wallet?.id),
  })
  const { data: withdrawals = [] } = useQuery({
    queryKey: ['driver-withdrawals', userId],
    queryFn: () => getMyWithdrawals(userId),
  })
  const loading = walletLoading || (Boolean(wallet) && txLoading)

  const balance = wallet?.balance ?? 0
  const pending = withdrawals.find((w) => w.status === 'pending')

  // ملخّص الأرباح — الصافي = أرباح الرحلة − العمولة (العمولة مُخزَّنة بإشارة سالبة).
  const summary = useMemo(() => {
    const today = startOfToday()
    const weekAgo = Date.now() - 7 * 86400000
    let earnings = 0
    let commission = 0
    let netToday = 0
    let netWeek = 0
    let rides = 0
    for (const t of txs) {
      const ts = new Date(t.created_at).getTime()
      if (t.type === 'ride_earning') {
        earnings += t.amount
        rides += 1
      } else if (t.type === 'commission') {
        commission += Math.abs(t.amount)
      }
      if (t.type === 'ride_earning' || t.type === 'commission') {
        if (ts >= today) netToday += t.amount
        if (ts >= weekAgo) netWeek += t.amount
      }
    }
    return { earnings, commission, net: earnings - commission, netToday, netWeek, rides }
  }, [txs])

  const [showForm, setShowForm] = useState(false)
  const [showTopup, setShowTopup] = useState(false)
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['driver-wallet', userId] })
    void qc.invalidateQueries({ queryKey: ['driver-transactions', wallet?.id] })
    void qc.invalidateQueries({ queryKey: ['driver-withdrawals', userId] })
  }

  return (
    <div className="screen font-plex bg-ivory">
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-4">
        <Logo variant="driver" size={36} rounded={10} />
        <h1 className="text-lg font-bold">محفظتي</h1>
      </header>

      <main className="flex-1 px-4 pb-24">
        <div className="rounded-3xl bg-gradient-to-br from-sand to-sand-ink p-6 text-royal shadow-lift">
          <p className="text-sm text-royal/70">رصيدك القابل للسحب</p>
          <p className="mt-1 text-3xl font-extrabold">{loading ? '…' : money(balance)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => {
                setShowTopup((v) => !v)
                setShowForm(false)
              }}
              className="flex items-center gap-2 rounded-2xl bg-royal px-4 py-2.5 text-sm font-bold text-ivory"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              {showTopup ? 'إغلاق' : 'تعبئة الرصيد'}
            </button>
            {!pending && (
              <button
                onClick={() => {
                  setShowForm((v) => !v)
                  setShowTopup(false)
                }}
                disabled={balance <= 0}
                className="flex items-center gap-2 rounded-2xl bg-royal/20 px-4 py-2.5 text-sm font-bold text-royal disabled:opacity-50"
              >
                <WalletIcon className="h-4 w-4" strokeWidth={2} />
                {showForm ? 'إغلاق' : 'سحب الأرباح'}
              </button>
            )}
          </div>
        </div>

        {/* تعبئة الرصيد (لتغطية عمولة الرحلات النقدية) */}
        {showTopup && (
          <TopupForm
            settings={settings}
            walletId={wallet?.id}
            userId={userId}
            onDone={() => {
              setShowTopup(false)
              refresh()
            }}
          />
        )}

        {/* طلب سحب معلّق */}
        {pending && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-sand/50 bg-sand-soft/50 p-4">
            <Clock className="h-5 w-5 shrink-0 text-sand-ink" strokeWidth={2} />
            <div className="flex-1">
              <p className="text-sm font-bold text-sand-ink">طلب سحب قيد المراجعة</p>
              <p className="text-xs text-ink-muted">
                {money(pending.amount)} · {pending.method === 'cash' ? 'استلام نقدي' : 'تحويل بنكي'}
              </p>
            </div>
          </div>
        )}

        {/* نموذج السحب */}
        {showForm && !pending && (
          <WithdrawForm
            max={balance}
            onDone={() => {
              setShowForm(false)
              refresh()
            }}
          />
        )}

        {/* ملخّص الأرباح */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <SummaryCard value={money(summary.netToday)} label="صافي اليوم" />
          <SummaryCard value={money(summary.netWeek)} label="صافي الأسبوع" />
          <SummaryCard value={String(summary.rides)} label="عدد الرحلات" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="card p-4 text-center">
            <p className="text-lg font-extrabold text-green">{money(summary.net)}</p>
            <p className="text-xs text-ink-muted">صافي الأرباح الكلي</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-lg font-extrabold text-danger">{money(summary.commission)}</p>
            <p className="text-xs text-ink-muted">عمولة المنصة</p>
          </div>
        </div>

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
                <p className={`font-bold ${t.amount > 0 ? 'text-green' : 'text-danger'}`} dir="ltr">
                  {t.amount > 0 ? '+' : ''}
                  {money(Math.abs(t.amount))}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* سجل طلبات السحب */}
        {withdrawals.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 font-bold">طلبات السحب</h2>
            <div className="card divide-y divide-hairline p-0">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium">{money(w.amount)}</p>
                    <p className="text-xs text-ink-muted">
                      {w.method === 'cash' ? 'استلام نقدي' : 'تحويل بنكي'} ·{' '}
                      {new Date(w.created_at).toLocaleDateString('ar-SD')}
                    </p>
                  </div>
                  <WithdrawStatus status={w.status} />
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <DriverNav />
    </div>
  )
}

function SummaryCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-base font-extrabold text-sand-ink">{value}</p>
      <p className="text-[11px] text-ink-muted">{label}</p>
    </div>
  )
}

function WithdrawStatus({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  if (status === 'approved')
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-green">
        <CheckCircle2 className="h-4 w-4" /> مدفوع
      </span>
    )
  if (status === 'rejected')
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-danger">
        <XCircle className="h-4 w-4" /> مرفوض
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-xs font-bold text-sand-ink">
      <Clock className="h-4 w-4" /> معلّق
    </span>
  )
}

/** نموذج طلب سحب: مبلغ + طريقة استلام + وجهة (حساب/ملاحظة). */
function WithdrawForm({ max, onDone }: { max: number; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'bank_transfer'>('cash')
  const [destination, setDestination] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    const value = Math.round(Number(amount))
    setErr('')
    if (!value || value <= 0) return setErr('أدخل مبلغاً صحيحاً')
    if (value > max) return setErr('المبلغ أكبر من رصيدك')
    if (method === 'bank_transfer' && !destination.trim())
      return setErr('أدخل رقم الحساب/المحفظة لاستلام التحويل')
    setBusy(true)
    const { error } = await requestWithdrawal(value, method, destination.trim() || null)
    setBusy(false)
    if (error) return setErr(error)
    onDone()
  }

  return (
    <div className="card mt-4 space-y-3 p-4">
      <p className="font-bold text-royal">طلب سحب</p>
      <div>
        <label className="mb-1 block text-xs text-ink-muted">المبلغ (بحد أقصى {money(max)})</label>
        <input
          className="field text-left"
          dir="ltr"
          inputMode="numeric"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-muted">طريقة الاستلام</label>
        <div className="grid grid-cols-2 gap-2">
          <MethodChip
            active={method === 'cash'}
            onClick={() => setMethod('cash')}
            Icon={Banknote}
            label="نقداً"
          />
          <MethodChip
            active={method === 'bank_transfer'}
            onClick={() => setMethod('bank_transfer')}
            Icon={Landmark}
            label="تحويل بنكي"
          />
        </div>
      </div>
      {method === 'bank_transfer' && (
        <input
          className="field text-left"
          dir="ltr"
          placeholder="رقم الحساب أو المحفظة"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
      )}
      {err && <p className="text-sm text-danger">{err}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-2xl bg-royal px-4 py-3 text-sm font-bold text-ivory disabled:opacity-60"
      >
        {busy ? '…' : 'إرسال الطلب'}
      </button>
      <p className="text-[11px] text-ink-muted">
        يُخصم المبلغ فوراً من رصيدك ويُعاد كاملاً إن رُفض الطلب.
      </p>
    </div>
  )
}

/** تعبئة رصيد السائق بتحويل بنكي + إثبات — يعتمدها الأدمن (كتعبئة العميل). */
function TopupForm({
  settings,
  walletId,
  userId,
  onDone,
}: {
  settings?: Settings
  walletId?: string
  userId: string
  onDone: () => void
}) {
  const [amount, setAmount] = useState('')
  const [proof, setProof] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    const value = Math.round(Number(amount))
    if (!walletId) return setErr('المحفظة غير جاهزة')
    if (!value || value <= 0) return setErr('أدخل مبلغاً صحيحاً')
    setBusy(true)
    let proofPath: string | null = null
    if (proof) {
      const up = await uploadTopupProof(userId, proof)
      if (up.error) {
        setBusy(false)
        return setErr(`تعذّر رفع الإثبات: ${up.error}`)
      }
      proofPath = up.path ?? null
    }
    const { error } = await createTopup(walletId, value, proofPath)
    setBusy(false)
    if (error) return setErr(error)
    setDone(true)
  }

  return (
    <div className="card mt-4 space-y-3 p-4">
      <p className="font-bold text-royal">تعبئة الرصيد بتحويل بنكي</p>
      <p className="text-xs text-ink-muted">
        عبّئ رصيدك لتغطية عمولة المنصة على الرحلات النقدية. يُضاف الرصيد بعد اعتماد الإدارة.
      </p>
      {settings && (
        <div className="rounded-2xl bg-sand-soft/60 p-3 text-sm text-ink">
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
        <div className="rounded-2xl bg-green-soft p-4 text-center text-sm text-green">
          تم إرسال طلب التعبئة للمراجعة. سيُضاف الرصيد بعد اعتماد الإدارة.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-ink-muted">المبلغ المحوّل</label>
            <input
              className="field text-left"
              dir="ltr"
              inputMode="numeric"
              placeholder="مثال: 20000"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">إثبات التحويل</label>
            <input
              type="file"
              accept="image/*"
              className="field"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            />
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-royal px-4 py-3 text-sm font-bold text-ivory disabled:opacity-60"
          >
            {busy ? '…' : 'إرسال للمراجعة'}
          </button>
        </form>
      )}
      <button onClick={onDone} className="w-full text-center text-xs text-ink-muted">
        إغلاق
      </button>
    </div>
  )
}

function MethodChip({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  Icon: typeof Banknote
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
        active ? 'border-royal bg-royal text-ivory' : 'border-hairline bg-ivory text-ink-soft'
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.9} />
      {label}
    </button>
  )
}
