import { useState } from 'react'
import BottomNav from '@/components/BottomNav'
import Logo from '@/components/Logo'

/**
 * ترحيل: مشوار يومي ذهاب/إياب + اختيار الأيام + إيقاف بالعطلات + مشاركة مع عدد أشخاص.
 */
const days = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']

export default function Commute() {
  const [selected, setSelected] = useState<string[]>(['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء'])
  const [roundTrip, setRoundTrip] = useState(true)
  const [pauseHolidays, setPauseHolidays] = useState(true)
  const [shared, setShared] = useState(false)
  const [people, setPeople] = useState(1)

  const toggleDay = (d: string) =>
    setSelected((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))

  return (
    <div className="screen">
      <header className="flex items-center gap-3 px-4 py-4">
        <Logo size={36} rounded={10} />
        <h1 className="text-lg font-bold">ترحيل يومي</h1>
      </header>

      <main className="flex-1 space-y-4 px-4 pb-4">
        <div className="card space-y-3 p-4">
          <div>
            <label className="label">من</label>
            <input className="field" placeholder="نقطة الانطلاق" />
          </div>
          <div>
            <label className="label">إلى</label>
            <input className="field" placeholder="الوجهة" />
          </div>
        </div>

        {/* ذهاب وإياب */}
        <Toggle
          label="ذهاب وإياب"
          desc="رحلة العودة في نفس اليوم"
          value={roundTrip}
          onChange={setRoundTrip}
        />

        {/* الأيام */}
        <div className="card p-4">
          <p className="label">أيام الترحيل</p>
          <div className="flex flex-wrap gap-2">
            {days.map((d) => {
              const on = selected.includes(d)
              return (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  className={`chip border px-3 py-1.5 ${
                    on
                      ? 'border-green bg-green text-white'
                      : 'border-hairline bg-white text-ink-soft'
                  }`}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>

        {/* إيقاف بالعطلات */}
        <Toggle
          label="إيقاف في العطلات الرسمية"
          desc="لا يُحتسب مشوار في أيام العطل"
          value={pauseHolidays}
          onChange={setPauseHolidays}
        />

        {/* مشاركة */}
        <div className="card p-4">
          <Toggle
            label="مشاركة الترحيل"
            desc="شارك المشوار وقلّل التكلفة"
            value={shared}
            onChange={setShared}
            bare
          />
          {shared && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-ink-soft">عدد الأشخاص</span>
              <div className="flex items-center gap-3">
                <StepBtn onClick={() => setPeople((p) => Math.max(1, p - 1))}>−</StepBtn>
                <span className="w-6 text-center font-bold">{people}</span>
                <StepBtn onClick={() => setPeople((p) => Math.min(6, p + 1))}>+</StepBtn>
              </div>
            </div>
          )}
        </div>

        <button className="btn-primary w-full">تأكيد الترحيل</button>
      </main>

      <BottomNav />
    </div>
  )
}

function Toggle({
  label,
  desc,
  value,
  onChange,
  bare,
}: {
  label: string
  desc?: string
  value: boolean
  onChange: (v: boolean) => void
  bare?: boolean
}) {
  return (
    <div className={bare ? 'flex items-center justify-between' : 'card flex items-center justify-between p-4'}>
      <div>
        <p className="font-medium">{label}</p>
        {desc && <p className="text-xs text-ink-muted">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        className={`relative h-7 w-12 rounded-full transition ${value ? 'bg-green' : 'bg-hairline'}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
            value ? 'right-1' : 'right-6'
          }`}
        />
      </button>
    </div>
  )
}

function StepBtn({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-full bg-green-soft text-lg font-bold text-green"
    >
      {children}
    </button>
  )
}
