import Logo from '@/components/Logo'

/**
 * تطبيق السائق (هيكل مبدئي).
 * لاحقاً: استقبال الطلبات، محفظة السائق، خصم العمولة تلقائياً.
 */
export default function DriverHome() {
  return (
    <div className="screen items-center justify-center gap-4 p-8 text-center">
      <Logo variant="driver" size={88} rounded={22} />
      <h1 className="text-2xl font-extrabold text-green">قريب · السائق</h1>
      <p className="text-ink-soft">
        واجهة السائق قيد الإنشاء — استقبال الطلبات، محفظة السائق، وخصم العمولة تلقائياً.
      </p>
      <span className="chip bg-lemon/30 text-ink">قريباً</span>
    </div>
  )
}
