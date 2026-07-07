import { useNavigate } from 'react-router-dom'
import Logo from '@/components/Logo'

/** أونبوردنق نصّي (بدون رسمة) — يطابق تصميم تطبيق العميل. */
const points = [
  { title: 'نقل آمن في كل السودان', text: 'سائقون موثوقون في كل مدن السودان.' },
  { title: 'ادفع كما يناسبك', text: 'كاش · تحويل بنكي · محفظة قريب.' },
  { title: 'ترحيل يومي', text: 'رتّب مشوارك اليومي ذهاباً وإياباً بضغطة.' },
]

export default function Onboarding() {
  const navigate = useNavigate()

  return (
    <div className="screen justify-between px-6 py-10">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Logo size={92} rounded={24} />
        <h1 className="mt-6 text-3xl font-extrabold text-green">قريب</h1>
        <p className="mt-1 text-ink-soft">نقل آمن في كل السودان</p>

        <ul className="mt-10 w-full space-y-4 text-right">
          {points.map((p) => (
            <li key={p.title} className="card flex items-start gap-3 p-4">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-gold" />
              <div>
                <p className="font-bold">{p.title}</p>
                <p className="text-sm text-ink-soft">{p.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <button className="btn-primary mt-8 w-full" onClick={() => navigate('/auth')}>
        يلا نبدأ
      </button>
    </div>
  )
}
