/**
 * خريطة السودان الحديثة (بعد انفصال الجنوب) — حدود فعلية مُسقطة equirectangular
 * (شمال للأعلى)، وعليها خطوط التوصيل الذهبية المتحرّكة من الخرطوم، ودبوس نابض.
 * المصدر: بيانات حدود GeoJSON مفتوحة (johan/world.geo.json، SDN منفصلة عن SSD).
 */

const SUDAN_D = 'M736.0 792.1 L728.0 791.0 L729.0 761.1 L722.0 740.5 L692.2 716.8 L685.3 673.5 L692.2 629.2 L665.4 625.1 L661.4 638.5 L626.6 641.6 L640.5 659.1 L645.5 695.2 L613.7 728.1 L584.9 771.4 L555.1 777.6 L506.4 742.5 L484.6 754.9 L478.6 772.4 L448.8 783.7 L446.8 796.1 L389.2 796.1 L381.2 783.7 L339.5 781.7 L318.7 792.0 L302.8 786.8 L273.0 751.8 L263.0 735.3 L221.3 743.6 L205.4 771.4 L190.5 824.9 L170.6 836.3 L152.9 842.8 L148.2 840.0 L128.1 822.7 L124.4 804.1 L133.8 779.1 L133.6 754.6 L100.2 717.1 L93.7 691.5 L94.4 676.9 L73.1 659.2 L72.5 624.4 L60.3 601.2 L40.0 604.7 L45.8 582.7 L60.8 557.7 L54.3 532.8 L73.3 514.4 L61.2 500.4 L76.5 463.3 L103.0 419.2 L152.9 423.3 L150.0 185.2 L150.7 160.0 L217.3 159.8 L217.3 40.0 L449.9 40.0 L674.4 40.0 L904.0 40.0 L922.6 98.9 L909.9 109.8 L918.4 171.5 L939.6 243.2 L961.6 257.9 L993.3 280.1 L964.0 314.3 L921.4 324.2 L903.2 342.6 L897.5 382.5 L872.6 470.7 L878.7 494.7 L869.5 546.2 L846.0 605.3 L811.1 635.0 L786.2 680.9 L780.4 705.4 L753.0 722.2 L735.9 785.0 L736.0 792.1 Z'

const KHARTOUM = { x: 655, y: 430 }
const CITIES = [
  { x: 924, y: 183 }, // portsudan
  { x: 535, y: 210 }, // dongola
  { x: 877, y: 433 }, // kassala
  { x: 210, y: 637 }, // nyala
  { x: 519, y: 569 }, // elobeid
]

export default function SudanMap({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1033 883" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d={SUDAN_D} fill="#1B6B3F" fillOpacity="0.16" stroke="#1B6B3F" strokeWidth="6" strokeOpacity="0.55" strokeLinejoin="round" />

      {CITIES.map((c, i) => (
        <line key={i} x1={KHARTOUM.x} y1={KHARTOUM.y} x2={c.x} y2={c.y}
          stroke="#C9A138" strokeWidth="5" strokeLinecap="round" strokeDasharray="14 10" opacity="0.7">
          <animate attributeName="stroke-dashoffset" values="48;0" dur="1.6s" repeatCount="indefinite" />
        </line>
      ))}

      {CITIES.map((c, i) => (
        <circle key={`d${i}`} cx={c.x} cy={c.y} r="9" fill="#1B6B3F" opacity="0.6" />
      ))}

      <ellipse cx={KHARTOUM.x} cy={KHARTOUM.y} rx="28" ry="16" fill="#1B6B3F" opacity="0.15">
        <animate attributeName="rx" values="28;40;28" dur="2s" repeatCount="indefinite" />
        <animate attributeName="ry" values="16;24;16" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.15;0.04;0.15" dur="2s" repeatCount="indefinite" />
      </ellipse>
      <path d={`M${KHARTOUM.x} ${KHARTOUM.y - 44}c-14 0-25 10.7-25 24 0 17 22 37 24 39a2 2 0 0 0 2.6 0c2-2 24-22 24-39 0-13.3-11-24-25.6-24Z`} fill="#1B6B3F" />
      <circle cx={KHARTOUM.x} cy={KHARTOUM.y - 22} r="11" fill="none" stroke="#C9A138" strokeWidth="4.5" />
      <circle cx={KHARTOUM.x} cy={KHARTOUM.y - 22} r="5" fill="#C9A138" />
    </svg>
  )
}
