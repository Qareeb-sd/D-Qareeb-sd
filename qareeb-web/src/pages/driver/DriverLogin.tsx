import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Logo from '@/components/Logo'
import { useAuth } from '@/store/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'

/**
 * دخول تطبيق السائق — مستقل تماماً عن تطبيق العميل.
 * الدخول لأول مرة يُنشئ الحساب، ثم يُوجَّه لاستكمال بيانات الانضمام كسائق.
 */
export default function DriverLogin() {
  const navigate = useNavigate()
  const { signInWithPhone, session, profile } = useAuth()

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // إن كان سائقاً مسجّلاً بالفعل، ادخل مباشرة لواجهته.
  if (session && profile?.role === 'driver') return <Navigate to="/driver" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signInWithPhone(phone, password, name || undefined)
    setBusy(false)
    if (error) return setError(error)
    navigate('/driver')
  }

  return (
    <div
      className="screen bg-royal px-6 py-10 font-plex text-white"
      style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo variant="driver" size={76} rounded={22} />
        <h1 className="mt-4 text-2xl font-extrabold text-sand">قريب · الكابتن</h1>
        <p className="text-sm text-white/70">سجّل دخولك لاستقبال الطلبات وإدارة رحلاتك</p>
      </div>

      {error && (
        <p className="mb-4 rounded-2xl bg-danger/20 px-4 py-3 text-center text-sm text-white">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-white/80">الاسم (لأول دخول)</label>
          <input
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-sand"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسمك"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-white/80">رقم الهاتف</label>
          <input
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-left text-white placeholder-white/40 outline-none focus:border-sand"
            dir="ltr"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+249 9X XXX XXXX"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-white/80">كلمة السر</label>
          <input
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-left text-white placeholder-white/40 outline-none focus:border-sand"
            dir="ltr"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            required
          />
        </div>
        <button
          className="w-full rounded-2xl bg-sand py-3 font-extrabold text-royal transition active:scale-[0.99] disabled:opacity-60"
          type="submit"
          disabled={busy}
        >
          {busy ? '…' : 'دخول'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-white/60">
        أول مرة؟ سجّل دخولك بالرقم وكلمة سر جديدة، ثم أكمل بيانات ووثائق الانضمام كسائق.
      </p>

      <p className="mt-4 text-center text-xs text-white/50">
        للركوب كراكب، حمّل تطبيق «قريب».
      </p>

      {!isSupabaseConfigured && (
        <p className="mt-2 text-center text-[10px] text-white/40">وضع معاينة</p>
      )}
    </div>
  )
}
