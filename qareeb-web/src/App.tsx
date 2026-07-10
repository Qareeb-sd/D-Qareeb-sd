import { Suspense, lazy } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/store/AuthContext'
import { RideProvider } from '@/store/RideContext'
import { DriverProvider } from '@/store/DriverContext'
import { MapsProvider } from '@/store/MapsContext'
import ErrorBoundary from '@/components/ErrorBoundary'

/**
 * كود مشترك يُبنى إلى ثلاثة أهداف مستقلّة حسب VITE_APP:
 *   - customer (افتراضي) → «قريب» (العميل).
 *   - driver             → «قريب كابتن» (السائق).
 *   - admin              → موقع لوحة الإدارة (ويب فقط).
 * الشرط ثابت وقت البناء، فيُستبعد كود الأهداف الأخرى من الحزمة.
 */
const AppRoutes = lazy(() =>
  import.meta.env.VITE_APP === 'driver'
    ? import('@/routes/DriverRoutes')
    : import.meta.env.VITE_APP === 'admin'
      ? import('@/routes/AdminRoutes')
      : import('@/routes/CustomerRoutes'),
)

function Splash() {
  return (
    <div className="screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-soft border-t-green" />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MapsProvider>
          <AuthProvider>
            <RideProvider>
              <DriverProvider>
                <Suspense fallback={<Splash />}>
                  <AppRoutes />
                </Suspense>
              </DriverProvider>
            </RideProvider>
          </AuthProvider>
        </MapsProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
