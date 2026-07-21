import { useEffect, useState } from 'react'
import { getActiveAdBanner } from '@/lib/api'
import type { AdBanner as Ad } from '@/lib/types'

/**
 * بنر إعلان مدفوع — صورة يرفعها الأدمن، تُفتح رابطاً عند الضغط (إن وُجد).
 * يظهر أحدث بنر نشط ساري لجمهور هذا التطبيق (عميل/سائق). يختفي بلا أثر إن لا يوجد.
 */
export default function AdBanner({ role }: { role: 'customer' | 'driver' }) {
  const [ad, setAd] = useState<Ad | null>(null)

  useEffect(() => {
    void getActiveAdBanner(role).then(setAd)
  }, [role])

  if (!ad) return null

  // شريط قصير بارتفاع ثابت (بحجم بطاقات المركبات) — الصورة تملأ عرضاً وتُقصّ ارتفاعاً.
  const image = (
    <img
      src={ad.image_url}
      alt={ad.title ?? 'إعلان'}
      loading="lazy"
      className="block h-24 w-full object-cover sm:h-28"
    />
  )

  return (
    <div className="mb-3">
      <div className="relative overflow-hidden rounded-2xl border border-hairline">
        {ad.link_url ? (
          <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className="block">
            {image}
          </a>
        ) : (
          image
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold text-white">
          إعلان
        </span>
      </div>
    </div>
  )
}
