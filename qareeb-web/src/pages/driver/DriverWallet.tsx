import { useQuery } from '@tanstack/react-query'
import Logo from '@/components/Logo'
import DriverNav from '@/components/DriverNav'
import { useAuth } from '@/store/AuthContext'
import { getWallet, listDriverTransactions } from '@/lib/api'
import { money } from '@/lib/format'

/** محفظة السائق: الرصيد + الأرباح والعمولة المخصومة + سجل المعاملات. */
export default function DriverWallet() {
  const { profile } = useAuth()
  const userId = profile?.id ?? 'demo-user'

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['driver-wallet', userId],
    queryFn: () => getWallet(userId),
  })
  const { data: txs = [], isLoading: txLoading } = useQuery({
    queryKey: ['driver-transactions', wallet?.id],
    queryFn: () => listDriverTransactions(wallet!.id),
    enabled: Boolean(wallet?.id),
  })
  const loading = walletLoading || (Boolean(wallet) && txLoading)

  const earnings = txs
    .filter((t) => t.type === 'ride_earning')
    .reduce((s, t) => s + t.amount, 0)
  const commission = txs
    .filter((t) => t.type === 'commission')
    .reduce((s, t) => s + Math.abs(t.amount), 0)

  return (
    <div className="screen font-plex bg-ivory">
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-4">
        <Logo variant="driver" size={36} rounded={10} />
        <h1 className="text-lg font-bold">محفظتي</h1>
      </header>

      <main className="flex-1 px-4 pb-24">
        <div className="rounded-3xl bg-gradient-to-br from-sand to-sand-ink p-6 text-royal shadow-lift">
          <p className="text-sm text-royal/70">رصيدك الحالي</p>
          <p className="mt-1 text-3xl font-extrabold">
            {loading ? '…' : money(wallet?.balance ?? 0)}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="card p-4 text-center">
            <p className="text-lg font-extrabold text-sand-ink">{money(earnings)}</p>
            <p className="text-xs text-ink-muted">إجمالي الأرباح</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-lg font-extrabold text-danger">{money(commission)}</p>
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
      </main>

      <DriverNav />
    </div>
  )
}
