import { useNavigate } from 'react-router-dom'
import Logo from '@/components/Logo'
import SudanMap from '@/components/SudanMap'

/** شاشة ترحيب — شعار وخريطة السودان ومميّزات الخدمة. */
const points = [
  {
    title: 'نقل آمن في كل السودان',
    text: 'سائقون موثوقون في كل مدن السودان.',
  },
  {
    title: 'ادفع كما يناسبك',
    text: 'كاش · تحويل بنكي · محفظة قريب.',
  },
  {
    title: 'ترحيل يومي',
    text: 'رتّب مشوارك اليومي ذهاباً وإياباً بضغطة.',
  },
]

export default function Onboarding() {
  const navigate = useNavigate()

  return (
    <div className="screen justify-between px-6 py-8">
      <div className="flex flex-1 flex-col items-center text-center">
        <Logo size={80} rounded={22} />
        <h1 className="mt-4 text-3xl font-extrabold text-royal">قريب</h1>
        <p className="mt-1 text-ink-soft">نقل آمن في كل السودان</p>

        {/* خريطة السودان مع خطوط التوصيل */}
        <div className="mx-auto mt-5 w-full max-w-[210px] rounded-3xl bg-royal-soft p-3">
          <SudanMap className="h-auto w-full" />
        </div>

        {/* بطاقات المميزات */}
        <ul className="mt-6 w-full space-y-3 text-right">
          {points.map((p) => (
            <li key={p.title} className="card flex items-start gap-3 p-4">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-sand" />
              <div>
                <p className="font-bold text-sm">{p.title}</p>
                <p className="text-xs text-ink-soft mt-0.5">{p.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <button
        className="btn-primary mt-6 w-full"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        onClick={() => navigate('/auth')}
      >
        لنبدأ
      </button>
    </div>
  )
}
