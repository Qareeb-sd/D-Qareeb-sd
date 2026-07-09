import { QueryClient } from '@tanstack/react-query'

/**
 * إعداد react-query مضبوط للشبكات غير المستقرة (السودان):
 *  - إعادة محاولة تلقائية مع تراجع أُسّي (تعالج انقطاع الشبكة اللحظي).
 *  - staleTime يقلّل الطلبات المكرّرة، وبيانات مخبّأة تظهر فوراً عند العودة.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 1 },
  },
})
