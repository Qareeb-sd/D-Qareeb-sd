import AdminSidebar from '@/admin/components/AdminSidebar'
import AdminHeader from '@/admin/components/AdminHeader'
import StatusBadge from '@/admin/components/StatusBadge'
import DataTable from '@/admin/components/DataTable'

const sosAlerts = [
  { id: 'S-001', user: 'سارة خالد', phone: '+249912000002', ride: 'R-1009', location: 'الخرطوم 2، شارع النيل', time: '٢٠٢٦/٠٧/١٠ ١٠:١٥ ص', status: 'active', resolvedBy: '' },
  { id: 'S-002', user: 'محمد عثمان', phone: '+249912000003', ride: 'R-1011', location: 'أم درمان، سوق ليبيا', time: '٢٠٢٦/٠٧/٠٩ ٠٩:٣٠ م', status: 'resolved', resolvedBy: 'مدير المنصة' },
]

export default function AdminSOS() {
  const activeAlerts = sosAlerts.filter((a) => a.status === 'active')

  return (
    <div className="flex min-h-screen bg-bg" dir="rtl">
      <AdminSidebar />
      <div className="mr-64 flex flex-1 flex-col">
        <AdminHeader title="طوارئ SOS" subtitle={`${activeAlerts.length} تنبيه نشط`} />
        <main className="flex-1 px-8 py-6">
          {/* Active Alert Banner */}
          {activeAlerts.length > 0 && (
            <div className="mb-6 rounded-2xl bg-danger/10 border border-danger/20 p-5">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🚨</span>
                <div className="flex-1">
                  <p className="font-bold text-danger">تنبيه طوارئ نشط!</p>
                  <p className="text-sm text-danger/80">
                    {activeAlerts[0].user} — {activeAlerts[0].location} — {activeAlerts[0].time}
                  </p>
                </div>
                <a
                  href={`tel:${activeAlerts[0].phone}`}
                  className="btn rounded-xl bg-danger text-white hover:bg-danger/90"
                >
                  📞 اتصال
                </a>
                <button className="btn rounded-xl bg-green text-white">تحويل لحلّه</button>
              </div>
            </div>
          )}

          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold">سجل التنبيهات</h3>
          </div>

          <DataTable
            columns={[
              { key: 'id', header: 'التنبيه', width: '70px', render: (a) => <span className="font-mono text-xs">{a.id}</span> },
              { key: 'user', header: 'المستخدم' },
              { key: 'phone', header: 'الهاتف' },
              { key: 'ride', header: 'الرحلة' },
              { key: 'location', header: 'الموقع' },
              { key: 'time', header: 'الوقت' },
              { key: 'status', header: 'الحالة', render: (a) => <StatusBadge status={a.status === 'active' ? 'pending' : 'approved'} /> },
              {
                key: 'actions',
                header: '',
                render: (a) =>
                  a.status === 'active' ? (
                    <div className="flex items-center gap-2">
                      <a href={`tel:${a.phone}`} className="rounded-lg bg-danger px-3 py-1.5 text-xs font-bold text-white">
                        اتصال
                      </a>
                      <button className="rounded-lg bg-green px-3 py-1.5 text-xs font-bold text-white">
                        تم الحل
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-ink-muted">{a.resolvedBy}</span>
                  ),
              },
            ]}
            data={sosAlerts}
            keyExtractor={(a) => a.id}
            emptyMessage="لا توجد تنبيهات SOS — الحمدلله 🙏"
          />
        </main>
      </div>
    </div>
  )
}
