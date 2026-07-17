import { useEffect, useState } from 'react'
import { Gift, Copy, Share2, Check, Users } from 'lucide-react'
import Screen from '@/components/Screen'
import { getMyReferralCode, applyReferralCode, getSettings } from '@/lib/api'
import { useAuth } from '@/store/AuthContext'
import { money } from '@/lib/format'

/** دعوة صديق — يشارك العميل رمزه، ومن يُدعى يُدخل رمز صديقه لمرّة واحدة. */
export default function Referral() {
  const { profile } = useAuth()
  const [code, setCode] = useState<string | null>(null)
  const [reward, setReward] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const [entered, setEntered] = useState('')
  const [applyBusy, setApplyBusy] = useState(false)
  const [applyMsg, setApplyMsg] = useState('')
  const alreadyReferred = !!profile?.referred_by

  useEffect(() => {
    void getMyReferralCode().then(setCode)
    void getSettings().then((s) => setReward(s.referral_reward))
  }, [])

  const shareText = code
    ? `انضم إليّ في تطبيق قريب للمشاوير 🚗\nاستخدم رمز الدعوة: ${code}\nونحصل معاً على مكافأة عند أول رحلة لك.`
    : ''

  const copy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      /* المتصفح قد يمنع الحافظة */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const share = async () => {
    if (!shareText) return
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({ text: shareText })
        return
      } catch {
        /* أُلغيت المشاركة */
      }
    }
    // بديل: واتساب
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
  }

  const apply = async () => {
    const c = entered.trim().toUpperCase()
    if (!c) return
    setApplyBusy(true)
    setApplyMsg('')
    const { error } = await applyReferralCode(c)
    setApplyBusy(false)
    if (error) {
      setApplyMsg(
        error.includes('own') || error.includes('نفس')
          ? 'لا يمكنك استخدام رمزك الخاص.'
          : error.includes('already') || error.includes('مسبق')
            ? 'لقد استخدمت رمز دعوة من قبل.'
            : 'رمز غير صحيح، تأكّد منه وحاول مجدداً.',
      )
    } else {
      setApplyMsg('تم إدخال الرمز ✓ ستصلكما المكافأة عند إتمام أول رحلة لك.')
      setEntered('')
    }
  }

  return (
    <Screen title="دعوة صديق" back>
      {/* بطاقة الرمز */}
      <div className="card overflow-hidden p-0">
        <div className="bg-green px-5 py-6 text-center text-white">
          <Gift className="mx-auto h-9 w-9" strokeWidth={1.7} />
          <p className="mt-2 text-sm opacity-90">شارك رمزك واربحا معاً</p>
          {reward != null && reward > 0 && (
            <p className="mt-1 text-lg font-extrabold">
              {money(reward)} لكلٍّ منكما
            </p>
          )}
        </div>
        <div className="p-5">
          <p className="mb-2 text-center text-xs text-ink-muted">رمز الدعوة الخاص بك</p>
          <div className="flex items-center justify-center gap-2">
            <span
              className="rounded-xl border-2 border-dashed border-green bg-green-mint px-6 py-3 text-2xl font-black tracking-[0.3em] text-green"
              dir="ltr"
            >
              {code ?? '……'}
            </span>
            <button
              onClick={copy}
              disabled={!code}
              className="rounded-xl border border-hairline p-3 text-green disabled:opacity-50"
              aria-label="نسخ الرمز"
            >
              {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            </button>
          </div>
          <button
            onClick={share}
            disabled={!code}
            className="btn-primary mt-4 flex w-full items-center justify-center gap-2 disabled:opacity-60"
          >
            <Share2 className="h-5 w-5" strokeWidth={2} />
            مشاركة الرمز
          </button>
        </div>
      </div>

      {/* كيف تعمل */}
      <div className="card mt-4 p-4">
        <p className="mb-3 flex items-center gap-2 font-bold text-royal">
          <Users className="h-4 w-4 text-green" strokeWidth={2} />
          كيف تعمل الدعوة؟
        </p>
        <ol className="space-y-2 text-[13px] text-ink-soft">
          <li>١. أرسل رمزك لصديق لم يستخدم قريب من قبل.</li>
          <li>٢. يُدخل صديقك الرمز في هذه الشاشة عند التسجيل.</li>
          <li>٣. عند إتمامه أوّل رحلة، تصلكما المكافأة في المحفظة تلقائياً.</li>
        </ol>
      </div>

      {/* إدخال رمز صديق */}
      <div className="card mt-4 p-4">
        <p className="mb-1 font-bold text-royal">هل لديك رمز دعوة؟</p>
        {alreadyReferred ? (
          <p className="rounded-xl bg-green-mint px-4 py-3 text-center text-sm text-ink-soft">
            لقد أدخلت رمز دعوة مسبقاً. شكراً لانضمامك عبر صديق ✓
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-ink-muted">
              أدخل رمز صديقك مرّة واحدة قبل أوّل رحلة لك.
            </p>
            <div className="flex gap-2">
              <input
                className="field flex-1 text-center text-lg font-bold tracking-widest"
                dir="ltr"
                placeholder="XXXXXX"
                maxLength={6}
                value={entered}
                onChange={(e) => setEntered(e.target.value.toUpperCase())}
              />
              <button
                onClick={apply}
                disabled={applyBusy || entered.trim().length < 6}
                className="btn-primary px-6 disabled:opacity-60"
              >
                {applyBusy ? '…' : 'تأكيد'}
              </button>
            </div>
            {applyMsg && (
              <p
                className={`mt-2 text-sm ${
                  applyMsg.startsWith('تم') ? 'text-green' : 'text-danger'
                }`}
              >
                {applyMsg}
              </p>
            )}
          </>
        )}
      </div>
    </Screen>
  )
}
