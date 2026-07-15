import { Shield, MapPin, Wallet, Star } from 'lucide-react'
import Screen from '@/components/Screen'
import Logo from '@/components/Logo'

const FEATURES = [
  { Icon: MapPin, text: 'حجز رحلات داخل السودان بخريطة دقيقة وأسعار واضحة.' },
  { Icon: Wallet, text: 'دفع مرن: نقداً أو تحويلاً بنكياً أو من محفظة قريب.' },
  { Icon: Shield, text: 'أمان أوّلاً: جهات طوارئ، مشاركة رحلة مباشرة، وزر استغاثة.' },
  { Icon: Star, text: 'تقييم شفّاف للسائق والمركبة بعد كل رحلة.' },
]

/** عن قريب — تعريف بالتطبيق ومزاياه ورقم الإصدار. */
export default function About() {
  return (
    <Screen title="عن قريب" back>
      <div className="flex flex-col items-center py-4 text-center">
        <Logo size={72} rounded={20} />
        <p className="mt-3 text-xl font-extrabold text-green">قريب</p>
        <p className="text-sm text-ink-soft">تنقّلك في السودان، بثقة وراحة.</p>
      </div>

      <div className="card mt-2 divide-y divide-hairline p-0">
        {FEATURES.map(({ Icon, text }, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <Icon className="h-5 w-5 shrink-0 text-green" strokeWidth={1.8} />
            <span className="text-[13px] text-ink-soft">{text}</span>
          </div>
        ))}
      </div>

      <p className="mt-5 text-center text-xs text-ink-muted">الإصدار 0.1.0</p>
      <p className="mt-1 text-center text-[11px] text-ink-muted">
        © {new Date().getFullYear()} قريب — جميع الحقوق محفوظة.
      </p>
    </Screen>
  )
}
