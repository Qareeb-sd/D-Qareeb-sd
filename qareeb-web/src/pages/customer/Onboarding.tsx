import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '@/components/Logo'

/** أونبوردنق — مع رسم توضيحي خفيف ونقاط تقدم */
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

/** رسم SVG توضيحي — خريطة سودان مبسطة + طرق + نقاط */
function Illustration() {
  return (
    <svg
      viewBox="0 0 320 180"
      className="mx-auto mt-6 w-full max-w-[280px]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* خلفية */}
      <rect width="320" height="180" rx="20" fill="#E8F1EC" />
      {/* شكل السودان المبسط */}
      <path
        d="M60 140 Q55 110 70 90 Q80 70 110 65 Q140 60 160 70 Q190 55 220 65 Q250 75 260 100 Q265 120 250 140 Q230 155 190 150 Q160 148 130 152 Q100 155 80 148 Q65 145 60 140Z"
        fill="#1B6B3F"
        opacity="0.12"
      />
      {/* طرق */}
      <path
        d="M80 130 Q120 100 160 110 Q200 120 240 95"
        stroke="#C9A138"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="6 4"
        opacity="0.5"
      />
      <path
        d="M100 80 Q140 100 160 110 Q180 120 210 130"
        stroke="#C9A138"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="4 4"
        opacity="0.35"
      />
      {/* نقاط المدن */}
      <circle cx="100" cy="80" r="5" fill="#1B6B3F" opacity="0.6" />
      <circle cx="160" cy="110" r="6" fill="#1B6B3F" />
      <circle cx="240" cy="95" r="5" fill="#1B6B3F" opacity="0.6" />
      <circle cx="210" cy="130" r="4" fill="#1B6B3F" opacity="0.4" />
      {/* دبوس قريب متحرك */}
      <g>
        <ellipse cx="160" cy="110" rx="14" ry="8" fill="#1B6B3F" opacity="0.15">
          <animate attributeName="rx" values="14;18;14" dur="2s" repeatCount="indefinite" />
          <animate attributeName="ry" values="8;10;8" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.15;0.05;0.15" dur="2s" repeatCount="indefinite" />
        </ellipse>
        <path
          d="M160 92c-5.5 0-10 4.3-10 9.6 0 6.8 8.7 15 9.5 15.7a1 1 0 0 0 1 0c.8-.7 9.5-8.9 9.5-15.7 0-5.3-4.5-9.6-10-9.6Z"
          fill="#1B6B3F"
        />
        <circle cx="160" cy="101.5" r="4.5" fill="none" stroke="#C9A138" strokeWidth="1.5" />
        <circle cx="160" cy="101.5" r="2" fill="#C9A138" />
      </g>
      {/* سيارة صغيرة */}
      <g transform="translate(135, 118)">
        <rect x="0" y="4" width="18" height="6" rx="3" fill="#52584E" opacity="0.3" />
        <circle cx="5" cy="11" r="2" fill="#52584E" opacity="0.4" />
        <circle cx="14" cy="11" r="2" fill="#52584E" opacity="0.4" />
      </g>
      {/* نجوم زخرفية */}
      <circle cx="50" cy="40" r="1.5" fill="#C9A138" opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.8;0.4" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx="280" cy="50" r="2" fill="#C9A138" opacity="0.3">
        <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="270" cy="140" r="1.5" fill="#C9A138" opacity="0.35">
        <animate attributeName="opacity" values="0.35;0.6;0.35" dur="4s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [activeDot, setActiveDot] = useState(0)

  return (
    <div className="screen justify-between px-6 py-8">
      <div className="flex flex-1 flex-col items-center text-center">
        <Logo size={80} rounded={22} />
        <h1 className="mt-4 text-3xl font-extrabold text-green">قريب</h1>
        <p className="mt-1 text-ink-soft">نقل آمن في كل السودان</p>

        {/* رسم توضيحي */}
        <Illustration />

        {/* بطاقات المميزات */}
        <ul className="mt-6 w-full space-y-3 text-right">
          {points.map((p, i) => (
            <li
              key={p.title}
              className="card flex items-start gap-3 p-4 transition-opacity"
              style={{ opacity: activeDot === i ? 1 : 0.7 }}
              onMouseEnter={() => setActiveDot(i)}
            >
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-gold" />
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
                  ? 'h-2.5 w-6 bg-green'
                  : 'h-2.5 w-2.5 bg-hairline hover:bg-ink-muted'
              }`}
              aria-label={`نقطة ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <button className="btn-primary mt-6 w-full" onClick={() => navigate('/auth')}>
        يلا نبدأ
      </button>
    </div>
  )
}
