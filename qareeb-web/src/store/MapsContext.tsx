import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useJsApiLoader } from '@react-google-maps/api'
import { GOOGLE_MAPS_API_KEY, MAPS_LIBRARIES, MAPS_LOADER_ID } from '@/lib/maps'

/**
 * يُحمّل سكربت خرائط قوقل **مرة واحدة** على مستوى التطبيق.
 * mapsError: يصبح true إذا فشل تحميل السكربت أو فشلت المصادقة (مثلاً حجب جغرافي
 * على السودان). حينها تعود الواجهة للخريطة المبسّطة والاقتراحات المحلية بلا تعطّل.
 */
interface MapsValue {
  isLoaded: boolean
  mapsError: boolean
}

const MapsContext = createContext<MapsValue>({ isLoaded: false, mapsError: false })

export function MapsProvider({ children }: { children: ReactNode }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAPS_LIBRARIES,
  })

  // خرائط قوقل تستدعي هذه الدالة عند فشل المصادقة/الترخيص (مفتاح/حجب).
  const [authFailed, setAuthFailed] = useState(false)
  useEffect(() => {
    ;(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () =>
      setAuthFailed(true)
  }, [])

  const mapsError = Boolean(loadError) || authFailed
  return (
    <MapsContext.Provider value={{ isLoaded: isLoaded && !mapsError, mapsError }}>
      {children}
    </MapsContext.Provider>
  )
}

export function useMaps() {
  return useContext(MapsContext)
}
