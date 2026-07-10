import { useState } from 'react'
import AdminSidebar from '@/admin/components/AdminSidebar'
import AdminHeader from '@/admin/components/AdminHeader'
import StatusBadge from '@/admin/components/StatusBadge'
import DataTable from '@/admin/components/DataTable'
import { money, num } from '@/lib/format'

const allRides = [
  { id: 'R-1001', customer: 'أحمد محمد', driver: 'عثمان الطيب', service: 'قريب عادي', pickup: 'الخرطوم 2', dropoff: 'أم درمان', fare: 1250, status: 'completed', payment: 'wallet', date: '٢٠٢٦/٠٧/١٠', time: '١٠:٣٠ ص' },
  { id: 'R-1002', customer: 'فاطمة علي', driver: 'سمية أحمد', service: 'قريب نسائي', pickup: 'بحري', dropoff: 'الرياض', fare: 2100, status: 'in_progress', payment: 'cash', date: '٢٠٢٦/٠٧/١٠', time: '١٠:١٥ ص' },
  { id: 'R-1003', customer: 'خالد عمر', driver: '—', service: 'هايس', pickup: 'المطار', dropoff: 'وسط البلد', fare: 4500, status: 'pending', payment: 'cash', date: '٢٠٢٦/٠٧/١٠', time: '٩:٤٥ ص' },
  { id: 'R-1004', customer: 'مريم حسن', driver: 'محمد عبدالله', service: 'أمجاد', pickup: 'جبرة', dropoff: 'الصحافة', fare: 1800, status: 'completed', payment: 'bank_transfer', date: '٢٠٢٦/٠٧/١٠', time: '٩:٠٠ ص' },
  { id: 'R-1005', customer: 'عبدالرحمن', driver: '—', service: 'ركشة', pickup: 'سوق أم درمان', dropoff: 'حي النصر', fare: 450, status: 'cancelled', payment: 'cash', date: '٢٠٢٦/٠٧/١٠', time: '٨:٣٠ ص' },
  { id: 'R-1006', customer: 'ليلى محمود', driver: 'عثمان الطيب', service: 'قريب عادي', pickup: 'بحري', dropoff: 'الخرطوم', fare: 1500, status: 'completed', payment: 'wallet', date: '٢٠٢٦/٠٧/٠٩', time: '٧:٠٠ م' },
  { id: 'R-1007', customer: 'يوسف إبراهيم', driver: 'آمنة مصطفى', service: 'مشوار مفتوح', pickup: 'الفاشر', dropoff: '—', fare: 3500, status: 'in_progress', payment: 'cash', date: '٢٠٢٦/٠٧/٠٩', time: '٥:٣٠ م' },
  { id: 'R-1008', customer: 'نور الدين', driver: '—', service: 'سحاب', pickup: 'الخرطوم', dropoff: 'بورتسودان', fare: 12000, status: 'pending', payment: 'bank_transfer', date: '٢٠٢٦/٠٧/٠٩', time: '٤:٠٠ م' },
]

const filters = ['الكل', 'جارية', 'مكتملة', 'معلّقة', 'ملغاة']

export default function AdminRides() {
  const [activeFilter, setActiveFilter] = useState('الكل')
  const [search, setSearch] = useState('')

  const filtered = allRides.filter((r) => {
    const matchFilter =
      activeFilter === 'الكل'
        ? true
        : activeFilter === 'جارية'
          ? r.status === 'in_progress'
          : activeFilter === 'مكتملة'
            ? r.status === 'completed'
            : activeFilter === 'معلّقة'
              ? r.status === 'pending'
              : r.status === 'cancelled'
    const matchSearch =
      search === '' ||
      r.customer.includes(search) ||
      r.id.includes(search) ||
      r.pickup.includes(search) ||
      r.dropoff.includes(search)
    return matchFilter && matchSearch
  })

  return (
    <div className="flex min-h-screen bg-bg" dir="rtl">
      <AdminSidebar />
      <div className="mr-64 flex flex-1 flex-col">
        <AdminHeader title="الرحلات" subtitle={`${num(allRides.length)} رحلة مسجّلة`} />
        <main className="flex-1 px-8 py-6">
          {/* Filters */}
          <div className="mb-4 flex items-center gap-3">
            <input
              type="text"
              placeholder="ابحث برقم الرحلة، العميل، أو الموقع..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field w-80"
            />
            <div className="flex items-center gap-1">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                    activeFilter === f ? 'bg-green text-white' : 'bg-white border border-hairline text-ink-soft'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <DataTable
            columns={[
              { key: 'id', header: 'الرحلة', width: '80px', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
              { key: 'customer', header: 'العميل' },
              { key: 'driver', header: 'السائق', render: (r) => r.driver || <span className="text-ink-muted">—</span> },
              { key: 'service', header: 'الخدمة' },
              { key: 'pickup', header: 'الإقلاع' },
              { key: 'dropoff', header: 'الوجهة', render: (r) => r.dropoff || <span className="text-ink-muted">مفتوح</span> },
              { key: 'fare', header: 'الأجرة', render: (r) => <span className="font-extrabold">{money(r.fare)}</span> },
              { key: 'status', header: 'الحالة', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'date', header: 'التاريخ', width: '100px' },
            ]}
            data={filtered}
            keyExtractor={(r) => r.id}
            emptyMessage="لا توجد رحلات مطابقة"
          />
        </main>
      </div>
    </div>
  )
}
