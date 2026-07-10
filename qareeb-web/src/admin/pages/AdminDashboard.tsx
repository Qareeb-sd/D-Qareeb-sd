import { useState } from 'react'
import AdminSidebar from '@/admin/components/AdminSidebar'
import AdminHeader from '@/admin/components/AdminHeader'
import StatCard from '@/admin/components/StatCard'
import StatusBadge from '@/admin/components/StatusBadge'
import DataTable from '@/admin/components/DataTable'
import ChartCard from '@/admin/components/ChartCard'
import { money, num } from '@/lib/format'

/* ===================== بيانات تجريبية ===================== */

const kpi = {
  activeRides: 23,
  activeRidesChange: '+5 منذ ١٠ دقائق',
  ridesToday: 128,
  ridesChange: '+12%',
  onlineDrivers: 34,
  driversChange: '+5',
  pendingTopups: 7,
  topupsChange: '3 جديد',
  totalRevenue: 284500,
  revenueChange: '+8%',
  activeCustomers: 156,
  newCustomers: 23,
  avgRating: 4.7,
  sosAlerts: 0,
}

const weeklyRides = [
  { day: 'السبت', count: 89 },
  { day: 'الأحد', count: 112 },
  { day: 'الاثنين', count: 95 },
  { day: 'الثلاثاء', count: 128 },
  { day: 'الأربعاء', count: 134 },
  { day: 'الخميس', count: 145 },
  { day: 'الجمعة', count: 78 },
]

const weeklyRevenue = [
  { day: 'السبت', amount: 185000 },
  { day: 'الأحد', amount: 220000 },
  { day: 'الاثنين', amount: 195000 },
  { day: 'الثلاثاء', amount: 284500 },
  { day: 'الأربعاء', amount: 310000 },
  { day: 'الخميس', amount: 290000 },
  { day: 'الجمعة', amount: 150000 },
]

const hourlyActivity = [
  { hour: '٦ص', rides: 12 },
  { hour: '٨ص', rides: 45 },
  { hour: '١٠ص', rides: 78 },
  { hour: '١٢ظ', rides: 65 },
  { hour: '٢م', rides: 38 },
  { hour: '٤م', rides: 42 },
  { hour: '٦م', rides: 85 },
  { hour: '٨م', rides: 110 },
  { hour: '١٠م', rides: 56 },
]

/* ===== توزيع المركبات ===== */
const vehicleBreakdown = [
  { name: 'قريب عادي', rides: 540, revenue: 702000, color: '#1B6B3F' },
  { name: 'قريب نسائي', rides: 210, revenue: 378000, color: '#E85C9E' },
  { name: 'أمجاد', rides: 180, revenue: 288000, color: '#3A6FB0' },
  { name: 'هايس', rides: 95, revenue: 285000, color: '#52584E' },
  { name: 'ركشة', rides: 320, revenue: 144000, color: '#2B2F2C' },
  { name: 'مشوار مفتوح', rides: 45, revenue: 157500, color: '#C9A138' },
  { name: 'سحاب', rides: 28, revenue: 336000, color: '#8B9189' },
]

/* ===== توزيع المدن ===== */
const cityBreakdown = [
  { name: 'الخرطوم', rides: 680, revenue: 1020000, drivers: 42, lat: 0.55, lng: 0.35, color: '#1B6B3F' },
  { name: 'أم درمان', rides: 340, revenue: 510000, drivers: 28, lat: 0.45, lng: 0.25, color: '#3A6FB0' },
  { name: 'بحري', rides: 220, revenue: 330000, drivers: 19, lat: 0.58, lng: 0.40, color: '#C9A138' },
  { name: 'بورتسودان', rides: 85, revenue: 255000, drivers: 12, lat: 0.65, lng: 0.72, color: '#E85C9E' },
  { name: 'مدني', rides: 52, revenue: 104000, drivers: 8, lat: 0.35, lng: 0.55, color: '#52584E' },
  { name: 'الفاشر', rides: 28, revenue: 84000, drivers: 5, lat: 0.20, lng: 0.15, color: '#8B9189' },
  { name: 'ود مدني', rides: 13, revenue: 32500, drivers: 3, lat: 0.30, lng: 0.50, color: '#D88A2B' },
]

/* ===== توزيع العملاء ===== */
const customerSegments = [
  { segment: 'عملاء جدد', count: 89, color: '#1B6B3F' },
  { segment: 'عملاء نشطون', count: 234, color: '#3A6FB0' },
  { segment: 'عملاء متكررون', count: 156, color: '#C9A138' },
  { segment: 'عملاء نائمون', count: 67, color: '#8B9189' },
  { segment: 'محظورون', count: 4, color: '#C5453B' },
]

/* ===== الطلبات النشطة الآن ===== */
const activeOrders = [
  { id: 'R-2001', customer: 'أحمد محمد', driver: 'عثمان الطيب', service: 'قريب عادي', pickup: 'الخرطوم 2', dropoff: 'أم درمان', fare: 1250, status: 'in_progress', time: '١٠:٣٠ ص', progress: 65 },
  { id: 'R-2002', customer: 'فاطمة علي', driver: 'سمية أحمد', service: 'قريب نسائي', pickup: 'بحري', dropoff: 'الرياض', fare: 2100, status: 'in_progress', time: '١٠:١٥ ص', progress: 40 },
  { id: 'R-2003', customer: 'خالد عمر', driver: '—', service: 'هايس', pickup: 'المطار', dropoff: 'وسط البلد', fare: 4500, status: 'pending', time: '٩:٤٥ ص', progress: 0 },
  { id: 'R-2004', customer: 'ليلى محمود', driver: 'محمد عبدالله', service: 'أمجاد', pickup: 'جبرة', dropoff: 'الصحافة', fare: 1800, status: 'accepted', time: '٩:٣٠ ص', progress: 15 },
  { id: 'R-2005', customer: 'يوسف إبراهيم', driver: 'آمنة مصطفى', service: 'مشوار مفتوح', pickup: 'الفاشر', dropoff: '—', fare: 3500, status: 'in_progress', time: '٩:٠٠ ص', progress: 80 },
  { id: 'R-2006', customer: 'مريم حسن', driver: '—', service: 'سحاب', pickup: 'الخرطوم', dropoff: 'بورتسودان', fare: 12000, status: 'pending', time: '٨:٤٥ ص', progress: 0 },
  { id: 'R-2007', customer: 'عبدالرحمن', driver: 'عمر أحمد', service: 'ركشة', pickup: 'سوق أم درمان', dropoff: 'حي النصر', fare: 450, status: 'in_progress', time: '٨:٣٠ ص', progress: 90 },
]

/* ===== السائقون المتصلون حالياً ===== */
const onlineDriversList = [
  { id: 'D-001', name: 'عثمان الطيب', vehicle: 'قريب عادي', plate: 'خ ط م ٤٥٦٧', rating: 4.9, trips: 1240, location: 'الخرطوم 2', status: 'online' },
  { id: 'D-002', name: 'سمية أحمد', vehicle: 'قريب نسائي', plate: 'ب و ر ٢٣٤١', rating: 4.8, trips: 890, location: 'بحري', status: 'online' },
  { id: 'D-003', name: 'محمد عبدالله', vehicle: 'أمجاد', plate: 'ش م ص ٧٨٩٠', rating: 4.7, trips: 2100, location: 'جبرة', status: 'online' },
  { id: 'D-004', name: 'آمنة مصطفى', vehicle: 'قريب عادي', plate: 'و ك ل ١٢٣٤', rating: 4.9, trips: 670, location: 'الرياض', status: 'online' },
]

const pendingTopups = [
  { id: 'T-001', user: 'أحمد محمد', phone: '+249912000001', amount: 20000, date: '٢٠٢٦/٠٧/١٠', status: 'pending' },
  { id: 'T-002', user: 'سارة خالد', phone: '+249912000002', amount: 5000, date: '٢٠٢٦/٠٧/١٠', status: 'pending' },
  { id: 'T-003', user: 'محمد عثمان', phone: '+249912000003', amount: 15000, date: '٢٠٢٦/٠٧/٠٩', status: 'pending' },
]

/* ===================== رسم بياني SVG ===================== */

function BarChart({ data, labelKey, valueKey, color = '#1B6B3F', format, height = 180 }: {
  data: Record<string, unknown>[]
  labelKey: string
  valueKey: string
  color?: string
  format?: (v: number) => string
  height?: number
}) {
  const values = data.map((d) => d[valueKey] as number)
  const max = Math.max(...values, 1)
  const barWidth = 100 / data.length
  return (
    <svg viewBox={`0 0 400 ${height}`} className="w-full">
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1="0" y1={30 + i * (height - 50) / 4} x2="400" y2={30 + i * (height - 50) / 4} stroke="#E5E7E2" strokeWidth="1" />
      ))}
      {data.map((d, i) => {
        const h = ((d[valueKey] as number) / max) * (height - 55)
        const x = i * barWidth + barWidth * 0.15
        const w = barWidth * 0.7
        return (
          <g key={i}>
            <rect x={(x / 100) * 400} y={height - 25 - h} width={(w / 100) * 400} height={h} rx="4" fill={color} opacity="0.85" />
            <text x={(x / 100) * 400 + (w / 200) * 400} y={height - 30 - h} textAnchor="middle" fontSize="9" fill="#1A1F1B" fontWeight="bold">
              {format ? format(d[valueKey] as number) : d[valueKey] as number}
            </text>
            <text x={(x / 100) * 400 + (w / 200) * 400} y={height - 5} textAnchor="middle" fontSize="10" fill="#8B9189">{d[labelKey] as string}</text>
          </g>
        )
      })}
    </svg>
  )
}

function LineChart({ data, height = 180 }: { data: Record<string, unknown>[]; height?: number }) {
  const values = data.map((d) => d.amount as number)
  const max = Math.max(...values, 1)
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 360 + 20
    const y = (height - 30) - ((d.amount as number) / max) * (height - 55)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 400 ${height}`} className="w-full">
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1="0" y1={30 + i * (height - 50) / 4} x2="400" y2={30 + i * (height - 50) / 4} stroke="#E5E7E2" strokeWidth="1" />
      ))}
      <polygon points={`20,${height - 25} ${points} 380,${height - 25}`} fill="#1B6B3F" opacity="0.06" />
      <polyline points={points} fill="none" stroke="#1B6B3F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * 360 + 20
        const y = (height - 30) - ((d.amount as number) / max) * (height - 55)
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="5" fill="#1B6B3F" />
            <circle cx={x} cy={y} r="3" fill="white" />
            <text x={x} y={y - 12} textAnchor="middle" fontSize="9" fill="#1A1F1B" fontWeight="bold">{money(d.amount as number)}</text>
            <text x={x} y={height - 5} textAnchor="middle" fontSize="10" fill="#8B9189">{d.day as string}</text>
          </g>
        )
      })}
    </svg>
  )
}

function DonutChart({ segments, size = 150 }: {
  segments: { label: string; value: number; color: string }[]
  size?: number
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  let acc = 0
  const r = size / 2 - 14
  const cx = size / 2
  const cy = size / 2
  const ir = r * 0.6

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const start = (acc / total) * Math.PI * 2 - Math.PI / 2
        acc += seg.value
        const end = (acc / total) * Math.PI * 2 - Math.PI / 2
        const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start)
        const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end)
        const ix1 = cx + ir * Math.cos(start), iy1 = cy + ir * Math.sin(start)
        const ix2 = cx + ir * Math.cos(end), iy2 = cy + ir * Math.sin(end)
        const large = end - start > Math.PI ? 1 : 0
        return (
          <path
            key={i}
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${large} 0 ${ix1} ${iy1} Z`}
            fill={seg.color}
            stroke="white"
            strokeWidth="2"
          />
        )
      })}
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1A1F1B">{num(total)}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#8B9189">إجمالي</text>
    </svg>
  )
}

/* ====== خريطة السودان المبسطة ====== */
function SudanHeatmap() {
  const maxRides = Math.max(...cityBreakdown.map((c) => c.rides))
  return (
    <svg viewBox="0 0 400 260" className="w-full">
      {/* خلفية */}
      <rect width="400" height="260" rx="16" fill="#F3F8F4" />
      {/* خريطة السودان المبسطة */}
      <path
        d="M30 220 Q25 150 50 100 Q80 50 140 40 Q200 30 260 45 Q320 60 360 110 Q375 150 370 200 Q350 240 280 235 Q200 230 120 240 Q60 245 30 220Z"
        fill="#E8F1EC"
        stroke="#C9D8CE"
        strokeWidth="1.5"
      />
      {/* مدن */}
      {cityBreakdown.map((city, i) => {
        const cx = city.lng * 400
        const cy = city.lat * 260
        const r = 8 + (city.rides / maxRides) * 18
        const opacity = 0.35 + (city.rides / maxRides) * 0.45
        return (
          <g key={i}>
            {/* نبضة خارجية */}
            <circle cx={cx} cy={cy} r={r + 6} fill={city.color} opacity="0.15">
              <animate attributeName="r" values={`${r + 6};${r + 12};${r + 6}`} dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.15;0.05;0.15" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
            </circle>
            {/* الدائرة */}
            <circle cx={cx} cy={cy} r={r} fill={city.color} opacity={opacity} stroke="white" strokeWidth="2" />
            {/* العدد */}
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={r > 14 ? 11 : 9} fontWeight="bold" fill="white">{city.rides}</text>
            {/* الاسم */}
            <text x={cx} y={cy + r + 14} textAnchor="middle" fontSize="9" fill="#1A1F1B" fontWeight="bold">{city.name}</text>
          </g>
        )
      })}
      {/* طرق */}
      <line x1={0.35 * 400} y1={0.55 * 260} x2={0.72 * 400} y2={0.65 * 260} stroke="#C9A138" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
      <line x1={0.25 * 400} y1={0.45 * 260} x2={0.35 * 400} y2={0.55 * 260} stroke="#C9A138" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
      <line x1={0.40 * 400} y1={0.35 * 260} x2={0.55 * 400} y2={0.35 * 260} stroke="#C9A138" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />
    </svg>
  )
}

/* ===== شريط تقدم الرحلة ===== */
function RideProgressBar({ progress, status }: { progress: number; status: string }) {
  const color = status === 'in_progress' ? '#1B6B3F' : status === 'accepted' ? '#C9A138' : '#8B9189'
  return (
    <div className="w-full">
      <div className="h-1.5 w-full rounded-full bg-bg overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: color }} />
      </div>
      <p className="mt-0.5 text-[10px] text-ink-muted text-left">{progress}%</p>
    </div>
  )
}

/* ===================== الصفحة ===================== */

export default function AdminDashboard() {
  const [dateFilter, setDateFilter] = useState('today')
  const [activeTab, setActiveTab] = useState<'overview' | 'vehicles' | 'cities' | 'customers'>('overview')

  return (
    <div className="flex min-h-screen bg-bg" dir="rtl">
      <AdminSidebar />

      <div className="mr-64 flex flex-1 flex-col">
        <AdminHeader title="لوحة التحكم" subtitle="نظرة شاملة على أداء منصة قريب" />

        <main className="flex-1 px-8 py-6">
          {/* فلترة + تبويبات */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-1 bg-white rounded-xl border border-hairline p-1">
              {[
                { key: 'today', label: 'اليوم' },
                { key: 'week', label: 'هذا الأسبوع' },
                { key: 'month', label: 'هذا الشهر' },
                { key: 'year', label: 'هذه السنة' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setDateFilter(f.key)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                    dateFilter === f.key ? 'bg-green text-white' : 'text-ink-soft hover:text-green'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-white rounded-xl border border-hairline p-1">
              {[
                { key: 'overview', label: 'نظرة عامة' },
                { key: 'vehicles', label: 'المركبات' },
                { key: 'cities', label: 'المدن' },
                { key: 'customers', label: 'العملاء' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key as typeof activeTab)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                    activeTab === t.key ? 'bg-green text-white' : 'text-ink-soft hover:text-green'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ==================== KPI Cards ==================== */}
          <div className="mb-6 grid grid-cols-6 gap-3">
            <StatCard label="طلبات نشطة" value={num(kpi.activeRides)} change={kpi.activeRidesChange} changeType="up" icon="⚡" iconBg="#E8F1EC" accent="#1B6B3F" />
            <StatCard label="رحلات اليوم" value={num(kpi.ridesToday)} change={kpi.ridesChange} changeType="up" icon="🚗" iconBg="#E3EEF7" accent="#3A6FB0" />
            <StatCard label="سائقون متصلون" value={num(kpi.onlineDrivers)} change={kpi.driversChange} changeType="up" icon="👨🏾‍✈️" iconBg="#FBF4DD" accent="#A88528" />
            <StatCard label="عملاء نشطون" value={num(kpi.activeCustomers)} change={`+${kpi.newCustomers} جديد`} changeType="up" icon="👥" iconBg="#E8F1EC" accent="#1B6B3F" />
            <StatCard label="تعبئات معلّقة" value={num(kpi.pendingTopups)} change={kpi.topupsChange} changeType="neutral" icon="⏳" iconBg="#FBF4DD" accent="#A88528" />
            <StatCard label="إيرادات اليوم" value={money(kpi.totalRevenue)} change={kpi.revenueChange} changeType="up" icon="💰" iconBg="#E8F1EC" accent="#1B6B3F" />
          </div>

          {/* ==================== TAB: OVERVIEW ==================== */}
          {activeTab === 'overview' && (
            <>
              {/* Charts Row */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                <ChartCard title="الرحلات هذا الأسبوع" subtitle="عدد الرحلات اليومية">
                  <BarChart data={weeklyRides} labelKey="day" valueKey="count" />
                </ChartCard>
                <ChartCard title="الإيرادات هذا الأسبوع" subtitle="بالجنيه السوداني">
                  <LineChart data={weeklyRevenue} />
                </ChartCard>
              </div>

              {/* Active Orders + Online Drivers */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                {/* الطلبات النشطة الآن */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-green animate-pulse" />
                      الطلبات النشطة الآن ({activeOrders.length})
                    </h3>
                    <button className="text-xs font-bold text-green hover:underline">عرض الكل ←</button>
                  </div>
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {activeOrders.map((order) => (
                      <div key={order.id} className="card p-3 transition hover:shadow-lift">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-[10px] text-ink-muted">{order.id}</span>
                          <StatusBadge status={order.status} />
                          <span className="flex-1" />
                          <span className="text-xs font-bold text-green">{money(order.fare)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                          <span className="text-ink-muted">👤 {order.customer}</span>
                          <span className="text-ink-muted">🚗 {order.driver || '—'}</span>
                          <span className="text-ink-muted">📍 {order.pickup}</span>
                          <span className="text-ink-muted">🏁 {order.dropoff || 'مفتوح'}</span>
                        </div>
                        <RideProgressBar progress={order.progress} status={order.status} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* السائقون المتصلون */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-green" />
                      سائقون متصلون ({onlineDriversList.length})
                    </h3>
                    <button className="text-xs font-bold text-green hover:underline">عرض الكل ←</button>
                  </div>
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {onlineDriversList.map((d) => (
                      <div key={d.id} className="card p-3 flex items-center gap-3 transition hover:shadow-lift">
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-green-soft text-lg shrink-0">🚗</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{d.name}</p>
                          <p className="text-[11px] text-ink-muted">{d.vehicle} · {d.plate}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-gold font-bold">⭐ {d.rating}</p>
                          <p className="text-[10px] text-ink-muted">{num(d.trips)} رحلة</p>
                        </div>
                        <StatusBadge status="online" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* تعبئات معلّقة */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bold">تعبئات رصيد معلّقة</h3>
                  <button className="text-xs font-bold text-green hover:underline">عرض الكل ←</button>
                </div>
                <DataTable
                  columns={[
                    { key: 'id', header: 'الطلب', width: '70px', render: (t) => <span className="font-mono text-xs">{t.id}</span> },
                    { key: 'user', header: 'المستخدم' },
                    { key: 'phone', header: 'الهاتف' },
                    { key: 'amount', header: 'المبلغ', render: (t) => <span className="font-extrabold text-green">{money(t.amount)}</span> },
                    { key: 'date', header: 'التاريخ' },
                    { key: 'status', header: 'الحالة', render: () => <StatusBadge status="pending" /> },
                    { key: 'actions', header: '', render: () => (
                      <div className="flex items-center gap-2">
                        <button className="rounded-lg bg-green px-3 py-1.5 text-xs font-bold text-white hover:bg-green-dark">اعتماد</button>
                        <button className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger hover:bg-danger/20">رفض</button>
                      </div>
                    )},
                  ]}
                  data={pendingTopups}
                  keyExtractor={(t) => t.id}
                />
              </div>
            </>
          )}

          {/* ==================== TAB: VEHICLES ==================== */}
          {activeTab === 'vehicles' && (
            <div className="grid grid-cols-2 gap-4">
              <ChartCard title="توزيع الرحلات حسب المركبة" subtitle="الشهر الجاري">
                <div className="flex items-center gap-6">
                  <DonutChart segments={vehicleBreakdown.map((v) => ({ label: v.name, value: v.rides, color: v.color }))} />
                  <div className="flex-1 space-y-2.5">
                    {vehicleBreakdown.map((v) => (
                      <div key={v.name} className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                        <span className="flex-1 text-sm text-ink">{v.name}</span>
                        <span className="text-sm font-bold w-12 text-left">{num(v.rides)}</span>
                        <span className="text-xs text-ink-muted w-20 text-left">{money(v.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ChartCard>
              <ChartCard title="الإيرادات حسب المركبة" subtitle="مقارنة الرحلات والإيرادات">
                <BarChart data={vehicleBreakdown} labelKey="name" valueKey="revenue" color="#C9A138" format={money} height={220} />
              </ChartCard>
              <div className="col-span-2">
                <ChartCard title="نشاط الساعات" subtitle="توزيع الرحلات حسب وقت اليوم">
                  <BarChart data={hourlyActivity} labelKey="hour" valueKey="rides" color="#1B6B3F" height={160} />
                </ChartCard>
              </div>
            </div>
          )}

          {/* ==================== TAB: CITIES ==================== */}
          {activeTab === 'cities' && (
            <div className="grid grid-cols-3 gap-4">
              {/* خريطة السودان */}
              <div className="col-span-2">
                <ChartCard title="Heatmap المدن" subtitle="عدد الرحلات حسب المدينة — النقاط الأكبر = أكثر رحلات">
                  <SudanHeatmap />
                </ChartCard>
              </div>
              {/* قائمة المدن */}
              <div>
                <ChartCard title="المدن" subtitle="تفاصيل كل مدينة">
                  <div className="space-y-3">
                    {cityBreakdown.map((c) => (
                      <div key={c.name} className="flex items-center gap-3 rounded-xl bg-bg p-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full text-sm" style={{ backgroundColor: c.color + '20', color: c.color }}>
                          📍
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold">{c.name}</p>
                          <p className="text-[10px] text-ink-muted">{c.drivers} سائق · {money(c.revenue)}</p>
                        </div>
                        <span className="text-sm font-extrabold" style={{ color: c.color }}>{num(c.rides)}</span>
                      </div>
                    ))}
                  </div>
                </ChartCard>
              </div>
              {/* إيرادات المدن */}
              <div className="col-span-3">
                <ChartCard title="إيرادات المدن" subtitle="مقارنة الإيرادات الشهرية">
                  <BarChart data={cityBreakdown} labelKey="name" valueKey="revenue" color="#1B6B3F" format={money} height={180} />
                </ChartCard>
              </div>
            </div>
          )}

          {/* ==================== TAB: CUSTOMERS ==================== */}
          {activeTab === 'customers' && (
            <div className="grid grid-cols-2 gap-4">
              <ChartCard title="شرائح العملاء" subtitle="توزيع العملاء حسب النشاط">
                <div className="flex items-center gap-6">
                  <DonutChart segments={customerSegments.map((s) => ({ label: s.segment, value: s.count, color: s.color }))} />
                  <div className="flex-1 space-y-3">
                    {customerSegments.map((s) => (
                      <div key={s.segment} className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="flex-1 text-sm text-ink">{s.segment}</span>
                        <span className="text-sm font-bold">{num(s.count)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ChartCard>
              <ChartCard title="إحصائيات العملاء" subtitle="ملخص النشاط">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'إجمالي العملاء', value: num(550), sub: 'مسجّل' },
                    { label: 'عملاء نشطون', value: num(234), sub: 'هذا الشهر' },
                    { label: 'متوسط الرحلة', value: num(12), sub: 'للكل عميل' },
                    { label: 'متوسط الإنفاق', value: money(4200), sub: 'للكل عميل' },
                    { label: 'عملاء جدد', value: num(89), sub: 'هذا الشهر' },
                    { label: 'معدل الاحتفاظ', value: '72%', sub: 'شهرياً' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-bg p-4 text-center">
                      <p className="text-xs text-ink-muted">{s.label}</p>
                      <p className="mt-1 text-xl font-extrabold text-green">{s.value}</p>
                      <p className="text-[10px] text-ink-muted">{s.sub}</p>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
