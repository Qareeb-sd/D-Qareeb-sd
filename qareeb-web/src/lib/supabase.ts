import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // لا نوقف التطبيق حتى تعمل الواجهة أثناء التطوير، لكن ننبّه بوضوح.
  console.warn(
    '[qareeb] مفاتيح Supabase غير مضبوطة. انسخ .env.example إلى .env واملأ ' +
      'VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY.',
  )
}

// عميل غير مُنمَّط عمداً (نستخدم أنواع النطاق في lib/types.ts للتوصيف اليدوي).
// يمكن لاحقاً توليد أنواع كاملة عبر `supabase gen types typescript`.
export const supabase = createClient(
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

// مفتاح anon + الرابط — يُمرَّران في استدعاء fetch مباشر لدوال Edge التي تُفعِّل
// «Verify JWT» (المفتاح مُوقَّع بالسرّ القديم فيرضي الفحص، واستدعاء fetch يضمن
// الترويسة بلا أي تجاوز من مكتبة supabase).
export const supabaseAnonKey = anonKey ?? 'public-anon-key'
export const supabaseUrl = url ?? 'http://localhost:54321'
