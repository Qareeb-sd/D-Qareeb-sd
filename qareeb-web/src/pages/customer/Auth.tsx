import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '@/components/Logo'
import { useAuth } from '@/store/AuthContext'

type Mode = 'login' | 'signup'
type Step = 'form' | 'otp'

/**
 * تسجيل/دخول عبر Supabase (OTP على الهاتف).
 * رمز التحقق يُطلب في الحالتين؛ الاسم يُسجَّل عند "حساب جديد" فقط.
 * في وضع المعاينة (بدون مفاتيح Supabase) يمرّ التدفّق مباشرة.
 */
export default function Auth() {
  const navigate = useNavigate()
  const { signInWithOtp, verifyOtp } = useAuth()

  const [mode, setMode] = useState<Mode>('login')
  const [step, setStep] = useState<Step>('form')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signInWithOtp(phone, mode === 'signup' ? name : undefined)
    setBusy(false)
    if (error) return setError(error)
    setStep('otp')
  }

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await verifyOtp(phone, otp)
    setBusy(false)
    if (error) return setError(error)
    navigate('/home')
  }

  return (
    <div className="screen px-6 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size={72} rounded={20} />
        <h1 className="mt-4 text-2xl font-extrabold text-green">قريب</h1>
        <p className="text-sm text-ink-soft">
          {step === 'otp'
            ? `أدخل الرمز المُرسل إلى ${phone}`
            : mode === 'login'
              ? 'سجّل دخولك للمتابعة'
              : 'أنشئ حساباً جديداً'}
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-2xl bg-danger/10 px-4 py-3 text-center text-sm text-danger">
          {error}
        </p>
      )}

      {step === 'form' ? (
        <>
          <div className="mb-6 grid grid-cols-2 rounded-2xl border border-hairline bg-white p-1">
            {(['login', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-xl py-2.5 text-sm font-bold transition ${
                  mode === m ? 'bg-green text-white' : 'text-ink-soft'
                }`}
              >
                {m === 'login' ? 'دخول' : 'حساب جديد'}
              </button>
            ))}
          </div>

          <form onSubmit={submitForm} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">الاسم الكامل</label>
                <input
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: محمد أحمد"
                  required
                />
              </div>
            )}
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
            <button className="btn-primary w-full" type="submit" disabled={busy}>
              {busy ? '…' : mode === 'login' ? 'إرسال رمز الدخول' : 'إرسال رمز التحقق'}
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={submitOtp} className="space-y-4">
          <div>
            <label className="label">رمز التحقق</label>
            <input
              className="field text-center tracking-[0.5em]"
              dir="ltr"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="______"
              required
            />
          </div>
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? '…' : 'تأكيد'}
          </button>
          <button
            type="button"
            className="w-full text-sm text-ink-soft"
            onClick={() => {
              setStep('form')
              setError('')
            }}
          >
            تغيير الرقم
          </button>
        </form>
      )}
    </div>
  )
}
