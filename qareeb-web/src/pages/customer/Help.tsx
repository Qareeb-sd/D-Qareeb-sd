import { useState } from 'react'
import { ChevronDown, MessageSquare, ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Screen from '@/components/Screen'

/** الأسئلة الشائعة — تجيب عن أكثر ما يشغل الراكب دون الحاجة لتواصل. */
const FAQ: { q: string; a: string }[] = [
  {
    q: 'كيف أطلب رحلة؟',
    a: 'من الرئيسية اختر الخدمة، ثم حدّد نقطة الانطلاق والوجهة على الخريطة أو بالبحث، ثم اضغط «اطلب رحلة». سيصلك أقرب سائق.',
  },
  {
    q: 'كيف أدفع؟',
    a: 'تختار طريقة الدفع قبل تأكيد الرحلة: نقداً للسائق، أو تحويل بنكي، أو من محفظة قريب. المحفظة تُخصم مسبقاً وتُسترجع كاملة إن أُلغيت الرحلة.',
  },
  {
    q: 'كيف أشحن محفظتي؟',
    a: 'من شاشة «المحفظة» اطلب شحناً، وحوّل المبلغ حسب التعليمات، ويُضاف رصيدك بعد اعتماد الإدارة.',
  },
  {
    q: 'ألغيت رحلة وكنت قد دفعت — هل يُرجع مالي؟',
    a: 'نعم. إذا كنت دفعت من المحفظة، يُعاد كامل المبلغ إلى رصيدك فور الإلغاء قبل بدء الرحلة.',
  },
  {
    q: 'كيف أضمن سلامتي أثناء الرحلة؟',
    a: 'أضف جهات الطوارئ من «حسابي»، وشارك رحلتك المباشرة مع من تثق به عبر رمز يتابع به موقعك لحظياً، واستخدم زر الطوارئ عند الحاجة.',
  },
  {
    q: 'العنوان يظهر غير دقيق — ماذا أفعل؟',
    a: 'حرّك الخريطة حتى يستقرّ الدبوس على موقعك بدقّة، أو ابحث باسم المنطقة/الشارع. يمكنك حفظ أماكنك المتكرّرة من «العناوين المحفوظة».',
  },
]

/** المساعدة والدعم — أسئلة شائعة قابلة للطيّ. */
export default function Help() {
  const [open, setOpen] = useState<number | null>(0)
  const navigate = useNavigate()
  return (
    <Screen title="المساعدة والدعم" back>
      {/* تواصل مباشر مع الدعم */}
      <button
        onClick={() => navigate('/support')}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-royal px-4 py-3.5 text-right text-white"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15">
          <MessageSquare className="h-5 w-5" strokeWidth={2} />
        </span>
        <span className="flex-1">
          <span className="block font-bold">تواصل مع الدعم</span>
          <span className="block text-xs text-white/70">راسل فريقنا مباشرة داخل التطبيق</span>
        </span>
        <ChevronLeft className="h-5 w-5 text-white/70" strokeWidth={2} />
      </button>

      <p className="mb-3 text-sm text-ink-soft">إجابات سريعة لأكثر الأسئلة تكراراً.</p>
      <div className="space-y-2">
        {FAQ.map((item, i) => {
          const isOpen = open === i
          return (
            <div key={i} className="card overflow-hidden p-0">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center gap-2 px-4 py-3.5 text-right"
              >
                <span className="flex-1 font-bold text-ink">{item.q}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isOpen && (
                <p className="border-t border-hairline px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
                  {item.a}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </Screen>
  )
}
