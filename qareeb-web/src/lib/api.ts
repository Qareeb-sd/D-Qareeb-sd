import { supabase, isSupabaseConfigured } from './supabase'
import type {
  Settings,
  Wallet,
  Transaction,
  Ride,
  Topup,
  Driver,
  DriverApplication,
  DriverAppStatus,
  ServicePricing,
  SosAlert,
  SosRole,
  StaffRow,
  StaffPerm,
  AdminAccess,
} from './types'

/**
 * طبقة الوصول للبيانات.
 * كل دالة ترجع بيانات تجريبية عندما لا يكون Supabase مضبوطاً،
 * حتى تظل الواجهة قابلة للمعاينة والتشغيل.
 */

// ---------- الإعدادات ----------
const demoSettings: Settings = {
  id: 1,
  commission_rate: 0.15,
  surge_multiplier: 1.0,
  tier1_max_km: 2,
  tier2_max_km: 10,
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

// ---------- تسعير المركبات ----------
const demoPricing: ServicePricing[] = [
  { service_id: 'standard', name: 'قريب عادي', base_fare: 600, per_km_urban: 130, per_km_far: 160, per_minute: 18, sort_order: 0, active: true, updated_at: '' },
  { service_id: 'ladies', name: 'قريب نسائي', base_fare: 900, per_km_urban: 180, per_km_far: 220, per_minute: 25, sort_order: 1, active: true, updated_at: '' },
  { service_id: 'amjad', name: 'أمجاد', base_fare: 800, per_km_urban: 160, per_km_far: 200, per_minute: 22, sort_order: 2, active: true, updated_at: '' },
  { service_id: 'hiace', name: 'هايس', base_fare: 1200, per_km_urban: 200, per_km_far: 240, per_minute: 30, sort_order: 3, active: true, updated_at: '' },
  { service_id: 'rickshaw', name: 'ركشة', base_fare: 300, per_km_urban: 90, per_km_far: 110, per_minute: 12, sort_order: 4, active: true, updated_at: '' },
  { service_id: 'open', name: 'مشوار مفتوح', base_fare: 700, per_km_urban: 150, per_km_far: 190, per_minute: 20, sort_order: 5, active: true, updated_at: '' },
  { service_id: 'tow', name: 'سحاب', base_fare: 2500, per_km_urban: 300, per_km_far: 350, per_minute: 40, sort_order: 6, active: true, updated_at: '' },
]

export async function listServicePricing(): Promise<ServicePricing[]> {
  if (!isSupabaseConfigured) return demoPricing
  const { data } = await supabase
    .from('service_pricing')
    .select('*')
    .order('sort_order', { ascending: true })
  return data ?? []
}

export async function getServicePricing(serviceId: string): Promise<ServicePricing | null> {
  if (!isSupabaseConfigured) return demoPricing.find((p) => p.service_id === serviceId) ?? null
  const { data } = await supabase
    .from('service_pricing')
    .select('*')
    .eq('service_id', serviceId)
    .single()
  return data ?? null
}

export async function updateServicePricing(
  serviceId: string,
  patch: Partial<ServicePricing>,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase
    .from('service_pricing')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('service_id', serviceId)
  return error ? { error: error.message } : {}
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

/**
 * تقييم الرحلة من العميل (النجوم فقط) — لا يُنهي الرحلة ولا يسوّيها.
 * الإنهاء والتسوية يتمّان عبر السائق (settleRide) لتفادي إكمال الرحلة دون دفع.
 */
export async function rateRide(rideId: string, rating: number): Promise<void> {
  if (!isSupabaseConfigured) return
  await supabase.from('rides').update({ rating }).eq('id', rideId)
}

/** بيانات السائق المُسنَد لرحلة (اسم، تقييم، هاتف، مركبة) عبر دالة آمنة. */
export interface RideDriverInfo {
  full_name: string | null
  phone: string
  rating: number | null
  vehicle_type: string | null
  plate_number: string | null
}

const demoRideDriver: RideDriverInfo = {
  full_name: 'عثمان الطيب',
  phone: '+249900000000',
  rating: 4.9,
  vehicle_type: 'amjad',
  plate_number: 'خ ط م ١٢٣٤',
}

export async function getRideDriver(rideId: string): Promise<RideDriverInfo | null> {
  if (!isSupabaseConfigured) return demoRideDriver
  const { data } = await supabase.rpc('get_ride_driver', { p_ride: rideId })
  return (Array.isArray(data) ? data[0] : data) ?? null
}

/** رحلة العميل الجارية (لاسترجاع الحالة بعد تحديث الصفحة). */
export async function getActiveCustomerRide(customerId: string): Promise<Ride | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase
    .from('rides')
    .select('*')
    .eq('customer_id', customerId)
    .in('status', ['requested', 'searching', 'accepted', 'arrived', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

/** يجلب رحلة واحدة (للحصول على الموقع المبدئي للسائق عند فتح شاشة التتبع). */
export async function getRide(rideId: string): Promise<Ride | null> {
  if (!isSupabaseConfigured || !rideId) return null
  const { data } = await supabase.from('rides').select('*').eq('id', rideId).single()
  return data ?? null
}

/**
 * تتبع مباشر: يبثّ السائق موقعه عبر دالة آمنة (Supabase) — بلا أي طلب لخرائط قوقل.
 * يُستدعى بمعدّل مُقنَّن من جهاز السائق أثناء الرحلة.
 */
export async function updateDriverLocation(
  rideId: string,
  lat: number,
  lng: number,
): Promise<void> {
  if (!isSupabaseConfigured || !rideId) return
  await supabase.rpc('update_driver_location', { p_ride: rideId, p_lat: lat, p_lng: lng })
}

// ---------- إشعارات Web Push ----------
export async function savePushSubscription(sub: {
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}): Promise<void> {
  if (!isSupabaseConfigured) return
  await supabase.from('push_subscriptions').upsert(sub, { onConflict: 'endpoint' })
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  if (!isSupabaseConfigured) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

// ---------- الطوارئ (SOS) ----------
/** يُطلق تنبيه طوارئ (يُخزَّن ويظهر للأدمن لحظياً). يتحمّل غياب الموقع. */
export async function raiseSos(alert: {
  user_id?: string
  ride_id?: string | null
  role: SosRole
  lat?: number | null
  lng?: number | null
  note?: string | null
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.from('sos_alerts').insert({
    user_id: alert.user_id,
    ride_id: alert.ride_id ?? null,
    role: alert.role,
    lat: alert.lat ?? null,
    lng: alert.lng ?? null,
    note: alert.note ?? null,
    status: 'open',
  })
  return error ? { error: error.message } : {}
}

const demoSosAlerts: SosAlert[] = [
  {
    id: 'sos-demo',
    ride_id: null,
    user_id: 'c-88',
    role: 'customer',
    lat: 15.5007,
    lng: 32.5599,
    note: null,
    status: 'open',
    created_at: new Date().toISOString(),
  },
]

export async function listSosAlerts(): Promise<SosAlert[]> {
  if (!isSupabaseConfigured) return demoSosAlerts
  const { data } = await supabase
    .from('sos_alerts')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function resolveSos(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.from('sos_alerts').update({ status: 'resolved' }).eq('id', id)
  return error ? { error: error.message } : {}
}

/** يحفظ رقمَي جهات الطوارئ في ملف العميل. */
export async function updateEmergencyContacts(
  userId: string,
  contact1: string | null,
  contact2: string | null,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase
    .from('users')
    .update({ sos_contact1: contact1, sos_contact2: contact2 })
    .eq('id', userId)
  return error ? { error: error.message } : {}
}

const demoRides: Ride[] = [
  {
    id: 'r1',
    customer_id: 'demo-user',
    driver_id: 'd1',
    service_id: 'amjad',
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
    service_id: 'ladies',
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

// ---------- الأدمن: قوائم مستقلة ----------
export interface AdminDriverRow extends Driver {
  users?: { full_name: string | null; phone: string } | null
}

const demoAdminDrivers: AdminDriverRow[] = [
  {
    id: 'd1',
    user_id: 'u1',
    vehicle_type: 'amjad',
    plate_number: 'خ ط م ١٢٣٤',
    is_online: true,
    rating: 4.9,
    created_at: new Date().toISOString(),
    users: { full_name: 'عثمان الطيب', phone: '+249900000001' },
  },
  {
    id: 'd2',
    user_id: 'u2',
    vehicle_type: 'hiace',
    plate_number: 'خ ط م ٥٦٧٨',
    is_online: false,
    rating: 4.7,
    created_at: new Date().toISOString(),
    users: { full_name: 'مريم عبدالله', phone: '+249900000002' },
  },
]

export async function listAllDrivers(): Promise<AdminDriverRow[]> {
  if (!isSupabaseConfigured) return demoAdminDrivers
  const { data } = await supabase
    .from('drivers')
    .select('*, users(full_name, phone)')
    .order('is_online', { ascending: false })
  return (data as AdminDriverRow[]) ?? []
}

export async function listAllRides(limit = 50): Promise<Ride[]> {
  if (!isSupabaseConfigured) return demoRides
  const { data } = await supabase
    .from('rides')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

/** الرحلات النشطة (لخريطة النشاط المباشر في لوحة الأدمن). */
export async function listActiveRides(): Promise<Ride[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase
    .from('rides')
    .select('*')
    .in('status', ['searching', 'accepted', 'arrived', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(100)
  return data ?? []
}

/** حذف سائق (يزيل صف السائق ويعيد دور المستخدم لعميل) — عبر دالة أدمن آمنة. */
export async function deleteDriver(userId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('admin_delete_driver', { p_user: userId })
  return error ? { error: error.message } : {}
}

// ------------------------- الموظفون (صلاحيات اللوحة) -------------------------

/** صلاحياتي في لوحة الإدارة: أدمن (مالك) أم موظف بصلاحيات محدودة؟ */
export async function getMyAdminAccess(): Promise<AdminAccess> {
  // وضع المعاينة: وصول كامل لتجربة اللوحة.
  if (!isSupabaseConfigured)
    return { is_admin: true, perms: ['requests', 'drivers', 'rides', 'settings'] }
  const { data } = await supabase.rpc('my_admin_access')
  const row = data?.[0]
  return {
    is_admin: Boolean(row?.is_admin),
    perms: (row?.perms ?? []) as StaffPerm[],
  }
}

/** قائمة الموظفين مع أسمائهم وهواتفهم (للمالك فقط). */
export async function listStaff(): Promise<StaffRow[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase
    .from('staff')
    .select('*, users(full_name, phone)')
    .order('created_at', { ascending: false })
  return (data as StaffRow[]) ?? []
}

/** إضافة/تعديل موظف برقم هاتفه وصلاحياته (للمالك فقط). */
export async function setStaff(
  phone: string,
  perms: StaffPerm[],
): Promise<{ message?: string; error?: string }> {
  if (!isSupabaseConfigured) return { message: 'تم ✓ (معاينة)' }
  const { data, error } = await supabase.rpc('admin_set_staff', {
    p_phone: phone,
    p_perms: perms,
  })
  if (error) return { error: error.message }
  return { message: (data as string) ?? 'تم ✓' }
}

/** إزالة موظف (للمالك فقط). */
export async function removeStaff(userId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('admin_remove_staff', { p_user: userId })
  return error ? { error: error.message } : {}
}

/** تفعيل/تعطيل موظف مؤقّتاً (للمالك فقط). */
export async function setStaffActive(
  userId: string,
  active: boolean,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('admin_set_staff_active', {
    p_user: userId,
    p_active: active,
  })
  return error ? { error: error.message } : {}
}

/** سجلّ النشاط (أحدث الأحداث). */
export async function listAuditLog(limit = 100) {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export interface FinancialSummary {
  platform_commission: number
  total_topups: number
  ride_payments: number
  driver_earnings: number
  completed_rides: number
  wallet_liability: number
}

export async function getFinancialSummary(): Promise<FinancialSummary | null> {
  if (!isSupabaseConfigured)
    return {
      platform_commission: 184500,
      total_topups: 640000,
      ride_payments: 210300,
      driver_earnings: 1230000,
      completed_rides: 342,
      wallet_liability: 418200,
    }
  const { data } = await supabase.rpc('admin_financial_summary')
  return (Array.isArray(data) ? data[0] : data) ?? null
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
  vehicle_type: 'amjad',
  plate_number: 'خ ط م ١٢٣٤',
  is_online: false,
  rating: 4.9,
  created_at: new Date().toISOString(),
}

export async function getDriver(userId: string): Promise<Driver | null> {
  if (!isSupabaseConfigured) return demoDriver
  const { data } = await supabase.from('drivers').select('*').eq('user_id', userId).maybeSingle()
  return data ?? null
}

// ============================================================
//  طلبات الانضمام كسائق (KYC + وثائق + اعتماد)
// ============================================================
const DRIVER_DOCS_BUCKET = 'driver-docs'

/** نوع الوثيقة/الصورة — يُستخدم اسماً منطقياً في مسار الملف. */
export type DriverDocKind =
  | 'driving_license'
  | 'vehicle_license'
  | 'rental_contract'
  | 'transport_permit'
  | 'photo_front'
  | 'photo_back'
  | 'photo_side'
  | 'photo_interior'

/** يرفع وثيقة/صورة سائق إلى مجلد المستخدم ويرجّع مسارها داخل الـ bucket. */
export async function uploadDriverDoc(
  userId: string,
  kind: DriverDocKind,
  file: File,
): Promise<{ path?: string; error?: string }> {
  if (!isSupabaseConfigured) return { path: `demo/${kind}` }
  const ext = file.name.split('.').pop()?.replace(/[^\w]+/g, '') || 'bin'
  const path = `${userId}/${kind}-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from(DRIVER_DOCS_BUCKET)
    .upload(path, file, { upsert: true })
  return error ? { error: error.message } : { path }
}

/** رابط موقّع مؤقت لعرض وثيقة السائق (الـ bucket خاص). */
export async function getDriverDocUrl(path: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.storage.from(DRIVER_DOCS_BUCKET).createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

export type DriverApplicationInput = Omit<
  DriverApplication,
  'id' | 'status' | 'review_note' | 'reviewed_by' | 'created_at' | 'updated_at'
>

/** يُنشئ طلب انضمام سائق (حالته pending حتى يعتمده الأدمن). */
export async function submitDriverApplication(
  input: DriverApplicationInput,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase
    .from('driver_applications')
    .insert({ ...input, status: 'pending' })
  return error ? { error: error.message } : {}
}

/** آخر طلب انضمام للمستخدم الحالي (لعرض حالته: قيد المراجعة/مرفوض/معتمد). */
export async function getMyDriverApplication(
  userId: string,
): Promise<DriverApplication | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase
    .from('driver_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

// ---------- الأدمن: مراجعة الطلبات ----------
export async function listDriverApplications(
  status: DriverAppStatus = 'pending',
): Promise<DriverApplication[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase
    .from('driver_applications')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function approveDriverApplication(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('approve_driver_application', { p_app: id })
  return error ? { error: error.message } : {}
}

export async function rejectDriverApplication(
  id: string,
  note?: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('reject_driver_application', {
    p_app: id,
    p_note: note ?? null,
  })
  return error ? { error: error.message } : {}
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
  service_id: 'open',
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

/** رحلة السائق الجارية (لاسترجاع شاشة الرحلة بعد تحديث الصفحة). */
export async function getActiveDriverRide(driverUserId: string): Promise<Ride | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase
    .from('rides')
    .select('*')
    .eq('driver_id', driverUserId)
    .in('status', ['accepted', 'arrived', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

/** تقدّم الرحلة: السائق يعلّم الوصول (arrived) أو بدء الرحلة (in_progress). */
export async function setRideStatus(
  rideId: string,
  status: 'arrived' | 'in_progress',
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('set_ride_status', { p_ride: rideId, p_status: status })
  return error ? { error: error.message } : {}
}

/**
 * إلغاء الرحلة عبر دالة آمنة:
 *   • العميل → cancelled، • السائق → تعود searching بلا سائق.
 */
export async function cancelRide(rideId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('cancel_ride', { p_ride: rideId })
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
