import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '@/components/BottomNav'
import NotificationToggle from '@/components/NotificationToggle'
import { useAuth } from '@/store/AuthContext'
import { updateEmergencyContacts, getWallet, listRides } from '@/lib/api'
import { money } from '@/lib/format'

export default function Profile() {
  const navigate = useNavigate()
  const { profile, signOut, refreshProfile } = useAuth()

  const [c1, setC1] = useState(profile?.sos_contact1 ?? '')
  const [c2, setC2] = useState(profile?.sos_contact2 ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [showSos, setShowSos] = useState(false)

  const [balance, setBalance] = useState<number | null>(null)
  const [ridesCount, setRidesCount] = useState<number | null>(null)

  useEffect(() => {
    if (!profile?.id) return
    void getWallet(profile.id).then((w) => setBalance(w?.balance ?? 0))
    void listRides(profile.id).then((r) => setRidesCount(r.length))
  }, [profile?.id])

  const logout = async () => {
    await signOut()
    navigate('/auth')
  }

  const saveContacts = async () => {
    setBusy(true)
    setMsg('')
    const { error } = await updateEmergencyContacts(
      profile?.id ?? '',
      c1.trim() || null,
      c2.trim() || null,
    )
    await refreshProfile()
    setBusy(false)
    setMsg(error ? `خطأ: ${error}` : 'تم حفظ جهات الطوارئ ✓')
  }

  const menu: { icon: string; label: string; badge?: string; onClick: () => void }[] = [
    { icon: '🧾', label: 'رحلاتي السابقة', onClick: () => navigate('/rides') },
    { icon: '📍', label: 'العناوين المحفوظة', onClick: () => navigate('/select-location') },
    { icon: '🔔', label: 'الإشعارات', onClick: () => setShowSos(false) },
    { icon: '🆘', label: 'جهات الطوارئ', badge: 'مهم', onClick: () => setShowSos((v) => !v) },
    { icon: '💬', label: 'المساعدة والدعم', onClick: () => {} },
    { icon: 'ℹ️', label: 'عن قريب', onClick: () => {} },
  ]

  return (
    <div className="screen">
      <main className="flex-1 px-4 pb-24 pt-5">
        {/* رأس الحساب */}
        <div className="flex items-center justify-end gap-4">
          <div className="text-right">
            <p className="text-xl font-extrabold text-green">{profile?.full_name ?? 'مستخدم قريب'}</p>
            <p className="text-sm text-ink-soft" dir="ltr">
              {profile?.phone ?? '—'}
            </p>
          </div>
          <div className="grid h-20 w-20 place-items-center rounded-full bg-green-soft text-4xl ring-4 ring-white">
            🧑🏽
          </div>
        </div>

        {/* بطاقات الإحصاء */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatCard icon="🚗" value={ridesCount == null ? '…' : String(ridesCount)} label="رحلاتي" />
          <StatCard icon="⭐" value={profile?.rating != null ? String(profile.rating) : '—'} label="تقييمك" />
          <StatCard
            icon="👛"
            value={balance == null ? '…' : money(balance)}
            label="رصيد المحفظة"
          />
        </div>

        {/* القائمة */}
        <div className="card mt-5 divide-y divide-hairline p-0">
          {menu.map((m) => (
            <button
              key={m.label}
              onClick={m.onClick}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-right"
            >
              <span className="text-xl">{m.icon}</span>
              <span className="flex-1 font-medium">{m.label}</span>
              {m.badge && (
                <span className="rounded-md bg-warning px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {m.badge}
                </span>
              )}
              <span className="text-ink-muted">‹</span>
            </button>
          ))}
        </div>

        {/* محرّر جهات الطوارئ (يظهر عند الضغط) */}
        {showSos && (
          <div className="card mt-4 p-4">
            <p className="mb-1 font-bold">جهات الطوارئ</p>
            <p className="mb-3 text-xs text-ink-muted">
              رقمان يصلهما تنبيه فيه موقعك عند ضغطك زر الطوارئ أثناء الرحلة.
            </p>
            <input
              className="field text-left"
              dir="ltr"
              inputMode="tel"
              placeholder="رقم جهة الطوارئ الأولى"
              value={c1}
              onChange={(e) => setC1(e.target.value)}
            />
            <input
              className="field mt-2 text-left"
              dir="ltr"
              inputMode="tel"
              placeholder="رقم جهة الطوارئ الثانية (اختياري)"
              value={c2}
              onChange={(e) => setC2(e.target.value)}
            />
            {msg && <p className="mt-2 text-sm text-green">{msg}</p>}
            <button onClick={saveContacts} disabled={busy} className="btn-primary mt-3 w-full">
              {busy ? '…' : 'حفظ جهات الطوارئ'}
            </button>
          </div>
        )}

        <NotificationToggle userId={profile?.id ?? 'demo-user'} />

        <button onClick={logout} className="btn-outline mt-6 w-full text-danger">
          تسجيل الخروج
        </button>
      </main>

      <BottomNav />
    </div>
  )
}

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 p-3 text-center">
      <span className="text-2xl">{icon}</span>
      <span className="font-extrabold text-green">{value}</span>
      <span className="text-[11px] text-ink-muted">{label}</span>
    </div>
  )
}
