/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  /** هدف البناء: 'driver' (قريب كابتن) · 'admin' (موقع الإدارة) · وإلا «قريب» (العميل). */
  readonly VITE_APP?: 'customer' | 'driver' | 'admin'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
