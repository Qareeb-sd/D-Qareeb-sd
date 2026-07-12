import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { listServices } from '@/lib/api'
import {
  services as seedServices,
  setRuntimeServices,
  type Service,
} from '@/data/services'

/**
 * يُحمّل كتالوج الخدمات من قاعدة البيانات (service_pricing) مرة واحدة على مستوى
 * التطبيق، ويحقنه في ذاكرة data/services عبر setRuntimeServices حتى تصبح كل
 * الشاشات ديناميكية (حالات + مركبات جديدة) بلا تحديث للتطبيق.
 * قبل الاكتمال نعرض القائمة المبدئية كي لا تظهر شاشة فارغة.
 */
interface ServicesValue {
  services: Service[] // كل الخدمات النشطة (المخفية مشمولة)
  loading: boolean
  reload: () => Promise<void>
}

const ServicesContext = createContext<ServicesValue>({
  services: seedServices,
  loading: true,
  reload: async () => {},
})

export function ServicesProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<Service[]>(seedServices)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const list = await listServices()
      setRuntimeServices(list)
      setServices(list)
    } catch {
      // نُبقي القائمة المبدئية عند الفشل
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ServicesContext.Provider value={{ services, loading, reload: load }}>
      {children}
    </ServicesContext.Provider>
  )
}

export function useServices() {
  return useContext(ServicesContext)
}
