import { useEffect, useState } from 'react'
import AdminSidebar from '@/admin/components/AdminSidebar'
import AdminHeader from '@/admin/components/AdminHeader'
import StatCard from '@/admin/components/StatCard'
import StatusBadge from '@/admin/components/StatusBadge'
import DataTable from '@/admin/components/DataTable'
import ChartCard from '@/admin/components/ChartCard'
import { money, num } from '@/lib/format'

/* ---------- بيانات تجريبية ---------- */
const kpi = {
  ridesToday: 128,
  ridesChange: '+12%',
  onlineDrivers: 34,
  driversChange: '+5',
  pendingTopups: 7,
  topupsChange: '3 جديد',
  totalRevenue: 284500,
  revenueChange: '+8%',
  activeCommutes: 12,
  avgRating: 4.7,
  newCustomers: 23,
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

const recentRides = [
  { id: 'r-001', customer: 'أحمد محمد', driver: 'عثمان الطيب', service: 'قريب عادي', pickup: 'الخرطوم 2', dropoff: 'أم درمان', fare: 1250, status: 'completed', time: '١٠:٣٠ ص' },
  { id: 'r-002', customer: 'فاطمة علي', driver: 'سمية أحمد', service: 'قريب نسائي', pickup: 'بحري', dropoff: 'الرياض', fare: 2100, status: 'in_progress', time: '١٠:١٥ ص' },
  { id: 'r-003', customer: 'خالد عمر', driver: '—', service: 'هايس', pickup: 'المطار', dropoff: 'وسط البلد', fare: 4500, status: 'pending', time: '٩:٤٥ ص' },
  { id: 'r-004', customer: 'مريم حسن', driver: 'محمد عبدالله', service: 'أمجاد', pickup: 'جبرة', dropoff: 'الصحافة', fare: 1800, status: 'completed', time: '٩:٠٠ ص' },
  { id: 'r-005', customer: 'عبدالرحمن', driver: '—', service: 'ركشة', pickup: 'سوق أم درمان', dropoff: 'حي النصر', fare: 450, status: 'cancelled', time: '٨:٣٠ ص' },
]

const pendingTopups = [
  { id: 't-001', user: 'أحمد محمد', phone: '+249912000001', amount: 20000, date: '٢٠٢٦/٠٧/١٠', status: 'pending' },
  { id: 't-002', user: 'سارة خالد', phone: '+249912000002', amount: 5000, date: '٢٠٢٦/٠٧/١٠', status: 'pending' },
  { id: 't-003', user: 'محمد عثمان', phone: '+249912000003', amount: 15000, date: '٢٠٢٦/٠٧/٠٩', status: 'pending' },
]

const onlineDrivers = [
  { id: 'd-001', name: 'عثمان الطيب', vehicle: 'قريب عادي', plate: 'خ ط م ٤٥٦٧', rating: 4.9, trips: 1240, location: 'الخرطوم 2' },
  { id: 'd-002', name: 'سمية أحمد', vehicle: 'قريب نسائي', plate: 'ب و ر ٢٣٤١', rating: 4.8, trips: 890, location: 'بحري' },
  { id: 'd-003', name: 'محمد عبدالله', vehicle: 'أمجاد', plate: 'ش م ص ٧٨٩٠', rating: 4.7, trips: 2100, location: 'جبرة' },
  { id: 'd-004', name: 'آمنة مصطفى', vehicle: 'قريب عادي', plate: 'و ك ل ١٢٣٤', rating: 4.9, trips: 670, location: 'الرياض' },
]

/* ---------- رسم بياني SVG بسيط ---------- */
function BarChart({ data, labelKey, valueKey, color = '#1B6B3F', format }: {
  data: Record<string, unknown>[]
  labelKey: string
  valueKey: string
  color?: string
  format?: (v: number) => string
}) {
  const values = data.map((d) => d[valueKey] as number)
  const max = Math.max(...values, 1)
  const barWidth = 100 / data.length

  return (
    <svg viewBox="0 0 400 180" className="w-full">
      {/* Grid lines */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1="0" y1={35 + i * 30}
          x2="400" y2={35 + i * 30}
          stroke="#E5E7E2"
          strokeWidth="1"
        />
      ))}
      {/* Bars */}
      {data.map((d, i) => {
        const h = ((d[valueKey] as number) / max) * 130
        const x = i * barWidth + barWidth * 0.2
        const w = barWidth * 0.6
        return (
          <g key={i}>
            <rect
              x={(x / 100) * 400}
              y={165 - h}
              width={(w / 100) * 400}
              height={h}
              rx="4"
              fill={color}
              opacity="0.85"
            />
            <text
              x={(x / 100) * 400 + (w / 200) * 400}
              y={155 - h}
              textAnchor="middle"
              fontSize="10"
              fill="#1A1F1B"
              fontWeight="bold"
            >
              {format ? format(d[valueKey] as number) : d[valueKey] as number}
            </text>
            <text
              x={(x / 100) * 400 + (w / 200) * 400}
              y="178"
              textAnchor="middle"
              fontSize="11"
              fill="#8B9189"
            >
              {d[labelKey] as string}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ---------- Line Chart ---------- */
function LineChart({ data }: { data: Record<string, unknown>[] }) {
  const values = data.map((d) => d.amount as number)
  const max = Math.max(...values, 1)
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 360 + 20
    const y = 150 - ((d.amount as number) / max) * 110
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox="0 0 400 180" className="w-full">
      {/* Grid */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1="0" y1={35 + i * 30} x2="400" y2={35 + i * 30} stroke="#E5E7E2" strokeWidth="1" />
      ))}
      {/* Area */}
      <polygon
        points={`20,150 ${points} 380,150`}
        fill="#1B6B3F"
        opacity="0.08"
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke="#1B6B3F"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dots */}
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * 360 + 20
        const y = 150 - ((d.amount as number) / max) * 110
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="5" fill="#1B6B3F" />
            <circle cx={x} cy={y} r="3" fill="white" />
            <text x={x} y={y - 12} textAnchor="middle" fontSize="9" fill="#1A1F1B" fontWeight="bold">
              {money(d.amount as number)}
            </text>
            <text x={x} y="175" textAnchor="middle" fontSize="11" fill="#8B9189">
              {d.day as string}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ========== الصفحة الرئيسية ========== */
export default function AdminDashboard() {
  const [dateFilter, setDateFilter] = useState('today')

  return (
    <div className="flex min-h-screen bg-bg" dir="rtl">
      <AdminSidebar />

      <div className="mr-64 flex flex-1 flex-col">
        <AdminHeader
          title="لوحة التحكم"
          subtitle="نظرة عامة على أداء المنصة"
        />

        <main className="flex-1 px-8 py-6">
          {/* فلترة سريعة */}
          <div className="mb-6 flex items-center gap-2">
            {[
              { key: 'today', label: 'اليوم' },
              { key: 'week', label: 'هذا الأسبوع' },
              { key: 'month', label: 'هذا الشهر' },
              { key: 'year', label: 'هذه السنة' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setDateFilter(f.key)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  dateFilter === f.key
                    ? 'bg-green text-white'
                    : 'bg-white text-ink-soft border border-hairline hover:border-green'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* KPI Cards */}
          <div className="mb-6 grid grid-cols-4 gap-4">
            <StatCard
              label="رحلات اليوم"
              value={num(kpi.ridesToday)}
              change={kpi.ridesChange}
              changeType="up"
              icon="🚗"
              iconBg="#E8F1EC"
              accent="#1B6B3F"
            />
            <StatCard
              label="سائقون متصلون"
              value={num(kpi.onlineDrivers)}
              change={kpi.driversChange}
              changeType="up"
              icon="👨🏾‍✈️"
              iconBg="#E3EEF7"
              accent="#3A6FB0"
            />
            <StatCard
              label="تعبئات معلّقة"
              value={num(kpi.pendingTopups)}
              change={kpi.topupsChange}
              changeType="neutral"
              icon="⏳"
              iconBg="#FBF4DD"
              accent="#A88528"
            />
            <StatCard
              label="إيرادات اليوم"
              value={money(kpi.totalRevenue)}
              change={kpi.revenueChange}
              changeType="up"
              icon="💰"
              iconBg="#E8F1EC"
              accent="#1B6B3F"
            />
          </div>

          {/* KPI ثانوي */}
          <div className="mb-6 grid grid-cols-4 gap-4">
            <StatCard
              label="ترحيل نشط"
              value={num(kpi.activeCommutes)}
              icon="🚌"
              iconBg="#F3F8F4"
            />
            <StatCard
              label="متوسط التقييم"
              value={kpi.avgRating.toFixed(1)}
              change="من 5"
              changeType="neutral"
              icon="⭐"
              iconBg="#FBF4DD"
              accent="#C9A138"
            />
            <StatCard
              label="عملاء جدد"
              value={num(kpi.newCustomers)}
              change="هذا الشهر"
              changeType="neutral"
              icon="👤"
              iconBg="#E3EEF7"
            />
            <StatCard
              label="تنبيهات SOS"
              value={num(kpi.sosAlerts)}
              change={kpi.sosAlerts > 0 ? 'تحتاج اهتمام' : 'لا يوجد'}
              changeType={kpi.sosAlerts > 0 ? 'down' : 'neutral'}
              icon="🚨"
              iconBg={kpi.sosAlerts > 0 ? '#FDECEB' : '#F0F0EE'}
              accent={kpi.sosAlerts > 0 ? '#C5453B' : undefined}
            />
          </div>

          {/* Charts Row */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            <ChartCard title="الرحلات هذا الأسبوع" subtitle="عدد الرحلات اليومية">
              <BarChart data={weeklyRides} labelKey="day" valueKey="count" />
            </ChartCard>
            <ChartCard title="الإيرادات هذا الأسبوع" subtitle="بالجنيه السوداني">
              <LineChart data={weeklyRevenue} />
            </ChartCard>
          </div>

          {/* Tables Row */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            {/* آخر الرحلات */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold">آخر الرحلات</h3>
                <button className="text-xs font-bold text-green hover:underline">
                  عرض الكل ←
                </button>
              </div>
              <DataTable
                columns={[
                  { key: 'id', header: 'الرحلة', width: '80px' },
                  { key: 'customer', header: 'العميل' },
                  { key: 'service', header: 'الخدمة' },
                  { key: 'fare', header: 'الأجرة', render: (r) => <span className="font-bold">{money(r.fare)}</span> },
                  { key: 'status', header: 'الحالة', render: (r) => <StatusBadge status={r.status} /> },
                ]}
                data={recentRides}
                keyExtractor={(r) => r.id}
              />
            </div>

            {/* السائقون المتصلون */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold">السائقون المتصلون حالياً</h3>
                <button className="text-xs font-bold text-green hover:underline">
                  عرض الكل ←
                </button>
              </div>
              <DataTable
                columns={[
                  { key: 'name', header: 'السائق' },
                  { key: 'vehicle', header: 'المركبة' },
                  { key: 'rating', header: 'التقييم', render: (r) => <span className="text-gold">⭐ {r.rating}</span> },
                  { key: 'trips', header: 'الرحلات', render: (r) => num(r.trips) },
                  { key: 'status', header: '', render: () => <StatusBadge status="online" /> },
                ]}
                data={onlineDrivers}
                keyExtractor={(d) => d.id}
              />
            </div>
          </div>

          {/* تعبئات معلّقة */}
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">تعبئات رصيد معلّقة</h3>
              <button className="text-xs font-bold text-green hover:underline">
                عرض الكل ←
              </button>
            </div>
            <DataTable
              columns={[
                { key: 'id', header: 'الطلب', width: '80px' },
                { key: 'user', header: 'المستخدم' },
                { key: 'phone', header: 'الهاتف' },
                { key: 'amount', header: 'المبلغ', render: (r) => <span className="font-extrabold text-green">{money(r.amount)}</span> },
                { key: 'date', header: 'التاريخ' },
                { key: 'status', header: 'الحالة', render: () => <StatusBadge status="pending" /> },
                {
                  key: 'actions',
                  header: '',
                  render: () => (
                    <div className="flex items-center gap-2">
                      <button className="rounded-lg bg-green px-3 py-1.5 text-xs font-bold text-white transition hover:bg-green-dark">
                        اعتماد
                      </button>
                      <button className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger transition hover:bg-danger/20">
                        رفض
                      </button>
                    </div>
                  ),
                },
              ]}
              data={pendingTopups}
              keyExtractor={(t) => t.id}
            />
          </div>

          {/* Quick Actions Bar */}
          <div className="card flex items-center gap-3 p-4">
            <span className="text-sm font-bold text-ink-muted">إجراءات سريعة:</span>
            {[
              { label: 'إضافة سائق', icon: '➕', color: '#1B6B3F' },
              { label: 'تعديل تسعير', icon: '💲', color: '#C9A138' },
              { label: 'تقرير يومي', icon: '📄', color: '#3A6FB0' },
              { label: 'إرسال إشعار', icon: '🔔', color: '#8B9189' },
            ].map((action) => (
              <button
                key={action.label}
                className="flex items-center gap-2 rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm font-medium transition hover:shadow-card"
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
