import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, CheckCircle2, XCircle, Plus, Landmark, ArrowDownToLine } from 'lucide-react'
import Logo from '@/components/Logo'
import DriverNav from '@/components/DriverNav'
import { useAuth } from '@/store/AuthContext'
import {
  getSettings,
  getWallet,
  listDriverTransactions,
  getMyWithdrawals,
  getDriverRideStats,
  requestWithdrawal,
  convertEarningsToBalance,
  createTopup,
  uploadTopupProof,
} from '@/lib/api'
import ReceiptUpload from '@/components/ReceiptUpload'
import { money } from '@/lib/format'
import type { Settings } from '@/lib/types'

/** محفظة السائق: الرصيد (فلوت) + قيمة المشاوير + مدفوعات العملاء (سحب/تحويل للرصيد). */
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
  const { data: stats } = useQuery({
    queryKey: ['driver-ride-stats', userId],
    queryFn: () => getDriverRideStats(),
  })
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const loading = walletLoading || (Boolean(wallet) && txLoading)

  const balance = wallet?.balance ?? 0
  const withdrawable = Math.max(0, wallet?.withdrawable ?? 0)
  const pending = withdrawals.find((w) => w.status === 'pending')

  const [panel, setPanel] = useState<'topup' | 'bank' | 'convert' | null>(null)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['driver-wallet', userId] })
    void qc.invalidateQueries({ queryKey: ['driver-transactions', wallet?.id] })
    void qc.invalidateQueries({ queryKey: ['driver-withdrawals', userId] })
  }
  const toggle = (p: 'topup' | 'bank' | 'convert') => setPanel((cur) => (cur === p ? null : p))

  return (
    <div className="screen font-plex bg-ivory">
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-4">
        <Logo variant="driver" size={36} rounded={10} />
        <h1 className="text-lg font-bold">محفظتي</h1>
      </header>

      <main className="flex-1 px-4 pb-24">
        {/* الرصيد (الفلوت) + تعبئة */}
        <div className="rounded-3xl bg-gradient-to-br from-sand to-sand-ink p-6 text-royal shadow-lift">
          <p className="text-sm text-royal/70">الرصيد</p>
          <p className="mt-1 text-3xl font-extrabold">{loading ? '…' : money(balance)}</p>
          <p className="mt-1 text-xs text-royal/70">يُستخدم لتغطية عمولة الرحلات النقدية</p>
          <button
            onClick={() => toggle('topup')}
            className="mt-4 flex items-center gap-2 rounded-2xl bg-royal px-4 py-2.5 text-sm font-bold text-ivory"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            {panel === 'topup' ? 'إغلاق' : 'تعبئة الرصيد'}
          </button>
        </div>

        {panel === 'topup' && (
          <TopupForm
            settings={settings}
            walletId={wallet?.id}
            userId={userId}
            onDone={() => {
              setPanel(null)
              refresh()
            }}
          />
        )}

        {/* مدفوعات العملاء (وعاء منفصل) + سحب/تحويل */}
        <div className="card mt-4 p-4">
          <p className="text-sm text-ink-muted">مدفوعات العملاء (المحفظة)</p>
          <p className="mt-1 text-2xl font-extrabold text-green">{money(withdrawable)}</p>
          <p className="mt-1 text-[11px] text-ink-muted">
            ما سدّده العملاء عبر محفظة قريب — لك سحبه بنكياً أو تحويله إلى رصيدك.
          </p>
          {pending ? (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-sand/50 bg-sand-soft/50 p-3">
              <Clock className="h-4 w-4 shrink-0 text-sand-ink" strokeWidth={2} />
              <p className="text-xs text-sand-ink">
                طلب سحب بنكي قيد المراجعة: {money(pending.amount)}
              </p>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => toggle('bank')}
                disabled={withdrawable <= 0}
                className="flex items-center gap-2 rounded-2xl bg-royal px-4 py-2.5 text-sm font-bold text-ivory disabled:opacity-50"
              >
                <Landmark className="h-4 w-4" strokeWidth={2} />
                {panel === 'bank' ? 'إغلاق' : 'تحويل بنكي'}
              </button>
              <button
                onClick={() => toggle('convert')}
                disabled={withdrawable <= 0}
                className="flex items-center gap-2 rounded-2xl bg-royal/15 px-4 py-2.5 text-sm font-bold text-royal disabled:opacity-50"
              >
                <ArrowDownToLine className="h-4 w-4" strokeWidth={2} />
                {panel === 'convert' ? 'إغلاق' : 'تحويل إلى الرصيد'}
              </button>
            </div>
          )}
        </div>

        {panel === 'bank' && !pending && (
          <BankWithdrawForm
            max={withdrawable}
            onDone={() => {
              setPanel(null)
              refresh()
            }}
          />
        )}
        {panel === 'convert' && !pending && (
          <ConvertForm
            max={withdrawable}
            onDone={() => {
              setPanel(null)
              refresh()
            }}
          />
        )}

        {/* قيمة المشاوير */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatCard value={money(stats?.today ?? 0)} label="قيمة مشاوير اليوم" />
          <StatCard value={money(stats?.month ?? 0)} label="قيمة الشهر" />
          <StatCard value={money(stats?.total ?? 0)} label="القيمة الكليّة" />
        </div>
        <p className="mt-2 text-center text-[11px] text-ink-muted">
          إجمالي رحلاتك المكتملة: {stats?.count ?? 0}
        </p>

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
                <p className={`font-bold ${t.amount > 0 ? 'text-green' : 'text-danger'}`} dir="ltr">
                  {t.amount > 0 ? '+' : ''}
                  {money(Math.abs(t.amount))}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* سجل طلبات السحب البنكي */}
        {withdrawals.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 font-bold">طلبات السحب البنكي</h2>
            <div className="card divide-y divide-hairline p-0">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium">{money(w.amount)}</p>
                    <p className="text-xs text-ink-muted">
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

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-[15px] font-extrabold text-sand-ink">{value}</p>
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

/** سحب بنكي: مبلغ + رقم حساب/محفظة — طلب يعتمده الأدمن. */
function BankWithdrawForm({ max, onDone }: { max: number; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    const value = Math.round(Number(amount))
    setErr('')
    if (!value || value <= 0) return setErr('أدخل مبلغاً صحيحاً')
    if (value > max) return setErr('المبلغ أكبر من المتاح')
    if (!accountName.trim()) return setErr('أدخل اسم صاحب الحساب')
    if (!accountNumber.trim()) return setErr('أدخل رقم الحساب/المحفظة')
    setBusy(true)
    // نضمّن اسم صاحب الحساب مع الرقم ليراهما الأدمن عند التحويل.
    const destination = `${accountName.trim()} — ${accountNumber.trim()}`
    const { error } = await requestWithdrawal(value, destination)
    setBusy(false)
    if (error) return setErr(error)
    onDone()
  }

  return (
    <div className="card mt-3 space-y-3 p-4">
      <p className="font-bold text-royal">تحويل بنكي</p>
      <div>
        <label className="mb-1 block text-xs text-ink-muted">المبلغ (المتاح {money(max)})</label>
        <input
          className="field text-left"
          dir="ltr"
          inputMode="numeric"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
        />
      </div>
      <input
        className="field"
        placeholder="اسم صاحب الحساب"
        value={accountName}
        onChange={(e) => setAccountName(e.target.value)}
      />
      <input
        className="field text-left"
        dir="ltr"
        placeholder="رقم الحساب أو المحفظة"
        value={accountNumber}
        onChange={(e) => setAccountNumber(e.target.value)}
      />
      {err && <p className="text-sm text-danger">{err}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-2xl bg-royal px-4 py-3 text-sm font-bold text-ivory disabled:opacity-60"
      >
        {busy ? '…' : 'إرسال الطلب'}
      </button>
      <p className="text-[11px] text-ink-muted">يُخصم المبلغ فوراً ويُعاد إن رُفض الطلب.</p>
    </div>
  )
}

/** تحويل مدفوعات العملاء إلى الرصيد (فوري). */
function ConvertForm({ max, onDone }: { max: number; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    const value = Math.round(Number(amount))
    setErr('')
    if (!value || value <= 0) return setErr('أدخل مبلغاً صحيحاً')
    if (value > max) return setErr('المبلغ أكبر من المتاح')
    setBusy(true)
    const { error } = await convertEarningsToBalance(value)
    setBusy(false)
    if (error) return setErr(error)
    onDone()
  }

  return (
    <div className="card mt-3 space-y-3 p-4">
      <p className="font-bold text-royal">تحويل إلى الرصيد</p>
      <p className="text-[11px] text-ink-muted">
        يُضاف المبلغ إلى رصيدك فوراً لتستخدمه في تغطية العمولات.
      </p>
      <div>
        <label className="mb-1 block text-xs text-ink-muted">المبلغ (المتاح {money(max)})</label>
        <input
          className="field text-left"
          dir="ltr"
          inputMode="numeric"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
        />
      </div>
      {err && <p className="text-sm text-danger">{err}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-2xl bg-royal px-4 py-3 text-sm font-bold text-ivory disabled:opacity-60"
      >
        {busy ? '…' : 'تحويل إلى الرصيد'}
      </button>
    </div>
  )
}

/** تعبئة رصيد السائق بتحويل بنكي + إثبات — يعتمدها الأدمن. */
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
        عبّئ رصيدك لتغطية عمولة الرحلات النقدية. يُضاف الرصيد بعد اعتماد الإدارة.
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
            <ReceiptUpload value={proof} onChange={setProof} />
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
