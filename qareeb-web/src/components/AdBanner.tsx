import { useEffect, useState } from 'react'
import { getActiveAdBanner, trackAdClick, type PublicAdBanner as Ad } from '@/lib/api'

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

  // نسبة أبعاد ثابتة 16:5 — صورة بهذه النسبة (مثلاً 1280×400) تملأ البنر دون أي قص.
  const image = (
    <img
      src={ad.image_url}
      alt="إعلان"
      loading="lazy"
      className="block h-full w-full object-cover"
    />
  )

  return (
    <div className="mb-3">
      <div className="relative aspect-[16/5] overflow-hidden rounded-2xl border border-hairline">
        {ad.link_url ? (
          <a
            href={ad.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-full"
            onClick={() => void trackAdClick(ad.id)}
          >
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
