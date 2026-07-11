import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '@/components/Logo'
import { useAuth } from '@/store/AuthContext'

/** دخول العميل برقم الهاتف + كلمة السر (بلا اسم). الإنشاء عبر صفحة التسجيل. */
export default function Auth() {
  const navigate = useNavigate()
  const { signInWithPhone } = useAuth()

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signInWithPhone(phone, password, undefined, {
      createIfMissing: false,
    })
    setBusy(false)
    if (error) return setError(error)
    navigate('/home')
  }

  return (
    <div
      className="screen px-6 py-10"
      style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size={72} rounded={20} />
        <h1 className="mt-4 text-2xl font-extrabold text-green">قريب</h1>
        <p className="text-sm text-ink-soft">سجّل دخولك للمتابعة</p>
      </div>

      {error && (
        <p className="mb-4 rounded-2xl bg-danger/10 px-4 py-3 text-center text-sm text-danger">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">رقم الهاتف</label>
          <input
            className="field text-left"
            dir="ltr"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+249 9X XXX XXXX"
            required
          />
        </div>
        <div>
          <label className="label">كلمة السر</label>
          <input
            className="field text-left"
            dir="ltr"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            required
          />
        </div>
        <button className="btn-primary w-full" type="submit" disabled={busy}>
          {busy ? '…' : 'دخول'}
        </button>
      </form>

      {/* إنشاء حساب جديد */}
      <div className="mt-6 text-center">
        <p className="text-sm text-ink-soft">ليس لديك حساب؟</p>
        <button
          onClick={() => navigate('/register')}
          className="btn-outline mt-2 w-full"
        >
          إنشاء حساب جديد
        </button>
      </div>

      {/* السائقون لهم تطبيق منفصل «قريب كابتن» */}
      <p className="mt-6 text-center text-xs text-ink-soft">
        🚗 سائق؟ حمّل تطبيق <span className="font-bold text-green-dark">«قريب كابتن»</span> من المتجر.
      </p>
    </div>
  )
}
