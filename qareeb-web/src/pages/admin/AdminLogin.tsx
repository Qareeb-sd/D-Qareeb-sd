import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Logo from '@/components/Logo'
import { useAuth } from '@/store/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'

/** دخول لوحة الإدارة — مستقل عن تطبيقي العميل والسائق. */
export default function AdminLogin() {
  const navigate = useNavigate()
  const { signInWithPhone, session, profile } = useAuth()

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (session && profile?.role === 'admin') return <Navigate to="/admin" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signInWithPhone(phone, password)
    setBusy(false)
    if (error) return setError(error)
    navigate('/admin')
  }

  return (
    <div className="screen items-stretch bg-ink px-6 py-10 text-white">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size={72} rounded={20} />
        <h1 className="mt-4 text-2xl font-extrabold">قريب · الإدارة</h1>
        <p className="text-sm text-white/60">دخول مخصّص لفريق الإدارة فقط</p>
      </div>

      {error && (
        <p className="mb-4 rounded-2xl bg-danger/20 px-4 py-3 text-center text-sm text-white">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-white/80">رقم الهاتف</label>
          <input
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-left text-white placeholder-white/40 outline-none focus:border-green"
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
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-left text-white placeholder-white/40 outline-none focus:border-green"
            dir="ltr"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            required
          />
        </div>
        <button
          className="btn-primary w-full"
          type="submit"
          disabled={busy}
        >
          {busy ? '…' : 'دخول الإدارة'}
        </button>
      </form>

      {!isSupabaseConfigured && (
        <p className="mt-4 text-center text-[10px] text-white/40">وضع معاينة</p>
      )}
    </div>
  )
}
