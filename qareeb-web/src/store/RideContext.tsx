import { createContext, useContext, useState, type ReactNode } from 'react'
import type { PaymentMethod } from '@/lib/types'
import { KHARTOUM } from '@/theme'

interface Place {
  pos: google.maps.LatLngLiteral
  address: string
}

interface RideDraft {
  rideId: string | null
  serviceId: string | null
  pickup: Place
  dropoff: Place | null
  payment: PaymentMethod
  fare: number | null
}

interface RideContextValue extends RideDraft {
  setRideId: (id: string | null) => void
  setServiceId: (id: string) => void
  setPickup: (p: Place) => void
  setDropoff: (p: Place | null) => void
  setPayment: (m: PaymentMethod) => void
  setFare: (n: number) => void
  reset: () => void
}

const defaultDraft: RideDraft = {
  rideId: null,
  serviceId: null,
  pickup: { pos: KHARTOUM, address: 'الخرطوم' },
  dropoff: null,
  payment: 'cash',
  fare: null,
}

const RideContext = createContext<RideContextValue | null>(null)

export function RideProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<RideDraft>(defaultDraft)

  const value: RideContextValue = {
    ...draft,
    setRideId: (rideId) => setDraft((d) => ({ ...d, rideId })),
    setServiceId: (serviceId) => setDraft((d) => ({ ...d, serviceId })),
    setPickup: (pickup) => setDraft((d) => ({ ...d, pickup })),
    setDropoff: (dropoff) => setDraft((d) => ({ ...d, dropoff })),
    setPayment: (payment) => setDraft((d) => ({ ...d, payment })),
    setFare: (fare) => setDraft((d) => ({ ...d, fare })),
    reset: () => setDraft(defaultDraft),
  }

  return <RideContext.Provider value={value}>{children}</RideContext.Provider>
}

export function useRide() {
  const ctx = useContext(RideContext)
  if (!ctx) throw new Error('useRide must be used inside <RideProvider>')
  return ctx
}
