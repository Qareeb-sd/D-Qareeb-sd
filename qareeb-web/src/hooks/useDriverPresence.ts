import { useEffect, useRef } from 'react'
import { useAuth } from '@/store/AuthContext'
import { getDriver, updateMyLocation } from '@/lib/api'
import { getCurrentPos, watchPos } from '@/lib/geo'

/**
 * يبثّ موقع السائق المتّصل كل ~10 ثوانٍ من **أيّ شاشة** (لا من الرئيسية فقط)،
 * حتى لا يختفي من خريطة العملاء عند فتح المحفظة/الملف الشخصي لأكثر من 3 دقائق.
 * يُركَّب مرّة واحدة في جذر تطبيق السائق.
 */
export function useDriverPresence() {
  const { profile } = useAuth()
  const onlineRef = useRef(false)

  useEffect(() => {
    if (!profile || profile.role !== 'driver') return
    let alive = true
    let last = 0
    let stopWatch: () => void = () => {}

    const ping = (lat: number, lng: number) => {
      if (!alive || !onlineRef.current) return
      const now = Date.now()
      if (now - last < 10000) return // خنق: مرّة كل 10ث على الأكثر
      last = now
      void updateMyLocation(lat, lng)
    }

    const checkOnline = async () => {
      const d = await getDriver(profile.id).catch(() => null)
      const nowOnline = Boolean(d?.is_online)
      const wasOnline = onlineRef.current
      onlineRef.current = nowOnline
      if (nowOnline && !wasOnline) {
        const p = await getCurrentPos().catch(() => null)
        if (p) {
          last = 0
          ping(p.lat, p.lng)
        }
        stopWatch = await watchPos((pos) => ping(pos.lat, pos.lng)).catch(() => () => {})
      } else if (!nowOnline && wasOnline) {
        stopWatch()
        stopWatch = () => {}
      }
    }

    void checkOnline()
    const iv = setInterval(() => void checkOnline(), 30000) // إعادة فحص حالة الاتصال
    return () => {
      alive = false
      clearInterval(iv)
      stopWatch()
    }
  }, [profile])
}
