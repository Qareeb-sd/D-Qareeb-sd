import { money } from '@/lib/format'
import type { FareParts } from '@/lib/pricing'

/**
 * إيصال أجرة مفصّل — طلب المشوار + المسافة + الوقت + الحد الأدنى + الخصم + الإجمالي.
 * يُستخدم في تحديد الرحلة (تقدير) وشاشة الرحلة والتقييم (إيصال نهائي).
 */
export default function FareReceipt({
  b,
  km,
  min,
  estimate,
}: {
  b: FareParts
  km?: number
  min?: number
  estimate?: boolean
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-ivory/50 p-3.5 text-[13px]">
      <p className="mb-2 flex items-center justify-between font-bold text-royal">
        <span>تفصيل الأجرة</span>
        {estimate && <span className="text-[10px] font-medium text-ink-muted">تقديري</span>}
      </p>
      <div className="space-y-1.5">
        <Line label="طلب المشوار" value={money(b.base)} />
        <Line
          label={`مقابل المسافة${km != null ? ` · ${km.toFixed(1)} كم` : ''}`}
          value={money(b.distance)}
        />
        <Line
          label={`مقابل الوقت${min != null ? ` · ${Math.round(min)} د` : ''}`}
          value={money(b.time)}
        />
        {b.minApplied && (
          <Line label="الحدّ الأدنى للرحلة" value="مطبّق" muted />
        )}
        {b.discount > 0 && (
          <>
            <Line label="الإجمالي قبل الخصم" value={money(b.gross)} muted />
            <Line label="الخصم" value={`− ${money(b.discount)}`} discount />
          </>
        )}
        <div className="my-1 border-t border-dashed border-hairline" />
        <Line label="الإجمالي" value={money(b.total)} strong />
      </div>
      <p className="mt-2 text-[10px] text-ink-muted">تُقرّب الأجرة لأقرب 100 ج.س.</p>
    </div>
  )
}

function Line({
  label,
  value,
  strong,
  discount,
  muted,
}: {
  label: string
  value: string
  strong?: boolean
  discount?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-ink-muted' : 'text-ink-soft'}>{label}</span>
      <span
        className={
          strong
            ? 'text-[15px] font-extrabold text-royal'
            : discount
              ? 'font-bold text-green'
              : muted
                ? 'text-ink-muted'
                : 'font-semibold text-ink'
        }
      >
        {value}
      </span>
    </div>
  )
}
