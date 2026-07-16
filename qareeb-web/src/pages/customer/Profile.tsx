import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Wallet,
  Star,
  Car,
  Receipt,
  MapPin,
  Clock,
  Siren,
  LifeBuoy,
  Info,
  ChevronLeft,
  Share2,
  Gift,
  type LucideIcon,
} from 'lucide-react'
import BottomNav from '@/components/BottomNav'
import NotificationToggle from '@/components/NotificationToggle'
import ShareRideButton from '@/components/ShareRideButton'
import { useAuth } from '@/store/AuthContext'
import { useRide } from '@/store/RideContext'
import { updateEmergencyContacts, getWallet, listRides } from '@/lib/api'
import { money } from '@/lib/format'

export default function Profile() {
  const navigate = useNavigate()
  const { profile, signOut, refreshProfile } = useAuth()
  const { rideId } = useRide()

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

  const menu: { icon: LucideIcon; label: string; badge?: string; onClick: () => void }[] = [
    { icon: Receipt, label: 'رحلاتي السابقة', onClick: () => navigate('/rides') },
    { icon: Clock, label: 'رحلاتي المجدولة', onClick: () => navigate('/scheduled') },
    { icon: MapPin, label: 'العناوين المحفوظة', onClick: () => navigate('/addresses') },
    { icon: Gift, label: 'دعوة صديق واربح', badge: 'جديد', onClick: () => navigate('/referral') },
    { icon: Siren, label: 'جهات الطوارئ ومشاركة الرحلة', badge: 'مهم', onClick: () => setShowSos((v) => !v) },
    { icon: LifeBuoy, label: 'المساعدة والدعم', onClick: () => navigate('/help') },
    { icon: Info, label: 'عن قريب', onClick: () => navigate('/about') },
  ]

  return (
    <div className="screen">
      <main className="flex-1 px-4 pb-24 pt-5">
        {/* رأس الحساب */}
        <div className="text-right">
          <p className="text-xl font-extrabold text-green">{profile?.full_name ?? 'مستخدم قريب'}</p>
          <p className="text-sm text-ink-soft" dir="ltr">
            {profile?.phone ?? '—'}
          </p>
        </div>

        {/* بطاقات الإحصاء */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatCard Icon={Car} value={ridesCount == null ? '…' : String(ridesCount)} label="رحلاتي" />
          <StatCard
            Icon={Star}
            value={profile?.rating != null ? String(profile.rating) : '—'}
            label="تقييمك"
          />
          <StatCard
            Icon={Wallet}
            value={balance == null ? '…' : money(balance)}
            label="رصيد المحفظة"
          />
        </div>

        {/* القائمة */}
        <div className="card mt-5 divide-y divide-hairline p-0">
          {menu.map((m) => {
            const Icon = m.icon
            return (
              <button
                key={m.label}
                onClick={m.onClick}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-right"
              >
                <Icon className="h-5 w-5 text-green" strokeWidth={1.8} />
                <span className="flex-1 font-medium">{m.label}</span>
                {m.badge && (
                  <span className="rounded-md bg-warning px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {m.badge}
                  </span>
                )}
                <ChevronLeft className="h-4 w-4 text-ink-muted" />
              </button>
            )
          })}
        </div>

        {/* جهات الطوارئ + مشاركة الرحلة (يظهر عند الضغط) */}
        {showSos && (
          <div className="card mt-4 p-4">
            <p className="mb-1 flex items-center gap-2 font-bold">
              <Siren className="h-4 w-4 text-danger" strokeWidth={2} />
              جهات الطوارئ
            </p>
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

            {/* مشاركة الرحلة المباشرة */}
            <div className="mt-4 border-t border-hairline pt-4">
              <p className="mb-1 flex items-center gap-2 font-bold">
                <Share2 className="h-4 w-4 text-green" strokeWidth={2} />
                مشاركة الرحلة المباشرة
              </p>
              <p className="mb-3 text-xs text-ink-muted">
                شارك موقعك أثناء الرحلة مع شخص تثق به — يصله رمز يتابع به رحلتك لحظياً عبر تطبيق قريب.
              </p>
              {rideId ? (
                <ShareRideButton rideId={rideId} />
              ) : (
                <p className="rounded-2xl bg-green-mint px-4 py-3 text-center text-xs text-ink-soft">
                  متاح أثناء وجود رحلة نشطة — يظهر زر المشاركة والرمز هنا وفي شاشة الرحلة.
                </p>
              )}
            </div>
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

function StatCard({ Icon, value, label }: { Icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 p-3 text-center">
      <Icon className="h-6 w-6 text-green" strokeWidth={1.8} />
      <span className="font-extrabold text-green">{value}</span>
      <span className="text-[11px] text-ink-muted">{label}</span>
    </div>
  )
}
