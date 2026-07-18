import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { money } from '@/lib/format'

/**
 * أسباب الإلغاء مع رموزها. الإعفاء الوحيد المؤكَّد آلياً هو «السائق بعيد»
 * (يتحقّق منه الخادم بالمسافة/الزمن). ادّعاءات «سيارة/سائق مختلف» تُسجَّل
 * لمراجعة الأدمن وردّ الرسوم للحالات الصادقة — لا إعفاء تلقائي (منع التهرّب).
 */
export interface CancelReason {
  code: string
  label: string
  /** مبرّر محتمل (بلا رسوم) — الخادم يحسم «السائق بعيد» بحسب المسافة/الزمن. */
  excusable: boolean
}

export const CANCEL_REASONS: CancelReason[] = [
  { code: 'driver_far', label: 'السائق بعيد عني', excusable: true },
  { code: 'car_mismatch', label: 'السيارة مختلفة عن المعروضة', excusable: false },
  { code: 'driver_mismatch', label: 'السائق مختلف عن المعروض', excusable: false },
  { code: 'changed_mind', label: 'غيّرت رأيي', excusable: false },
  { code: 'long_wait', label: 'الانتظار طويل', excusable: false },
  { code: 'other', label: 'سبب آخر', excusable: false },
]

/**
 * ورقة اختيار سبب الإلغاء — تظهر قبل التأكيد. عند وجود رسوم (بعد قبول السائق)
 * تُنبّه العميل أنّ الأسباب غير المبرّرة تُخصم. تُستخدم في شاشة الرحلة والبحث.
 */
export default function CancelReasonSheet({
  busy,
  error,
  fee = 0,
  onConfirm,
  onDismiss,
}: {
  busy?: boolean
  error?: string
  /** قيمة الرسوم إن كان الإلغاء بعد القبول (0 = لا رسوم/قبل القبول). */
  fee?: number
  onConfirm: (reason: CancelReason) => void
  onDismiss: () => void
}) {
  const [picked, setPicked] = useState<CancelReason | null>(null)
  const showFeeWarn = fee > 0 && picked != null && !picked.excusable

  return (
    <div className="space-y-2 rounded-2xl border border-hairline bg-ivory/60 p-3">
      <p className="text-center text-sm font-bold text-royal">لماذا تريد الإلغاء؟</p>
      {fee > 0 ? (
        <p className="text-center text-[11px] text-ink-muted">
          الإلغاء لسبب مبرّر بلا رسوم. غير ذلك تُخصم رسوم {money(fee)}.
        </p>
      ) : (
        <p className="text-center text-[11px] text-ink-muted">اختيار السبب اختياري ويساعدنا على التحسين.</p>
      )}
      <div className="grid grid-cols-2 gap-2 pt-1">
        {CANCEL_REASONS.map((r) => (
          <button
            key={r.code}
            type="button"
            onClick={() => setPicked(r)}
            className={`rounded-xl border px-2 py-2 text-[12px] font-medium transition-colors ${
              picked?.code === r.code
                ? 'border-royal bg-royal text-ivory'
                : 'border-hairline bg-ivory text-ink-soft'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {showFeeWarn && (
        <p className="flex items-center justify-center gap-1.5 rounded-xl bg-warning/10 px-2 py-2 text-center text-[11.5px] font-medium text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          سيُخصم {money(fee)} رسوم إلغاء (يُضاف لرحلتك القادمة إن لم يكفِ رصيدك).
        </p>
      )}
      {picked?.code === 'driver_far' && fee > 0 && (
        <p className="text-center text-[11px] text-ink-muted">
          بلا رسوم إن كان السائق بعيداً فعلاً عنك.
        </p>
      )}
      {(picked?.code === 'car_mismatch' || picked?.code === 'driver_mismatch') && fee > 0 && (
        <p className="text-center text-[11px] text-ink-muted">
          تُراجع الإدارة بلاغك، وتُعاد الرسوم إن ثبتت المخالفة.
        </p>
      )}

      {error && <p className="pt-1 text-center text-sm text-danger">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => picked && onConfirm(picked)}
          disabled={busy || !picked}
          className="flex-1 rounded-xl bg-danger px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? '…' : 'تأكيد الإلغاء'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          className="flex-1 rounded-xl border border-hairline bg-ivory px-3 py-2.5 text-sm font-bold text-ink-soft"
        >
          تراجع
        </button>
      </div>
    </div>
  )
}
