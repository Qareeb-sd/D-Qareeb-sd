import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Gift, Wallet as WalletIcon, Ticket, Check } from 'lucide-react'
import Screen from '@/components/Screen'
import { useAuth } from '@/store/AuthContext'
import { getMyLoyalty, listRewards, redeemReward, listMyRedemptions } from '@/lib/api'
import { money } from '@/lib/format'
import type { Reward } from '@/lib/types'

/** متجر المكافآت: يستبدل العميل نقاط الولاء بمكافآت مُنسّقة. */
export default function Rewards() {
  const { profile } = useAuth()
  const userId = profile?.id ?? 'demo-user'
  const qc = useQueryClient()

  const { data: loyalty } = useQuery({ queryKey: ['loyalty', userId], queryFn: getMyLoyalty })
  const { data: rewards, isError, refetch } = useQuery({ queryKey: ['rewards'], queryFn: listRewards })
  const { data: history = [] } = useQuery({
    queryKey: ['my-redemptions', userId],
    queryFn: listMyRedemptions,
  })

  const points = loyalty?.points ?? 0
  const [busy, setBusy] = useState<string | null>(null)

  const redeem = async (r: Reward) => {
    if (points < r.cost_points) return
    if (!window.confirm(`استبدال ${r.cost_points} نقطة بـ «${r.title}»؟`)) return
    setBusy(r.id)
    const res = await redeemReward(r.id)
    setBusy(null)
    if (res.error) return alert(res.error)
    await qc.invalidateQueries({ queryKey: ['loyalty', userId] })
    await qc.invalidateQueries({ queryKey: ['my-redemptions', userId] })
    await qc.invalidateQueries({ queryKey: ['wallet', userId] })
    if (res.kind === 'wallet') alert(`تمت إضافة ${money(res.value ?? 0)} إلى محفظتك 🎉`)
    else alert(`تم استبدال مكافأتك! رمز الاستلام: ${res.code}\nأظهره للدعم لاستلامها.`)
  }

  return (
    <Screen title="متجر المكافآت" back>
      {/* رصيد النقاط */}
      <div className="rounded-3xl bg-gradient-to-br from-sand to-[#c9a961] p-5 text-royal shadow-float">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Gift className="h-5 w-5" strokeWidth={2} />
          نقاطك الحالية
        </p>
        <p className="mt-1 text-3xl font-extrabold">{points.toLocaleString('en')} نقطة</p>
      </div>

      {isError ? (
        <div className="card mt-4 p-6 text-center">
          <p className="text-sm text-ink-soft">تعذّر تحميل المكافآت.</p>
          <button onClick={() => void refetch()} className="mt-3 text-sm font-bold text-royal">
            إعادة المحاولة
          </button>
        </div>
      ) : rewards === undefined ? (
        <div className="card mt-4 h-24 animate-pulse" />
      ) : rewards.length === 0 ? (
        <p className="card mt-4 p-6 text-center text-sm text-ink-muted">لا توجد مكافآت متاحة حالياً</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rewards.map((r) => {
            const enough = points >= r.cost_points
            return (
              <div key={r.id} className="card flex items-center gap-3 p-4">
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
                    r.kind === 'wallet' ? 'bg-green/10 text-green' : 'bg-royal-soft text-royal'
                  }`}
                >
                  {r.kind === 'wallet' ? (
                    <WalletIcon className="h-6 w-6" strokeWidth={1.9} />
                  ) : (
                    <Ticket className="h-6 w-6" strokeWidth={1.9} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-royal">{r.title}</p>
                  {r.description && <p className="text-xs text-ink-muted">{r.description}</p>}
                  <p className="mt-0.5 text-xs font-bold text-sand-ink">{r.cost_points} نقطة</p>
                </div>
                <button
                  onClick={() => void redeem(r)}
                  disabled={!enough || busy === r.id}
                  className="shrink-0 rounded-xl bg-royal px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  {busy === r.id ? '…' : 'استبدال'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* سجلّ الاستبدالات */}
      {history.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-bold">استبدالاتك</h2>
          <div className="card divide-y divide-hairline p-0">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-royal">{h.title}</p>
                  <p className="text-xs text-ink-muted">
                    {new Date(h.created_at).toLocaleDateString('ar-SD')} · {h.cost_points} نقطة
                    {h.code && (
                      <>
                        {' '}
                        · رمز: <span className="font-bold text-sand-ink">{h.code}</span>
                      </>
                    )}
                  </p>
                </div>
                {h.status === 'fulfilled' ? (
                  <span className="flex items-center gap-1 rounded-md bg-green/10 px-1.5 py-0.5 text-xs font-bold text-green">
                    <Check className="h-3.5 w-3.5" /> تم
                  </span>
                ) : (
                  <span className="rounded-md bg-sand-soft px-1.5 py-0.5 text-xs font-bold text-sand-ink">
                    قيد الاستلام
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Screen>
  )
}
