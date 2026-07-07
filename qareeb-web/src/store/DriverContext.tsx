import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Ride } from '@/lib/types'

interface DriverContextValue {
  activeRide: Ride | null
  setActiveRide: (r: Ride | null) => void
}

const DriverContext = createContext<DriverContextValue | null>(null)

export function DriverProvider({ children }: { children: ReactNode }) {
  const [activeRide, setActiveRide] = useState<Ride | null>(null)
  return (
    <DriverContext.Provider value={{ activeRide, setActiveRide }}>
      {children}
    </DriverContext.Provider>
  )
}

export function useDriver() {
  const ctx = useContext(DriverContext)
  if (!ctx) throw new Error('useDriver must be used inside <DriverProvider>')
  return ctx
}
