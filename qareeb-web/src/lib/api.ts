import { supabase, isSupabaseConfigured } from './supabase'
import type { Settings, Wallet, Transaction, Ride, Topup, Driver } from './types'

/**
 * طبقة الوصول للبيانات.
 * كل دالة ترجع بيانات تجريبية عندما لا يكون Supabase مضبوطاً،
 * حتى تظل الواجهة قابلة للمعاينة والتشغيل.
 */

// ---------- الإعدادات ----------
const demoSettings: Settings = {
  id: 1,
  commission_rate: 0.15,
  bank_name: 'بنك الخرطوم',
  bank_account_name: 'شركة قريب للنقل',
  bank_account_number: '1234567890123',
  updated_at: new Date().toISOString(),
}

export async function getSettings(): Promise<Settings> {
  if (!isSupabaseConfigured) return demoSettings
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single()
  return error || !data ? demoSettings : data
}

// ---------- المحفظة ----------
export async function getWallet(userId: string): Promise<Wallet | null> {
  if (!isSupabaseConfigured) {
    return {
      id: 'demo-wallet',
      user_id: userId,
      balance: 18000,
      updated_at: new Date().toISOString(),
    }
  }
  const { data } = await supabase.from('wallets').select('*').eq('user_id', userId).single()
  return data ?? null
}

// ---------- المعاملات ----------
const demoTransactions: Transaction[] = [
  {
    id: '1',
    wallet_id: 'demo-wallet',
    type: 'topup',
    amount: 20000,
    ride_id: null,
    note: 'تعبئة رصيد',
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    wallet_id: 'demo-wallet',
    type: 'ride_payment',
    amount: -1220,
    ride_id: null,
    note: 'رحلة · قريب عادي',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '3',
    wallet_id: 'demo-wallet',
    type: 'ride_payment',
    amount: -800,
    ride_id: null,
    note: 'رحلة · ترحيل',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
]

export async function listTransactions(walletId: string): Promise<Transaction[]> {
  if (!isSupabaseConfigured) return demoTransactions
  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('wallet_id', walletId)
    .order('created_at', { ascending: false })
  return data ?? []
}

// ---------- التعبئة (تحويل بنكي) ----------
const PROOF_BUCKET = 'topup-proofs'

/** يرفع إثبات التحويل إلى مجلد المستخدم ويرجّع مساره داخل الـ bucket. */
export async function uploadTopupProof(
  userId: string,
  file: File,
): Promise<{ path?: string; error?: string }> {
  if (!isSupabaseConfigured) return { path: undefined }
  const safeName = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${userId}/${Date.now()}-${safeName}`
  const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, file)
  return error ? { error: error.message } : { path }
}

/** يُنشئ رابطاً موقّعاً مؤقتاً لعرض الإثبات (الـ bucket خاص). */
export async function getProofUrl(path: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

export async function createTopup(
  walletId: string,
  amount: number,
  proofPath: string | null,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase
    .from('topups')
    .insert({ wallet_id: walletId, amount, proof_url: proofPath, status: 'pending' })
  return error ? { error: error.message } : {}
}

// ---------- الرحلات ----------
export async function createRide(ride: Partial<Ride>): Promise<{ id?: string; error?: string }> {
  if (!isSupabaseConfigured) return { id: 'demo-ride' }
  const { data, error } = await supabase.from('rides').insert(ride).select('id').single()
  return error ? { error: error.message } : { id: data?.id }
}

export async function completeRide(rideId: string, rating: number): Promise<void> {
  if (!isSupabaseConfigured) return
  await supabase.from('rides').update({ status: 'completed', rating }).eq('id', rideId)
}

const demoRides: Ride[] = [
  {
    id: 'r1',
    customer_id: 'demo-user',
    driver_id: 'd1',
    service_id: 'standard',
    status: 'completed',
    pickup_lat: 15.5,
    pickup_lng: 32.55,
    pickup_address: 'المنزل',
    dropoff_lat: 15.6,
    dropoff_lng: 32.53,
    dropoff_address: 'العمل',
    fare: 1220,
    payment_method: 'wallet',
    rating: 5,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'r2',
    customer_id: 'demo-user',
    driver_id: 'd2',
    service_id: 'vip',
    status: 'completed',
    pickup_lat: 15.5,
    pickup_lng: 32.55,
    pickup_address: 'المطار',
    dropoff_lat: 15.58,
    dropoff_lng: 32.52,
    dropoff_address: 'الفندق',
    fare: 4300,
    payment_method: 'cash',
    rating: 4,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
]

export async function listRides(customerId: string): Promise<Ride[]> {
  if (!isSupabaseConfigured) return demoRides
  const { data } = await supabase
    .from('rides')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  return data ?? []
}

// ============================================================
//  الأدمن
// ============================================================

export interface AdminStats {
  ridesToday: number
  onlineDrivers: number
  pendingTopups: number
}

const demoPendingTopups: Topup[] = [
  {
    id: 't1',
    wallet_id: 'w-100',
    amount: 20000,
    proof_url: null,
    status: 'pending',
    reviewed_by: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 't2',
    wallet_id: 'w-204',
    amount: 5000,
    proof_url: null,
    status: 'pending',
    reviewed_by: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
]

export async function listPendingTopups(): Promise<Topup[]> {
  if (!isSupabaseConfigured) return demoPendingTopups
  const { data } = await supabase
    .from('topups')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function approveTopup(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('approve_topup', { p_topup: id })
  return error ? { error: error.message } : {}
}

export async function rejectTopup(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('reject_topup', { p_topup: id })
  return error ? { error: error.message } : {}
}

export async function getAdminStats(): Promise<AdminStats> {
  if (!isSupabaseConfigured) {
    return { ridesToday: 128, onlineDrivers: 34, pendingTopups: demoPendingTopups.length }
  }
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [rides, drivers, topups] = await Promise.all([
    supabase
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfDay.toISOString()),
    supabase
      .from('drivers')
      .select('id', { count: 'exact', head: true })
      .eq('is_online', true),
    supabase
      .from('topups')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  return {
    ridesToday: rides.count ?? 0,
    onlineDrivers: drivers.count ?? 0,
    pendingTopups: topups.count ?? 0,
  }
}

export async function updateSettings(
  patch: Partial<Settings>,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase
    .from('settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1)
  return error ? { error: error.message } : {}
}

// ============================================================
//  السائق
// ============================================================

const demoDriver: Driver = {
  id: 'demo-driver',
  user_id: 'demo-user',
  vehicle_type: 'standard',
  plate_number: 'خ ط م ١٢٣٤',
  is_online: false,
  rating: 4.9,
  created_at: new Date().toISOString(),
}

export async function getDriver(userId: string): Promise<Driver | null> {
  if (!isSupabaseConfigured) return demoDriver
  const { data } = await supabase.from('drivers').select('*').eq('user_id', userId).single()
  return data ?? null
}

export async function setDriverOnline(
  driverId: string,
  online: boolean,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase
    .from('drivers')
    .update({ is_online: online })
    .eq('id', driverId)
  return error ? { error: error.message } : {}
}

const demoAvailableRide: Ride = {
  id: 'open-1',
  customer_id: 'c-88',
  driver_id: null,
  service_id: 'standard',
  status: 'searching',
  pickup_lat: 15.5,
  pickup_lng: 32.55,
  pickup_address: 'سوق أم درمان',
  dropoff_lat: 15.6,
  dropoff_lng: 32.53,
  dropoff_address: 'الخرطوم 2',
  fare: 1400,
  payment_method: 'cash',
  rating: null,
  created_at: new Date().toISOString(),
}

export async function listAvailableRides(): Promise<Ride[]> {
  if (!isSupabaseConfigured) return [demoAvailableRide]
  const { data } = await supabase
    .from('rides')
    .select('*')
    .eq('status', 'searching')
    .is('driver_id', null)
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function acceptRide(
  rideId: string,
  driverUserId: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase
    .from('rides')
    .update({ driver_id: driverUserId, status: 'accepted' })
    .eq('id', rideId)
  return error ? { error: error.message } : {}
}

/** تسوية الرحلة عند اكتمالها: يُقيَّد للسائق (الأجرة − العمولة) عبر دالة آمنة. */
export async function settleRide(rideId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('settle_ride', { p_ride: rideId })
  return error ? { error: error.message } : {}
}

const demoDriverTransactions: Transaction[] = [
  {
    id: 'de1',
    wallet_id: 'demo-driver-wallet',
    type: 'ride_earning',
    amount: 1400,
    ride_id: null,
    note: 'أرباح رحلة (إجمالي)',
    created_at: new Date().toISOString(),
  },
  {
    id: 'dc1',
    wallet_id: 'demo-driver-wallet',
    type: 'commission',
    amount: -210,
    ride_id: null,
    note: 'عمولة المنصة',
    created_at: new Date().toISOString(),
  },
  {
    id: 'de2',
    wallet_id: 'demo-driver-wallet',
    type: 'ride_earning',
    amount: 1220,
    ride_id: null,
    note: 'أرباح رحلة (إجمالي)',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
]

export async function listDriverTransactions(walletId: string): Promise<Transaction[]> {
  if (!isSupabaseConfigured) return demoDriverTransactions
  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('wallet_id', walletId)
    .order('created_at', { ascending: false })
  return data ?? []
}
