import AdminSidebar from '@/admin/components/AdminSidebar'
import AdminHeader from '@/admin/components/AdminHeader'
import DataTable from '@/admin/components/DataTable'
import { money, num } from '@/lib/format'

const customers = [
  { id: 'U-001', name: 'أحمد محمد', phone: '+249912000001', rides: 45, spent: 58000, wallet: 45000, rating: 4.8, joinDate: '٢٠٢٥/٠٦/١٥' },
  { id: 'U-002', name: 'فاطمة علي', phone: '+249912000002', rides: 32, spent: 42000, wallet: 55000, rating: 4.9, joinDate: '٢٠٢٥/٠٨/٢٠' },
  { id: 'U-003', name: 'خالد عمر', phone: '+249912000003', rides: 12, spent: 18000, wallet: 30000, rating: 4.5, joinDate: '٢٠٢٦/٠١/٠٥' },
  { id: 'U-004', name: 'مريم حسن', phone: '+249912000004', rides: 67, spent: 95000, wallet: 12000, rating: 5.0, joinDate: '٢٠٢٤/١٠/١٠' },
  { id: 'U-005', name: 'عبدالرحمن', phone: '+249912000005', rides: 8, spent: 6500, wallet: 2000, rating: 4.2, joinDate: '٢٠٢٦/٠٥/٢٢' },
]

export default function AdminCustomers() {
  return (
    <div className="flex min-h-screen bg-bg" dir="rtl">
      <AdminSidebar />
      <div className="mr-64 flex flex-1 flex-col">
        <AdminHeader title="العملاء" subtitle={`${num(customers.length)} عميل مسجّل`} />
        <main className="flex-1 px-8 py-6">
          <DataTable
            columns={[
              { key: 'id', header: 'الكود', width: '70px', render: (c) => <span className="font-mono text-xs">{c.id}</span> },
              { key: 'name', header: 'الاسم' },
              { key: 'phone', header: 'الهاتف' },
              { key: 'rides', header: 'الرحلات', render: (c) => num(c.rides) },
              { key: 'spent', header: 'إجمالي الإنفاق', render: (c) => <span className="font-bold">{money(c.spent)}</span> },
              { key: 'wallet', header: 'رصيد المحفظة', render: (c) => <span className="text-green font-bold">{money(c.wallet)}</span> },
              { key: 'rating', header: 'التقييم', render: (c) => <span className="text-gold">⭐ {c.rating}</span> },
              { key: 'joinDate', header: 'تاريخ التسجيل' },
            ]}
            data={customers}
            keyExtractor={(c) => c.id}
          />
        </main>
      </div>
    </div>
  )
}
