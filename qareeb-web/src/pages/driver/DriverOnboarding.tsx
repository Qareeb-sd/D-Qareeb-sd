import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '@/components/Logo'
import SudanMap from '@/components/SudanMap'

/** أونبوردنق السائق «قريب كابتن» — نفس خريطة السودان، بهوية ليمونية. */
const points = [
  {
    title: 'اكسب من كل مشوار',
    text: 'استقبل الطلبات القريبة منك في كل مدن السودان.',
  },
  {
    title: 'أنت تحدّد وقتك',
    text: 'اتصل ساعة ما تريد، وافصل وقت ما تريد.',
  },
  {
    title: 'رحلات الترحيل',
    text: 'اقبل مشاوير الترحيل اليومية المجمّعة بدخل ثابت.',
  },
]

export default function DriverOnboarding() {
  const navigate = useNavigate()
  const [activeDot, setActiveDot] = useState(0)

  return (
    <div className="screen justify-between px-6 py-8">
      <div className="flex flex-1 flex-col items-center text-center">
        <Logo variant="driver" size={80} rounded={22} />
        <h1 className="mt-4 text-3xl font-extrabold text-green-dark">قريب كابتن</h1>
        <p className="mt-1 text-ink-soft">كن كابتن في كل السودان</p>

        {/* خريطة السودان مع خطوط التوصيل — نفس خريطة العميل */}
        <div className="mx-auto mt-5 w-full max-w-[210px] rounded-3xl bg-lemon/15 p-3">
          <SudanMap className="h-auto w-full" />
        </div>

        {/* بطاقات المميزات */}
        <ul className="mt-6 w-full space-y-3 text-right">
          {points.map((p, i) => (
            <li
              key={p.title}
              className="card flex items-start gap-3 p-4 transition-opacity"
              style={{ opacity: activeDot === i ? 1 : 0.7 }}
              onMouseEnter={() => setActiveDot(i)}
            >
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-lemon" />
              <div>
                <p className="font-bold text-sm">{p.title}</p>
                <p className="text-xs text-ink-soft mt-0.5">{p.text}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* نقاط التقدم */}
        <div className="mt-5 flex items-center gap-2">
          {points.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveDot(i)}
              className={`rounded-full transition-all duration-300 ${
                activeDot === i
                  ? 'h-2.5 w-6 bg-lemon'
                  : 'h-2.5 w-2.5 bg-hairline hover:bg-ink-muted'
              }`}
              aria-label={`نقطة ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <button className="btn-driver mt-6 w-full" onClick={() => navigate('/driver/login')}>
        يلا نبدأ
      </button>
    </div>
  )
}
