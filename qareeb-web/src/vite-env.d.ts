/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  /** هدف البناء: 'driver' لتطبيق «قريب كابتن»، وإلا «قريب» (العميل). */
  readonly VITE_APP?: 'customer' | 'driver'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
