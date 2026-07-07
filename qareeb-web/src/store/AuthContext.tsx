import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { AppUser } from '@/lib/types'

interface AuthValue {
  session: Session | null
  profile: AppUser | null
  loading: boolean
  /** أرسل رمز OTP إلى الهاتف. عند التسجيل الجديد مرّر الاسم. */
  signInWithOtp: (phone: string, fullName?: string) => Promise<{ error?: string }>
  /** أكّد رمز OTP وأنشئ/حمّل ملف المستخدم. */
  verifyOtp: (phone: string, token: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

// اسم مؤقت يُحمل بين الخطوتين (إرسال ثم تأكيد) لتسجيل الاسم عند التسجيل الجديد.
let pendingName: string | undefined

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  // تحميل ملف المستخدم من جدول users.
  async function loadProfile(userId: string, phone: string) {
    const { data } = await supabase.from('users').select('*').eq('id', userId).single()
    if (data) {
      setProfile(data)
      return
    }
    // لا يوجد ملف بعد → أنشئه (أول تسجيل).
    const { data: created } = await supabase
      .from('users')
      .insert({ id: userId, phone, full_name: pendingName ?? null, role: 'customer' })
      .select('*')
      .single()
    setProfile(created ?? null)
    pendingName = undefined
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session?.user) {
        void loadProfile(data.session.user.id, data.session.user.phone ?? '')
      }
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s?.user) void loadProfile(s.user.id, s.user.phone ?? '')
      else setProfile(null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const value: AuthValue = {
    session,
    profile,
    loading,

    async signInWithOtp(phone, fullName) {
      pendingName = fullName
      if (!isSupabaseConfigured) {
        // وضع تجريبي: نتخطّى الإرسال الحقيقي.
        return {}
      }
      const { error } = await supabase.auth.signInWithOtp({ phone })
      return error ? { error: error.message } : {}
    },

    async verifyOtp(phone, token) {
      if (!isSupabaseConfigured) {
        // وضع تجريبي: نُنشئ جلسة وهمية محلية لتسيير الواجهة.
        setProfile({
          id: 'demo-user',
          phone,
          full_name: pendingName ?? 'مستخدم تجريبي',
          role: 'customer',
          created_at: new Date().toISOString(),
        })
        setSession({ user: { id: 'demo-user' } } as unknown as Session)
        return {}
      }
      const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
      return error ? { error: error.message } : {}
    },

    async signOut() {
      if (isSupabaseConfigured) await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
