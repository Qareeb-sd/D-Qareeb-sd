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
  /**
   * دخول برقم الهاتف + كلمة السر (بلا SMS).
   * إن لم يوجد حساب بعد يُنشأ تلقائياً (مؤقتاً حتى نبني تسجيل واتساب).
   */
  signInWithPhone: (
    phone: string,
    password: string,
    fullName?: string,
  ) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

// نربط الرقم بحساب Supabase عبر بريد اصطناعي (مصادقة بلا مزوّد SMS).
const phoneToEmail = (phone: string) => `${phone.replace(/\D/g, '')}@qareeb.sd`

// نحمل الرقم/الاسم لإنشاء ملف المستخدم بعد أول دخول.
let pendingPhone: string | undefined
let pendingName: string | undefined

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  // تحميل ملف المستخدم من جدول users (وإنشاؤه أول مرة).
  async function loadProfile(userId: string) {
    const { data } = await supabase.from('users').select('*').eq('id', userId).single()
    if (data) {
      setProfile(data)
      return
    }
    const { data: created } = await supabase
      .from('users')
      .insert({
        id: userId,
        phone: pendingPhone ?? userId,
        full_name: pendingName ?? null,
        role: 'customer',
      })
      .select('*')
      .single()
    setProfile(created ?? null)
    pendingPhone = undefined
    pendingName = undefined
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session?.user) void loadProfile(data.session.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s?.user) void loadProfile(s.user.id)
      else setProfile(null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const value: AuthValue = {
    session,
    profile,
    loading,

    async signInWithPhone(phone, password, fullName) {
      pendingPhone = phone
      pendingName = fullName

      if (!isSupabaseConfigured) {
        // وضع تجريبي: جلسة وهمية محلية.
        setProfile({
          id: 'demo-user',
          phone,
          full_name: fullName ?? 'مستخدم تجريبي',
          role: 'customer',
          created_at: new Date().toISOString(),
        })
        setSession({ user: { id: 'demo-user' } } as unknown as Session)
        return {}
      }

      const email = phoneToEmail(phone)
      // جرّب الدخول أولاً.
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error) return {}

      // لا يوجد حساب بعد → أنشئه (مؤقتاً حتى تسجيل واتساب).
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) return { error: signUpError.message }
      // في حال تعطيل تأكيد البريد، تُنشأ الجلسة مباشرة.
      if (!data.session) {
        const retry = await supabase.auth.signInWithPassword({ email, password })
        if (retry.error) return { error: retry.error.message }
      }
      return {}
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
