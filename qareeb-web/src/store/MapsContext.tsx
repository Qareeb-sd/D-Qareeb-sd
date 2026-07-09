import { createContext, useContext, type ReactNode } from 'react'
import { useJsApiLoader } from '@react-google-maps/api'
import {
  GOOGLE_MAPS_API_KEY,
  MAPS_LIBRARIES,
  MAPS_LOADER_ID,
} from '@/lib/maps'

/**
 * يُحمّل سكربت خرائط قوقل **مرة واحدة** على مستوى التطبيق، بدل تكراره في كل مكوّن.
 * كل من MapView و SelectLocation يقرآن الحالة من هنا.
 */
interface MapsValue {
  isLoaded: boolean
}

const MapsContext = createContext<MapsValue>({ isLoaded: false })

export function MapsProvider({ children }: { children: ReactNode }) {
  const { isLoaded } = useJsApiLoader({
    id: MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAPS_LIBRARIES,
  })
  return <MapsContext.Provider value={{ isLoaded }}>{children}</MapsContext.Provider>
}

export function useMaps() {
  return useContext(MapsContext)
}
