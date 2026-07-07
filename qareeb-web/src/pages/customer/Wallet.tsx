import { useState } from 'react'
import BottomNav from '@/components/BottomNav'
import Logo from '@/components/Logo'
import { money } from '@/lib/format'

/** محفظة قريب: الرصيد + التعبئة بتحويل بنكي ورفع إثبات + سجل المعاملات. */

interface Tx {
  id: string
  label: string
  amount: number
  date: string
}

const demoTx: Tx[] = [
  { id: '1', label: 'تعبئة رصيد', amount: 20000, date: 'اليوم' },
  { id: '2', label: 'رحلة · قريب عادي', amount: -1220, date: 'أمس' },
  { id: '3', label: 'رحلة · ترحيل', amount: -800, date: 'قبل يومين' },
]

// بيانات الحساب البنكي — تُجلب من settings في الأدمن لاحقاً.
const bank = {
  name: 'بنك الخرطوم',
  accountName: 'شركة قريب للنقل',
  accountNumber: '1234567890123',
}

export default function Wallet() {
  const [topup, setTopup] = useState(false)
  const balance = 18000

  return (
    <div className="screen">
      <header className="flex items-center gap-3 px-4 py-4">
        <Logo size={36} rounded={10} />
        <h1 className="text-lg font-bold">محفظة قريب</h1>
      </header>

      <main className="flex-1 px-4 pb-4">
        {/* بطاقة الرصيد */}
        <div className="rounded-3xl bg-gradient-to-br from-green to-green-dark p-6 text-white shadow-lift">
          <p className="text-sm text-white/80">رصيدك الحالي</p>
          <p className="mt-1 text-3xl font-extrabold">{money(balance)}</p>
          <button
            onClick={() => setTopup((v) => !v)}
            className="btn mt-4 bg-white/15 text-white hover:bg-white/25"
          >
            تعبئة الرصيد
          </button>
        </div>

        {/* نموذج التعبئة */}
        {topup && (
          <div className="card mt-4 space-y-3 p-4">
            <p className="font-bold">تعبئة بتحويل بنكي</p>
            <div className="rounded-2xl bg-gold-soft p-3 text-sm text-ink">
              <p>
                <span className="text-ink-soft">البنك:</span> {bank.name}
              </p>
              <p>
                <span className="text-ink-soft">اسم الحساب:</span> {bank.accountName}
              </p>
              <p dir="ltr" className="text-left">
                <span className="text-ink-soft">الرقم:</span> {bank.accountNumber}
              </p>
            </div>
            <div>
              <label className="label">المبلغ المحوّل</label>
              <input className="field" inputMode="numeric" placeholder="مثال: 20000" />
            </div>
            <div>
              <label className="label">إثبات التحويل</label>
              <input type="file" accept="image/*" className="field" />
            </div>
            <button className="btn-gold w-full">إرسال للمراجعة</button>
            <p className="text-center text-xs text-ink-muted">
              يعتمد الأدمن التحويل ثم يُضاف الرصيد لمحفظتك.
            </p>
          </div>
        )}

        {/* سجل المعاملات */}
        <h2 className="mb-2 mt-6 font-bold">سجل المعاملات</h2>
        <div className="card divide-y divide-hairline p-0">
          {demoTx.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">{t.label}</p>
                <p className="text-xs text-ink-muted">{t.date}</p>
              </div>
              <p
                className={`font-bold ${t.amount > 0 ? 'text-green' : 'text-danger'}`}
                dir="ltr"
              >
                {t.amount > 0 ? '+' : ''}
                {money(Math.abs(t.amount))}
              </p>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
