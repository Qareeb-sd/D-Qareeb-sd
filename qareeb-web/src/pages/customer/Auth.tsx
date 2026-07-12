import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { Fingerprint } from 'lucide-react'
import Logo from '@/components/Logo'
import { useAuth } from '@/store/AuthContext'
import { biometricEnabled, biometricLogin, enableBiometric } from '@/lib/biometric'

// عرض خيار البصمة على الجهاز فقط — دون استدعاء المكوّن الأصلي في مسار الدخول.
const canBio = Capacitor.isNativePlatform()

/** دخول العميل برقم الهاتف + كلمة السر، مع خيار الدخول بالبصمة/الوجه. */
export default function Auth() {
  const navigate = useNavigate()
  const { signInWithPhone } = useAuth()

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [remember, setRemember] = useState(false) // تفعيل البصمة عند الدخول
  const [bioReady, setBioReady] = useState(false) // بصمة مفعّلة سابقاً على هذا الجهاز

  useEffect(() => {
    // آمن: لا يستدعي المكوّن الأصلي إلا إن سبق تفعيل البصمة (علامة محلية).
    void biometricEnabled()
      .then(setBioReady)
      .catch(() => setBioReady(false))
  }, [])

  // تفعيل البصمة بنتيجة واضحة، مع حدّ زمني حتى لا يعلق الدخول أبداً.
  const tryEnable = async (ph: string, pw: string) => {
    const timeout = new Promise<{ ok: boolean; reason?: string }>((r) =>
      setTimeout(() => r({ ok: false, reason: 'انتهت المهلة' }), 8000),
    )
    try {
      const res = await Promise.race([enableBiometric(ph, pw), timeout])
      if (res.ok) {
        setBioReady(true)
        alert('تم تفعيل الدخول بالبصمة ✓')
      } else {
        alert('تعذّر تفعيل البصمة: ' + (res.reason ?? 'خطأ غير معروف'))
      }
    } catch (e) {
      alert('تعذّر تفعيل البصمة: ' + ((e as Error)?.message ?? 'خطأ'))
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signInWithPhone(phone, password, undefined, { createIfMissing: false })
    if (error) {
      setBusy(false)
      return setError(error)
    }
    // تفعيل البصمة (إن طُلب) بنتيجة واضحة، ثم التوجيه.
    if (remember) await tryEnable(phone, password)
    setBusy(false)
    navigate('/home')
  }

  const loginByBiometric = async () => {
    setError('')
    const creds = await biometricLogin()
    if (!creds) return // ألغى المستخدم أو تعذّر
    setBusy(true)
    const { error } = await signInWithPhone(creds.phone, creds.password, undefined, {
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

        {/* تفعيل البصمة (يظهر فقط إن كان الجهاز يدعمها ولم تُفعّل بعد) */}
        {canBio && !bioReady && (
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 accent-green"
            />
            <Fingerprint className="h-4 w-4 text-green" strokeWidth={1.8} />
            تفعيل الدخول بالبصمة/الوجه لاحقاً
          </label>
        )}

        <button className="btn-primary w-full" type="submit" disabled={busy}>
          {busy ? '…' : 'دخول'}
        </button>
      </form>

      {/* الدخول بالبصمة — يظهر بعد تفعيله على هذا الجهاز */}
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
