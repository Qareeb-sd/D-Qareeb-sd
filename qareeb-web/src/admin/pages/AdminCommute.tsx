import AdminSidebar from '@/admin/components/AdminSidebar'
import AdminHeader from '@/admin/components/AdminHeader'
import StatusBadge from '@/admin/components/StatusBadge'
import DataTable from '@/admin/components/DataTable'

const commutes = [
  { id: 'C-001', organizer: 'أحمد محمد', destination: 'الخرطوم - شرق النيل', time: '٠٧:٣٠ ص', days: 'سبت-أربعاء', members: 5, vehicle: 'قريب عادي', status: 'active' },
  { id: 'C-002', organizer: 'فاطمة علي', destination: 'الخرطوم 2 - البرلمان', time: '٠٨:٠٠ ص', days: 'سبت-خميس', members: 3, vehicle: 'قريب نسائي', status: 'forming' },
  { id: 'C-003', organizer: 'خالد عمر', destination: 'بحري - الصناعية', time: '٠٧:٠٠ ص', days: 'أحد-خميس', members: 8, vehicle: 'هايس', status: 'dispatched' },
  { id: 'C-004', organizer: 'مريم حسن', destination: 'أم درمان - الوادي', time: '٠٨:٣٠ ص', days: 'سبت-أربعاء', members: 2, vehicle: 'أمجاد', status: 'forming' },
]

export default function AdminCommute() {
  return (
    <div className="flex min-h-screen bg-bg" dir="rtl">
      <AdminSidebar />
      <div className="mr-64 flex flex-1 flex-col">
        <AdminHeader title="ترحيل يومي" subtitle="إدارة طلبات الترحيل المشترك" />
        <main className="flex-1 px-8 py-6">
          <div className="mb-6 grid grid-cols-4 gap-4">
            {[
              { label: 'طلبات نشطة', value: '12' },
              { label: 'في مرحلة التكوين', value: '5' },
              { label: 'مرسلة للسائقين', value: '3' },
              { label: 'ركّاب هذا الشهر', value: '156' },
            ].map((s) => (
              <div key={s.label} className="card p-5 text-center">
                <p className="text-xs text-ink-muted">{s.label}</p>
                <p className="mt-1 text-2xl font-extrabold text-green">{s.value}</p>
              </div>
            ))}
          </div>

          <DataTable
            columns={[
              { key: 'id', header: 'الطلب', width: '70px', render: (c) => <span className="font-mono text-xs">{c.id}</span> },
              { key: 'organizer', header: 'المنظّم' },
              { key: 'destination', header: 'الوجهة' },
              { key: 'time', header: 'الوقت' },
              { key: 'days', header: 'الأيام' },
              { key: 'members', header: 'الركّاب', render: (c) => <span className="font-bold">{c.members}</span> },
              { key: 'vehicle', header: 'المركبة' },
              { key: 'status', header: 'الحالة', render: (c) => <StatusBadge status={c.status} /> },
            ]}
            data={commutes}
            keyExtractor={(c) => c.id}
          />
        </main>
      </div>
    </div>
  )
}
