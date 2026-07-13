import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { Fingerprint, MessageCircle, ShieldCheck, ChevronRight } from 'lucide-react'
import Logo from '@/components/Logo'
import { useAuth } from '@/store/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'
import { sendOtp, verifyOtp } from '@/lib/otp'
import { biometricEnabled, biometricLogin, enableBiometric } from '@/lib/biometric'

// خيار البصمة على الجهاز فقط.
const canBio = Capacitor.isNativePlatform()

type Mode = 'login' | 'signup'
type Step = 'form' | 'otp' | 'bio'

/**
 * دخول/تسجيل الكابتن — تدفّق كامل:
 *   تسجيل: الاسم + رقم واتساب + كلمة السر → رمز تحقّق واتساب (OTP) → تفعيل
 *   البصمة (اختياري) → إنشاء الحساب → استكمال المستندات → اعتماد الأدمن → العمل.
 *   دخول: رقم + كلمة السر (أو بصمة).
 * هوية «الواحة الملكية»: زمردي عميق + لمسات ذهبية.
 */
export default function DriverLogin() {
  const navigate = useNavigate()
  const { signInWithPhone, session, profile } = useAuth()

  const [mode, setMode] = useState<Mode>('login')
  const [step, setStep] = useState<Step>('form')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [code, setCode] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [devCode, setDevCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [bioReady, setBioReady] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    void biometricEnabled()
      .then(setBioReady)
      .catch(() => setBioReady(false))
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // إن كان سائقاً مسجّلاً بالفعل، ادخل مباشرة لواجهته.
  if (session && profile?.role === 'driver') return <Navigate to="/driver" replace />

  const startCooldown = (sec: number) => {
    setResendIn(sec)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1 && timerRef.current) clearInterval(timerRef.current)
        return s - 1
      })
    }, 1000)
  }

  // ————— دخول حساب قائم —————
  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signInWithPhone(phone, password, undefined, { createIfMissing: false })
    setBusy(false)
    if (error) return setError(error)
    navigate('/driver')
  }

  const loginByBiometric = async () => {
    setError('')
    const creds = await biometricLogin()
    if (!creds) return
    setBusy(true)
    const { error } = await signInWithPhone(creds.phone, creds.password, undefined, {
      createIfMissing: false,
    })
    setBusy(false)
    if (error) return setError(error)
    navigate('/driver')
  }

  // ————— تسجيل: 1) البيانات ثم إرسال الرمز —————
  const startSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (name.trim().length < 2) return setError('أدخل اسمك الكامل.')
    if (phone.replace(/\D/g, '').length < 9) return setError('أدخل رقم واتساب صحيحاً.')
    if (password.length < 6) return setError('كلمة السر يجب ألا تقل عن 6 أحرف.')
    if (password !== password2) return setError('كلمتا السر غير متطابقتين.')

    setBusy(true)
    const res = await sendOtp(phone)
    setBusy(false)
    if (!res.ok) return setError(res.error ?? 'تعذّر إرسال الرمز.')
    setDevCode(res.devCode ?? '')
    setInfo(res.devCode ? `وضع تجريبي — الرمز: ${res.devCode}` : 'أرسلنا رمز التحقّق عبر واتساب.')
    setStep('otp')
    startCooldown(60)
  }

  const resend = async () => {
    if (resendIn > 0) return
    setError('')
    setBusy(true)
    const res = await sendOtp(phone)
    setBusy(false)
    if (!res.ok) return setError(res.error ?? 'تعذّر إعادة الإرسال.')
    setDevCode(res.devCode ?? '')
    setInfo(res.devCode ? `وضع تجريبي — الرمز: ${res.devCode}` : 'أعدنا إرسال الرمز عبر واتساب.')
    startCooldown(60)
  }

  // ————— تسجيل: 2) التحقّق من الرمز ثم إنشاء الحساب —————
  const confirmOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (code.replace(/\D/g, '').length !== 6) return setError('أدخل الرمز المكوّن من 6 أرقام.')

    setBusy(true)
    const v = await verifyOtp(phone, code.replace(/\D/g, ''))
    if (!v.ok) {
      setBusy(false)
      return setError(v.error ?? 'الرمز غير صحيح.')
    }
    // أنشئ الحساب (يسجّل الدخول تلقائياً).
    const { error } = await signInWithPhone(phone, password, name.trim(), { createIfMissing: true })
    setBusy(false)
    if (error) return setError(error)

    // اعرض تفعيل البصمة على الجهاز، وإلا انتقل للمستندات.
    if (canBio && !bioReady) {
      setInfo('')
      setStep('bio')
    } else {
      navigate('/driver/register')
    }
  }

  // ————— تسجيل: 3) تفعيل البصمة (اختياري) —————
  const enableBio = async () => {
    setBusy(true)
    const timeout = new Promise<{ ok: boolean; reason?: string }>((r) =>
      setTimeout(() => r({ ok: false, reason: 'انتهت المهلة' }), 8000),
    )
    const res = await Promise.race([enableBiometric(phone, password), timeout])
    setBusy(false)
    if (res.ok) navigate('/driver/register')
    else setError('تعذّر تفعيل البصمة: ' + (res.reason ?? 'خطأ') + ' — يمكنك تفعيلها لاحقاً.')
  }

  const skipBio = () => navigate('/driver/register')

  // خطوات مرئية للتسجيل.
  const stepNum = step === 'form' ? 1 : step === 'otp' ? 2 : 3
  const flowSteps = ['البيانات', 'رمز واتساب', 'البصمة']

  return (
    <div
      className="screen bg-royal px-6 py-10 font-plex text-white"
      style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo variant="driver" size={72} rounded={20} />
        <h1 className="mt-4 text-2xl font-extrabold text-sand">قريب · الكابتن</h1>
        <p className="text-sm text-white/70">
          {mode === 'login' ? 'سجّل دخولك لاستقبال الطلبات' : 'أنشئ حسابك للانضمام كسائق'}
        </p>
      </div>

      {/* مبدّل دخول / تسجيل */}
      <div className="mb-6 flex rounded-2xl bg-white/10 p-1 text-sm font-bold">
        <button
          onClick={() => {
            setMode('login')
            setStep('form')
            setError('')
            setInfo('')
          }}
          className={`flex-1 rounded-xl py-2 transition ${
            mode === 'login' ? 'bg-sand text-royal' : 'text-white/70'
          }`}
        >
          دخول
        </button>
        <button
          onClick={() => {
            setMode('signup')
            setStep('form')
            setError('')
            setInfo('')
          }}
          className={`flex-1 rounded-xl py-2 transition ${
            mode === 'signup' ? 'bg-sand text-royal' : 'text-white/70'
          }`}
        >
          حساب جديد
        </button>
      </div>

      {/* شريط خطوات التسجيل */}
      {mode === 'signup' && (
        <div className="mb-5 flex items-center">
          {flowSteps.map((label, i) => {
            const done = i + 1 <= stepNum
            return (
              <div key={label} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center">
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold ${
                      done ? 'bg-sand text-royal' : 'bg-white/15 text-white/60'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={`mt-1 text-[10px] ${done ? 'text-sand' : 'text-white/50'}`}>
                    {label}
                  </span>
                </div>
                {i < flowSteps.length - 1 && (
                  <span
                    className={`mx-1 h-[3px] flex-1 rounded-full ${
                      i + 1 < stepNum ? 'bg-sand' : 'bg-white/15'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-2xl bg-danger/25 px-4 py-3 text-center text-sm text-white">
          {error}
        </p>
      )}
      {info && !error && (
        <p className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-center text-sm text-sand-soft">
          <MessageCircle className="h-4 w-4" strokeWidth={2} />
          {info}
        </p>
      )}

      {/* ————— دخول ————— */}
      {mode === 'login' && (
        <>
          <form onSubmit={doLogin} className="space-y-4">
            <Field label="رقم الهاتف" dir="ltr" inputMode="tel" value={phone} onChange={setPhone} placeholder="+249 9X XXX XXXX" />
            <Field label="كلمة السر" dir="ltr" type="password" value={password} onChange={setPassword} placeholder="••••••" />
            <button className="w-full rounded-2xl bg-sand py-3 font-extrabold text-royal transition active:scale-[0.99] disabled:opacity-60" type="submit" disabled={busy}>
              {busy ? '…' : 'دخول'}
            </button>
          </form>
          {bioReady && (
            <button
              onClick={loginByBiometric}
              disabled={busy}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/25 py-3 font-bold text-white"
            >
              <Fingerprint className="h-5 w-5" strokeWidth={1.8} />
              الدخول بالبصمة
            </button>
          )}
        </>
      )}

      {/* ————— تسجيل: البيانات ————— */}
      {mode === 'signup' && step === 'form' && (
        <form onSubmit={startSignup} className="space-y-4">
          <Field label="الاسم الكامل" value={name} onChange={setName} placeholder="الاسم الثلاثي" />
          <div>
            <Field label="رقم واتساب" dir="ltr" inputMode="tel" value={phone} onChange={setPhone} placeholder="+249 9X XXX XXXX" />
            <p className="mt-1 text-xs text-white/50">سنرسل رمز التحقّق إلى هذا الرقم عبر واتساب.</p>
          </div>
          <Field label="كلمة السر" dir="ltr" type="password" value={password} onChange={setPassword} placeholder="6 أحرف على الأقل" />
          <Field label="تأكيد كلمة السر" dir="ltr" type="password" value={password2} onChange={setPassword2} placeholder="أعد كتابة كلمة السر" />
          <button className="w-full rounded-2xl bg-sand py-3 font-extrabold text-royal transition active:scale-[0.99] disabled:opacity-60" type="submit" disabled={busy}>
            {busy ? '…' : 'إرسال رمز واتساب'}
          </button>
        </form>
      )}

      {/* ————— تسجيل: رمز واتساب ————— */}
      {mode === 'signup' && step === 'otp' && (
        <form onSubmit={confirmOtp} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-white/80">رمز التحقّق (6 أرقام)</label>
            <input
              className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] text-white placeholder-white/30 outline-none focus:border-sand"
              dir="ltr"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="––––––"
              autoFocus
            />
          </div>
          <button className="w-full rounded-2xl bg-sand py-3 font-extrabold text-royal transition active:scale-[0.99] disabled:opacity-60" type="submit" disabled={busy}>
            {busy ? '…' : 'تأكيد وإنشاء الحساب'}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={() => { setStep('form'); setCode(''); setError('') }} className="text-white/60">
              تعديل الرقم
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={resendIn > 0}
              className={resendIn > 0 ? 'text-white/40' : 'font-bold text-sand'}
            >
              {resendIn > 0 ? `إعادة الإرسال (${resendIn})` : 'إعادة إرسال الرمز'}
            </button>
          </div>
          {devCode && (
            <p className="text-center text-xs text-white/40">وضع تجريبي: استخدم {devCode}</p>
          )}
        </form>
      )}

      {/* ————— تسجيل: تفعيل البصمة ————— */}
      {mode === 'signup' && step === 'bio' && (
        <div className="space-y-5 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/10">
            <Fingerprint className="h-10 w-10 text-sand" strokeWidth={1.6} />
          </div>
          <div>
            <p className="text-lg font-bold text-white">فعّل الدخول بالبصمة</p>
            <p className="mt-1 text-sm text-white/70">
              دخول أسرع وأأمن في المرّات القادمة ببصمتك أو وجهك.
            </p>
          </div>
          <button
            onClick={enableBio}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sand py-3 font-extrabold text-royal disabled:opacity-60"
          >
            <ShieldCheck className="h-5 w-5" strokeWidth={2} />
            {busy ? '…' : 'تفعيل البصمة'}
          </button>
          <button onClick={skipBio} className="flex w-full items-center justify-center gap-1 text-sm text-white/60">
            تخطٍّ الآن
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {mode === 'signup' && step === 'form' && (
        <p className="mt-6 text-center text-xs text-white/50">
          بعد إنشاء الحساب ستُكمل رفع المستندات، ثم يعتمدها فريق قريب قبل بدء العمل.
        </p>
      )}

      <p className="mt-6 text-center text-xs text-white/50">للركوب كراكب، حمّل تطبيق «قريب».</p>
      {!isSupabaseConfigured && (
        <p className="mt-2 text-center text-[10px] text-white/40">وضع معاينة — الرمز التجريبي 000000</p>
      )}
    </div>
  )
}

/** حقل إدخال بهوية شاشة الكابتن الداكنة. */
function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
  dir,
  inputMode,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  dir?: 'ltr' | 'rtl'
  inputMode?: 'tel' | 'numeric' | 'email' | 'text'
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-white/80">{label}</label>
      <input
        className={`w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-sand ${
          dir === 'ltr' ? 'text-left' : ''
        }`}
        dir={dir}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
      />
    </div>
  )
}
