import { useEffect, useRef, useState } from 'react'
import { ImageUp, CheckCircle2, X } from 'lucide-react'

/**
 * حقل رفع إيصال التحويل مع معاينة واضحة — يعرض صورة مصغّرة واسم الملف وعلامة
 * «تم الإرفاق» بعد الاختيار، فيتأكّد المستخدم أن الصورة أُرفقت ولا يكرّرها.
 * يُستخدم في تعبئة العميل والسائق.
 */
export default function ReceiptUpload({
  value,
  onChange,
}: {
  value: File | null
  onChange: (f: File | null) => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!value) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(value)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-green/40 bg-green-soft/50 p-2.5">
        {preview && (
          <img
            src={preview}
            alt="إيصال"
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-bold text-green">
            <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2.2} />
            تم إرفاق الإيصال
          </p>
          <p className="truncate text-[11px] text-ink-muted">{value.name}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null)
            if (inputRef.current) inputRef.current.value = ''
          }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted"
          aria-label="إزالة"
        >
          <X className="h-4 w-4" strokeWidth={2.2} />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </div>
    )
  }

  return (
    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline bg-ivory/60 px-4 py-4 text-sm font-medium text-ink-soft">
      <ImageUp className="h-5 w-5 text-green" strokeWidth={1.9} />
      إرفاق صورة إيصال التحويل
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  )
}
