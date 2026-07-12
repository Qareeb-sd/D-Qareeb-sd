import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Fingerprint } from 'lucide-react'
import Logo from '@/components/Logo'
import { useAuth } from '@/store/AuthContext'
import { biometricAvailable, biometricEnabled, biometricLogin, enableBiometric } from '@/lib/biometric'

/** دخول العميل برقم الهاتف + كلمة السر، مع خيار الدخول بالبصمة/الوجه. */
export default function Auth() {
  const navigate = useNavigate()
  const { signInWithPhone } = useAuth()

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [bioReady, setBioReady] = useState(false) // بصمة مفعّلة وبيانات محفوظة

  // هل نعرض زر الدخول بالبصمة؟ (مفعّل سابقاً على هذا الجهاز)
  useEffect(() => {
    void biometricEnabled().then(setBioReady)
  }, [])

  const finishLogin = async (ph: string, pw: string, offerBiometric: boolean) => {
    const { error } = await signInWithPhone(ph, pw, undefined, { createIfMissing: false })
    if (error) {
      setBusy(false)
      setError(error)
      return
    }
    // بعد أول دخول ناجح: اعرض تفعيل البصمة إن كانت متاحة ولم تُفعّل.
    if (offerBiometric && !(await biometricEnabled()) && (await biometricAvailable())) {
      if (window.confirm('تفعيل الدخول بالبصمة/الوجه في المرات القادمة؟')) {
        await enableBiometric(ph, pw)
      }
    }
    setBusy(false)
    navigate('/home')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    await finishLogin(phone, password, true)
  }

  const loginByBiometric = async () => {
    setError('')
    const creds = await biometricLogin()
    if (!creds) return // ألغى المستخدم
    setBusy(true)
    await finishLogin(creds.phone, creds.password, false)
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

      {/* الدخول بالبصمة/الوجه — يظهر بعد تفعيله على هذا الجهاز */}
      {bioReady && (
        <button
          onClick={loginByBiometric}
          disabled={busy}
          className="btn-outline mt-3 flex w-full items-center justify-center gap-2 text-green"
        >
          <Fingerprint className="h-5 w-5" strokeWidth={1.8} />
          الدخول بالبصمة
        </button>
      )}

      {/* إنشاء حساب جديد */}
      <div className="mt-6 text-center">
        <p className="text-sm text-ink-soft">ليس لديك حساب؟</p>
        <button onClick={() => navigate('/register')} className="btn-outline mt-2 w-full">
          إنشاء حساب جديد
        </button>
      </div>

      {/* السائقون لهم تطبيق منفصل «قريب كابتن» */}
      <p className="mt-6 text-center text-xs text-ink-soft">
        سائق؟ حمّل تطبيق <span className="font-bold text-green-dark">«قريب كابتن»</span> من المتجر.
      </p>
    </div>
  )
}
