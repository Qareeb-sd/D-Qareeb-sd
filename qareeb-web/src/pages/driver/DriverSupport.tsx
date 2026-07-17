import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Logo from '@/components/Logo'
import DriverNav from '@/components/DriverNav'
import SupportChat from '@/components/SupportChat'

/** الدعم داخل التطبيق للسائق — تذاكر ومحادثة مع الإدارة. */
export default function DriverSupport() {
  const navigate = useNavigate()
  return (
    <div className="screen font-plex bg-ivory">
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-4">
        <button onClick={() => navigate(-1)} aria-label="رجوع" className="text-ink-soft">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Logo variant="driver" size={36} rounded={10} />
        <h1 className="text-lg font-bold">الدعم والمحادثة</h1>
      </header>
      <main className="flex-1 px-4 pb-24 pt-4">
        <SupportChat />
      </main>
      <DriverNav />
    </div>
  )
}
