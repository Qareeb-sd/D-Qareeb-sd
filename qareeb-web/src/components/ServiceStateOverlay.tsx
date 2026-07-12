import type { ServiceState } from '@/data/services'

/**
 * غلاف حالة الخدمة فوق بطاقة المركبة:
 *   - maintenance: شريط سلامة (أصفر/أسود) مائل في **وسط** البطاقة + تعتيم خفيف.
 *   - coming_soon: طبقة ضبابية معتمة شفّافة مع «قريباً» — تُبقي فضول العميل دون كشف.
 *   - available/hidden: لا شيء (المخفية تُستبعد من العرض أصلاً).
 * يُوضع داخل حاوية position:relative تغطّي البطاقة كاملة.
 */
export default function ServiceStateOverlay({ state }: { state?: ServiceState }) {
  if (state === 'maintenance') {
    return (
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-white/45" />
        {/* شريط السلامة المائل في الوسط */}
        <div className="absolute inset-x-[-20%] top-1/2 -translate-y-1/2 -rotate-[14deg]">
          <div
            className="flex h-7 items-center justify-center text-[11px] font-extrabold tracking-wide text-black shadow-md"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg,#F4C20D 0 12px,#1A1A1A 12px 24px)',
            }}
          >
            <span className="rounded bg-[#F4C20D] px-2 py-0.5">صيانة</span>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'coming_soon') {
    return (
      <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-royal/55 backdrop-blur-[3px]" />
        <span className="relative rounded-full border border-sand/50 bg-royal/70 px-3 py-1 text-[11px] font-bold text-sand-soft">
          قريباً
        </span>
      </div>
    )
  }

  return null
}
