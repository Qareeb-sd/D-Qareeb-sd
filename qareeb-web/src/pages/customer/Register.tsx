import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '@/components/Logo'
import { useAuth } from '@/store/AuthContext'

/** إنشاء حساب عميل: الاسم + رقم واتساب + كلمة السر (مرّتين) + تاريخ الميلاد. */
export default function Register() {
  const navigate = useNavigate()
  const { registerWithPhone } = useAuth()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (name.trim().length < 2) return setError('أدخل اسمك.')
    if (phone.replace(/\D/g, '').length < 9) return setError('أدخل رقم واتساب صحيحاً.')
    if (password.length < 6) return setError('كلمة السر يجب ألا تقل عن 6 أحرف.')
    if (password !== password2) return setError('كلمتا السر غير متطابقتين.')

    setBusy(true)
    const { error } = await registerWithPhone({
      phone,
      password,
      fullName: name.trim(),
      birthdate: birthdate || null,
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
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo size={64} rounded={18} />
        <h1 className="mt-3 text-2xl font-extrabold text-green">إنشاء حساب</h1>
        <p className="text-sm text-ink-soft">أدخل بياناتك للتسجيل في قريب</p>
      </div>

      {error && (
        <p className="mb-4 rounded-2xl bg-danger/10 px-4 py-3 text-center text-sm text-danger">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">الاسم الكامل</label>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسمك"
            required
          />
        </div>
        <div>
          <label className="label">رقم واتساب</label>
          <input
            className="field text-left"
            dir="ltr"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+249 9X XXX XXXX"
            required
          />
          <p className="mt-1 text-xs text-ink-muted">
            سنرسل رمز التحقق إلى هذا الرقم عبر واتساب.
          </p>
        </div>
        <div>
          <label className="label">تاريخ الميلاد</label>
          <input
            className="field text-left"
            dir="ltr"
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
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
            placeholder="6 أحرف على الأقل"
            required
          />
        </div>
        <div>
          <label className="label">تأكيد كلمة السر</label>
          <input
            className="field text-left"
            dir="ltr"
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="أعد كتابة كلمة السر"
            required
          />
        </div>
        <button className="btn-primary w-full" type="submit" disabled={busy}>
          {busy ? '…' : 'إنشاء الحساب'}
        </button>
      </form>

      <button
        onClick={() => navigate('/auth')}
        className="mt-6 w-full text-center text-sm font-bold text-green"
      >
        لديك حساب؟ سجّل الدخول
      </button>
    </div>
  )
}
