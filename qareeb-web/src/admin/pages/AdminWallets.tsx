import { useState } from 'react'
import AdminSidebar from '@/admin/components/AdminSidebar'
import AdminHeader from '@/admin/components/AdminHeader'
import StatusBadge from '@/admin/components/StatusBadge'
import DataTable from '@/admin/components/DataTable'
import { money, num } from '@/lib/format'

const topups = [
  { id: 'T-001', user: 'أحمد محمد', phone: '+249912000001', amount: 20000, balance: 45000, date: '٢٠٢٦/٠٧/١٠ ١٠:٣٠ ص', status: 'pending' },
  { id: 'T-002', user: 'سارة خالد', phone: '+249912000002', amount: 5000, balance: 12000, date: '٢٠٢٦/٠٧/١٠ ٠٩:١٥ ص', status: 'pending' },
  { id: 'T-003', user: 'محمد عثمان', phone: '+249912000003', amount: 15000, balance: 30000, date: '٢٠٢٦/٠٧/٠٩ ٠٤:٠٠ م', status: 'pending' },
  { id: 'T-004', user: 'فاطمة علي', phone: '+249912000004', amount: 10000, balance: 55000, date: '٢٠٢٦/٠٧/٠٩ ٠٢:٣٠ م', status: 'approved' },
  { id: 'T-005', user: 'خالد عمر', phone: '+249912000005', amount: 25000, balance: 80000, date: '٢٠٢٦/٠٧/٠٨ ١١:٠٠ ص', status: 'approved' },
  { id: 'T-006', user: 'نور الدين', phone: '+249912000006', amount: 5000, balance: 2000, date: '٢٠٢٦/٠٧/٠٨ ٠٩:٠٠ ص', status: 'rejected' },
]

const walletStats = [
  { label: 'إجمالي أرصدة المحافظ', value: 2850000 },
  { label: 'تعبئات اليوم', value: 45000 },
  { label: 'معلق للاعتماد', value: 40000 },
  { label: 'إجمالي معتمد هذا الشهر', value: 320000 },
]

export default function AdminWallets() {
  const [filter, setFilter] = useState('all')

  const filtered = topups.filter((t) =>
    filter === 'all' ? true : t.status === filter
  )

  return (
    <div className="flex min-h-screen bg-bg" dir="rtl">
      <AdminSidebar />
      <div className="mr-64 flex flex-1 flex-col">
        <AdminHeader title="المحافظ والتعبئات" subtitle="إدارة رصيد المستخدمين والتعبئات" />
        <main className="flex-1 px-8 py-6">
          {/* Stats */}
          <div className="mb-6 grid grid-cols-4 gap-4">
            {walletStats.map((s) => (
              <div key={s.label} className="card p-5 text-center">
                <p className="text-xs text-ink-muted">{s.label}</p>
                <p className="mt-1 text-xl font-extrabold text-green">{money(s.value)}</p>
              </div>
            ))}
          </div>

          <div className="mb-4 flex items-center gap-2">
            {[
              { key: 'all', label: 'الكل' },
              { key: 'pending', label: 'معلّقة' },
              { key: 'approved', label: 'معتمدة' },
              { key: 'rejected', label: 'مرفوضة' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  filter === f.key ? 'bg-green text-white' : 'bg-white border border-hairline text-ink-soft'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <DataTable
            columns={[
              { key: 'id', header: 'الطلب', width: '70px', render: (t) => <span className="font-mono text-xs">{t.id}</span> },
              { key: 'user', header: 'المستخدم' },
              { key: 'phone', header: 'الهاتف' },
              { key: 'amount', header: 'المبلغ', render: (t) => <span className="font-extrabold text-green">{money(t.amount)}</span> },
              { key: 'balance', header: 'الرصيد الحالي', render: (t) => <span className="text-ink-soft">{money(t.balance)}</span> },
              { key: 'date', header: 'التاريخ' },
              { key: 'status', header: 'الحالة', render: (t) => <StatusBadge status={t.status} /> },
              {
                key: 'actions',
                header: '',
                render: (t) =>
                  t.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <button className="rounded-lg bg-green px-3 py-1.5 text-xs font-bold text-white hover:bg-green-dark">
                        اعتماد
                      </button>
                      <button className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger hover:bg-danger/20">
                        رفض
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-ink-muted">—</span>
                  ),
              },
            ]}
            data={filtered}
            keyExtractor={(t) => t.id}
          />
        </main>
      </div>
    </div>
  )
}
