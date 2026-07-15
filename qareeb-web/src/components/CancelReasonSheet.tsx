import { useState } from 'react'

/** أسباب الإلغاء الشائعة للعميل — تُحفظ للتحليل وتحسين الخدمة. */
export const CANCEL_REASONS = [
  'السائق يتأخّر كثيراً',
  'السائق بعيد جداً',
  'وجدت وسيلة أخرى',
  'غيّرت وجهتي',
  'طلبت بالخطأ',
  'سبب آخر',
] as const

/**
 * ورقة اختيار سبب الإلغاء — تظهر قبل تأكيد الإلغاء. يختار العميل سبباً (اختياري)
 * ثم يؤكّد. تُستخدم في شاشة الرحلة (Trip) وشاشة البحث عن سائق (FindDriver).
 */
export default function CancelReasonSheet({
  busy,
  error,
  onConfirm,
  onDismiss,
}: {
  busy?: boolean
  error?: string
  onConfirm: (reason: string) => void
  onDismiss: () => void
}) {
  const [reason, setReason] = useState<string>('')

  return (
    <div className="space-y-2 rounded-2xl border border-hairline bg-ivory/60 p-3">
      <p className="text-center text-sm font-bold text-royal">لماذا تريد الإلغاء؟</p>
      <p className="text-center text-[11px] text-ink-muted">اختيار السبب اختياري ويساعدنا على التحسين.</p>
      <div className="grid grid-cols-2 gap-2 pt-1">
        {CANCEL_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`rounded-xl border px-2 py-2 text-[12px] font-medium transition-colors ${
              reason === r
                ? 'border-royal bg-royal text-ivory'
                : 'border-hairline bg-ivory text-ink-soft'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      {error && <p className="pt-1 text-center text-sm text-danger">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onConfirm(reason)}
          disabled={busy}
          className="flex-1 rounded-xl bg-danger px-3 py-2.5 text-sm font-bold text-white disabled:opacity-60"
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
