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

/**
 * رسم SVG توضيحي — خريطة السودان الحقيقية (صورة ظلّية) وعليها خطوط التوصيل
 * الذهبية المتقطّعة بين المدن، ودبوس "قريب" النابض على الخرطوم.
 */
// حدود السودان المبسّطة (شمال مسطّح مع مصر، نتوء البحر الأحمر شمال‑شرق، جنوب متعرّج).
const SUDAN_PATH =
  'M95 55 L132 51 L170 48 L196 47 L205 40 L213 51 L219 65 L213 80 L206 92 ' +
  'L200 104 L188 112 L176 121 L160 126 L146 120 L132 126 L120 121 L110 113 ' +
  'L100 97 L93 80 L90 66 L92 58 Z'

// مدن على خطوط التوصيل — الخرطوم هي المحور.
const KHARTOUM_DOT = { x: 150, y: 86 }
const CITIES = [
  { x: 208, y: 60 }, // بورتسودان (البحر الأحمر)
  { x: 199, y: 95 }, // كسلا (شرق)
  { x: 135, y: 60 }, // دنقلا (شمال)
  { x: 112, y: 100 }, // نيالا/الفاشر (غرب)
  { x: 168, y: 112 }, // مدني/الأبيض (جنوب‑شرق)
]

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

      {/* شكل السودان الحقيقي */}
      <path d={SUDAN_PATH} fill="#1B6B3F" opacity="0.14" />
      <path d={SUDAN_PATH} fill="none" stroke="#1B6B3F" strokeWidth="1.5" opacity="0.4" strokeLinejoin="round" />

      {/* خطوط التوصيل الذهبية من الخرطوم إلى بقية المدن */}
      {CITIES.map((c, i) => (
        <line
          key={i}
          x1={KHARTOUM_DOT.x}
          y1={KHARTOUM_DOT.y}
          x2={c.x}
          y2={c.y}
          stroke="#C9A138"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="5 4"
          opacity="0.6"
        >
          <animate
            attributeName="stroke-dashoffset"
            values="18;0"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </line>
      ))}

      {/* نقاط المدن */}
      {CITIES.map((c, i) => (
        <circle key={`d${i}`} cx={c.x} cy={c.y} r="3.5" fill="#1B6B3F" opacity="0.55" />
      ))}

      {/* دبوس قريب النابض على الخرطوم */}
      <g>
        <ellipse cx={KHARTOUM_DOT.x} cy={KHARTOUM_DOT.y} rx="12" ry="7" fill="#1B6B3F" opacity="0.15">
          <animate attributeName="rx" values="12;17;12" dur="2s" repeatCount="indefinite" />
          <animate attributeName="ry" values="7;10;7" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.15;0.04;0.15" dur="2s" repeatCount="indefinite" />
        </ellipse>
        <path
          d={`M${KHARTOUM_DOT.x} ${KHARTOUM_DOT.y - 18}c-5.5 0-10 4.3-10 9.6 0 6.8 8.7 15 9.5 15.7a1 1 0 0 0 1 0c.8-.7 9.5-8.9 9.5-15.7 0-5.3-4.5-9.6-10-9.6Z`}
          fill="#1B6B3F"
        />
        <circle cx={KHARTOUM_DOT.x} cy={KHARTOUM_DOT.y - 8.5} r="4.5" fill="none" stroke="#C9A138" strokeWidth="1.5" />
        <circle cx={KHARTOUM_DOT.x} cy={KHARTOUM_DOT.y - 8.5} r="2" fill="#C9A138" />
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
