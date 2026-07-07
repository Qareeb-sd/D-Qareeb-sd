import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // لا نوقف التطبيق حتى تعمل الواجهة أثناء التطوير، لكن ننبّه بوضوح.
  console.warn(
    '[qareeb] مفاتيح Supabase غير مضبوطة. انسخ .env.example إلى .env واملأ ' +
      'VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY.',
  )
}

export const supabase = createClient<Database>(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)

export const isSupabaseConfigured = Boolean(url && anonKey)
