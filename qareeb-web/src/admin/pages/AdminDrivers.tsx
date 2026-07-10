import { useState } from 'react'
import AdminSidebar from '@/admin/components/AdminSidebar'
import AdminHeader from '@/admin/components/AdminHeader'
import StatusBadge from '@/admin/components/StatusBadge'
import DataTable from '@/admin/components/DataTable'
import { num } from '@/lib/format'

const drivers = [
  { id: 'D-001', name: 'عثمان الطيب', phone: '+249912345678', vehicle: 'قريب عادي', plate: 'خ ط م ٤٥٦٧', rating: 4.9, trips: 1240, status: 'online', earnings: 850000, joinDate: '٢٠٢٥/٠٣/١٥' },
  { id: 'D-002', name: 'سمية أحمد', phone: '+249912345679', vehicle: 'قريب نسائي', plate: 'ب و ر ٢٣٤١', rating: 4.8, trips: 890, status: 'online', earnings: 620000, joinDate: '٢٠٢٥/٠٥/٢٠' },
  { id: 'D-003', name: 'محمد عبدالله', phone: '+249912345680', vehicle: 'أمجاد', plate: 'ش م ص ٧٨٩٠', rating: 4.7, trips: 2100, status: 'online', earnings: 1100000, joinDate: '٢٠٢٤/١١/٠١' },
  { id: 'D-004', name: 'آمنة مصطفى', phone: '+249912345681', vehicle: 'قريب عادي', plate: 'و ك ل ١٢٣٤', rating: 4.9, trips: 670, status: 'offline', earnings: 340000, joinDate: '٢٠٢٦/٠١/١٠' },
  { id: 'D-005', name: 'عمر أحمد', phone: '+249912345682', vehicle: 'هايس', plate: 'ع ف د ٥٦٧٨', rating: 4.5, trips: 3200, status: 'offline', earnings: 1450000, joinDate: '٢٠٢٤/٠٨/١٥' },
]

export default function AdminDrivers() {
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = drivers.filter((d) =>
    statusFilter === 'all' ? true : d.status === statusFilter
  )

  return (
    <div className="flex min-h-screen bg-bg" dir="rtl">
      <AdminSidebar />
      <div className="mr-64 flex flex-1 flex-col">
        <AdminHeader title="السائقين" subtitle={`${num(drivers.length)} سائق مسجّل`} />
        <main className="flex-1 px-8 py-6">
          <div className="mb-4 flex items-center gap-3">
            {[
              { key: 'all', label: 'الكل' },
              { key: 'online', label: 'متصلون' },
              { key: 'offline', label: 'غير متصلين' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  statusFilter === f.key ? 'bg-green text-white' : 'bg-white border border-hairline text-ink-soft'
                }`}
              >
                {f.label}
              </button>
            ))}
            <div className="flex-1" />
            <button className="btn-primary">➕ إضافة سائق</button>
          </div>

          <DataTable
            columns={[
              { key: 'id', header: 'الكود', width: '70px', render: (d) => <span className="font-mono text-xs">{d.id}</span> },
              { key: 'name', header: 'الاسم' },
              { key: 'phone', header: 'الهاتف', width: '130px' },
              { key: 'vehicle', header: 'المركبة' },
              { key: 'plate', header: 'اللوحة' },
              { key: 'rating', header: 'التقييم', render: (d) => <span className="text-gold font-bold">⭐ {d.rating}</span> },
              { key: 'trips', header: 'الرحلات', render: (d) => num(d.trips) },
              { key: 'status', header: 'الحالة', render: (d) => <StatusBadge status={d.status} /> },
              {
                key: 'actions',
                header: '',
                render: () => (
                  <div className="flex items-center gap-2">
                    <button className="text-xs text-info underline">تفاصيل</button>
                    <button className="text-xs text-ink-muted hover:text-danger">تعليق</button>
                  </div>
                ),
              },
            ]}
            data={filtered}
            keyExtractor={(d) => d.id}
          />
        </main>
      </div>
    </div>
  )
}
