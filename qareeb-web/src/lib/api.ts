import { supabase, isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from './supabase'
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
  TrackedRide,
  ServiceState,
  RideStatus,
  PaymentMethod,
  PromoCode,
  VipRequest,
  Withdrawal,
  ScheduledRide,
  RideMessage,
  DriverIncentive,
  MyIncentive,
} from './types'
import { services as seedServices, type Service, type VehicleArt } from '@/data/services'

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
  vip_subscription_fee: 15000,
  cancellation_fee: 1000,
  cancellation_far_km: 5,
  cancellation_far_min: 15,
  min_driver_balance: 0,
  referral_reward: 0,
  loyalty_per_ride: 0,
  loyalty_point_value: 0,
  auto_surge_enabled: false,
  auto_surge_max: 2.0,
  updated_at: new Date().toISOString(),
}

export async function getSettings(): Promise<Settings> {
  if (!isSupabaseConfigured) return demoSettings
  const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single()
  return error || !data ? demoSettings : data
}

// ---------- تسعير المركبات ----------
const demoPricing: ServicePricing[] = [
  { service_id: 'standard', name: 'قريب عادي', base_fare: 600, per_km_urban: 130, per_km_far: 160, per_minute: 18, commission_rate: null, sort_order: 0, active: true, updated_at: '' },
  { service_id: 'ladies', name: 'قريب نسائي', base_fare: 900, per_km_urban: 180, per_km_far: 220, per_minute: 25, commission_rate: null, sort_order: 1, active: true, updated_at: '' },
  { service_id: 'amjad', name: 'أمجاد', base_fare: 800, per_km_urban: 160, per_km_far: 200, per_minute: 22, commission_rate: null, sort_order: 2, active: true, updated_at: '' },
  { service_id: 'hiace', name: 'هايس', base_fare: 1200, per_km_urban: 200, per_km_far: 240, per_minute: 30, commission_rate: null, sort_order: 3, active: true, updated_at: '' },
  { service_id: 'rickshaw', name: 'ركشة', base_fare: 300, per_km_urban: 90, per_km_far: 110, per_minute: 12, commission_rate: null, sort_order: 4, active: true, updated_at: '' },
  { service_id: 'open', name: 'مشوار مفتوح', base_fare: 700, per_km_urban: 150, per_km_far: 190, per_minute: 20, commission_rate: null, sort_order: 5, active: true, updated_at: '' },
  { service_id: 'tow', name: 'سحاب', base_fare: 2500, per_km_urban: 300, per_km_far: 350, per_minute: 40, commission_rate: null, sort_order: 6, active: true, updated_at: '' },
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

// ---------- التسعير حسب الفترة الزمنية ----------
export interface ServicePeriod {
  service_id: string
  period: 'morning' | 'afternoon' | 'evening' | 'night'
  base_fare: number
  per_km: number
  per_min: number
  min_fare: number
}

/** كل صفوف التسعير حسب الفترات (لكل الخدمات والفترات). */
export async function listServicePeriods(): Promise<ServicePeriod[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase.from('service_pricing_periods').select('*')
  return (data as ServicePeriod[]) ?? []
}

/** تعديل/إضافة صفّ تسعير لفترة (أدمن — صلاحية settings). */
export async function upsertServicePeriod(
  row: ServicePeriod,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase
    .from('service_pricing_periods')
    .upsert({ ...row, updated_at: new Date().toISOString() })
  return error ? { error: error.message } : {}
}

// ---------- الخدمات الديناميكية (حالات + إضافة مركبة من اللوحة) ----------
const ALLOWED_ART = ['sedan', 'ladies', 'van', 'microbus', 'rickshaw', 'tow']

/** يحوّل صفّ service_pricing إلى كائن Service لعرضه في تطبيق العميل. */
function rowToService(p: ServicePricing): Service {
  const art = (p.art && ALLOWED_ART.includes(p.art) ? p.art : 'sedan') as VehicleArt
  return {
    id: p.service_id,
    name: p.name,
    tagline: p.tagline ?? '',
    image: `/vehicles/${p.service_id}.png`,
    imageUrl: p.image_url ?? undefined,
    art,
    tint: p.tint || '#EDEFEC',
    seats: p.seats ?? 4,
    noun: p.noun ?? 'المركبة',
    femaleDriver: p.female_driver ?? false,
    sharable: p.sharable ?? true,
    destinationOptional: p.destination_optional ?? false,
    state: p.state ?? 'available',
  }
}

/**
 * قائمة الخدمات جاهزة للعرض (Service[]) — تُبنى من جدول service_pricing.
 * تُستبعد غير النشطة (active=false) لكن تبقى المخفية ليتحكم بها الأدمن،
 * والفلترة النهائية للحالة تتم في طبقة العرض.
 */
export async function listServices(): Promise<Service[]> {
  if (!isSupabaseConfigured) return seedServices
  const { data } = await supabase
    .from('service_pricing')
    .select('*')
    .order('sort_order', { ascending: true })
  if (!data || !data.length) return seedServices
  return (data as ServicePricing[]).filter((p) => p.active !== false).map(rowToService)
}

/** يغيّر حالة الخدمة (available/maintenance/coming_soon/hidden). */
export async function setServiceState(
  serviceId: string,
  state: ServiceState,
): Promise<{ error?: string }> {
  return updateServicePricing(serviceId, { state })
}

/** ينشئ خدمة/مركبة جديدة من لوحة الأدمن (بلا تحديث للتطبيق). */
export async function createServicePricing(
  row: Partial<ServicePricing> & { service_id: string; name: string },
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase
    .from('service_pricing')
    .insert({ ...row, updated_at: new Date().toISOString() })
  return error ? { error: error.message } : {}
}

/** يحذف خدمة (يُفضّل استخدام الحالة «مخفي» بدل الحذف للحفاظ على السجلّات). */
export async function deleteServicePricing(serviceId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  // نحذف أيضاً صفوف تسعير الفترات لهذا النوع حتى لا تبقى يتيمة (وتُعاد إن أُعيد المعرّف).
  await supabase.from('service_pricing_periods').delete().eq('service_id', serviceId)
  const { error } = await supabase.from('service_pricing').delete().eq('service_id', serviceId)
  return error ? { error: error.message } : {}
}

/** يرفع صورة مركبة إلى مخزن vehicles ويعيد رابطها العام. */
export async function uploadVehicleImage(
  serviceId: string,
  file: File,
): Promise<{ url?: string; error?: string }> {
  if (!isSupabaseConfigured) return { error: 'قاعدة البيانات غير مضبوطة' }
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${serviceId}-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('vehicles')
    .upload(path, file, { upsert: true, contentType: file.type || 'image/png' })
  if (error) return { error: error.message }
  const { data } = supabase.storage.from('vehicles').getPublicUrl(path)
  return { url: data.publicUrl }
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
 * تقييم متبادل بعد الرحلة + شكوى اختيارية.
 * الدور (عميل يقيّم السائق / سائق يقيّم العميل) يُستنتج من الرحلة في الخادم.
 * لا يُنهي الرحلة ولا يسوّيها — التسوية عبر settleRide.
 */
export async function submitReview(
  rideId: string,
  stars: number,
  complaint?: string | null,
  mismatch?: { driver?: boolean; vehicle?: boolean },
  extra?: { tags?: string[]; comment?: string | null },
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('submit_review', {
    p_ride: rideId,
    p_stars: stars,
    p_complaint: complaint?.trim() || null,
    p_driver_mismatch: mismatch?.driver ?? false,
    p_vehicle_mismatch: mismatch?.vehicle ?? false,
    p_tags: extra?.tags?.length ? extra.tags : null,
    p_comment: extra?.comment?.trim() || null,
  })
  return error ? { error: error.message } : {}
}

/** قائمة رحلات الأدمن بتفاصيل الطرفين والمركبة (للسلطات) + أعلام المخالفة. */
export interface AdminRideRow {
  id: string
  status: RideStatus
  service_id: string
  fare: number | null
  payment_method: PaymentMethod
  prepaid: boolean
  created_at: string
  started_at: string | null
  completed_at: string | null
  rating: number | null
  complaint: string | null
  customer_name: string | null
  customer_phone: string | null
  driver_name: string | null
  driver_phone: string | null
  plate_number: string | null
  vehicle_type: string | null
  pickup_address: string | null
  dropoff_address: string | null
  pickup_lat: number | null
  pickup_lng: number | null
  dropoff_lat: number | null
  dropoff_lng: number | null
  driver_mismatch: boolean
  vehicle_mismatch: boolean
}

export async function adminListRides(limit = 100): Promise<AdminRideRow[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase.rpc('admin_list_rides', { p_limit: limit })
  return data ?? []
}

/** قائمة العملاء المسجّلين وتقييماتهم (للأدمن/الموظف). */
export async function listAdminCustomers() {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase.rpc('admin_list_customers')
  return data ?? []
}

/** قائمة الشكاوى (للأدمن/الموظف). */
export async function listComplaints() {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase.rpc('admin_list_complaints')
  return data ?? []
}

/** تعليم شكوى كمحلولة. */
export async function resolveComplaint(reviewId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('admin_resolve_complaint', { p_review: reviewId })
  return error ? { error: error.message } : {}
}

/** بيانات السائق المُسنَد لرحلة (اسم، تقييم، هاتف، مركبة) عبر دالة آمنة. */
export interface RideDriverInfo {
  full_name: string | null
  phone: string
  rating: number | null
  vehicle_type: string | null
  plate_number: string | null
  photo_url: string | null
  vehicle_photo_url: string | null
}

const demoRideDriver: RideDriverInfo = {
  full_name: 'عثمان الطيب',
  phone: '+249900000000',
  rating: 4.9,
  vehicle_type: 'amjad',
  plate_number: 'خ ط م ١٢٣٤',
  photo_url: null,
  vehicle_photo_url: null,
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

// ---------- مشاركة الرحلة المباشرة (تتبّع) ----------
/** يولّد/يعيد رمز مشاركة لرحلة (لطرفَيها) — يشاركه المستخدم مع متابِع. */
export async function ensureRideShare(rideId: string): Promise<string | null> {
  if (!isSupabaseConfigured || !rideId) return null
  const { data } = await supabase.rpc('ensure_ride_share', { p_ride: rideId })
  return (data as string | null) ?? null
}

/** يجلب لقطة تتبّع رحلة عبر الرمز (لأي متابِع). */
export async function trackSharedRide(token: string): Promise<TrackedRide | null> {
  if (!isSupabaseConfigured || !token) return null
  const { data } = await supabase.rpc('track_shared_ride', { p_token: token })
  const rows = (data as TrackedRide[] | null) ?? []
  return rows[0] ?? null
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

// ---------- رموز أجهزة FCM (إشعارات أصلية) ----------
/** يحفظ/يحدّث رمز جهاز FCM للمستخدم الحالي. */
export async function saveDeviceToken(
  userId: string,
  token: string,
  platform = 'android',
): Promise<void> {
  if (!isSupabaseConfigured) return
  await supabase
    .from('device_tokens')
    .upsert(
      { token, user_id: userId, platform, updated_at: new Date().toISOString() },
      { onConflict: 'token' },
    )
}

/** يحذف رمز جهاز (عند تسجيل الخروج أو إلغاء التسجيل). */
export async function deleteDeviceToken(token: string): Promise<void> {
  if (!isSupabaseConfigured) return
  await supabase.from('device_tokens').delete().eq('token', token)
}

/** يستدعي دالة FCM لإشعار السائقين المتصلين بطلب جديد (بعد إنشاء الرحلة). */
export async function notifyDriversOfRide(rideId: string): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    await supabase.functions.invoke('notify-ride-fcm', { body: { ride_id: rideId } })
  } catch {
    // إشعار أفضل جهد — لا يوقف تدفّق الطلب إن فشل.
  }
}

// استدعاء دالة الإشعار عبر fetch مباشر بمفتاح anon — يضمن ترويسة Authorization
// (يتجاوز فحص «Verify JWT») بلا أي تجاوز من مكتبة supabase-js.
async function callNotifyUser(body: Record<string, string>): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    await fetch(`${supabaseUrl}/functions/v1/notify-user-fcm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    /* أفضل جهد — لا يوقف الاعتماد */
  }
}

/** يُشعر صاحب التعبئة باعتمادها (أفضل جهد). */
export async function notifyTopupApproved(topupId: string): Promise<void> {
  await callNotifyUser({ topup_id: topupId })
}

/** يُشعر السائق باعتماد سحبه (أفضل جهد). */
export async function notifyWithdrawalApproved(withdrawalId: string): Promise<void> {
  await callNotifyUser({ withdrawal_id: withdrawalId })
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
  // نجلب صاحب المحفظة (اسم/هاتف) ليتحقّق الأدمن من هوية المُعبِّئ قبل اعتماد المال.
  const { data } = await supabase
    .from('topups')
    .select('*, wallets ( users ( full_name, phone ) )')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return (data as Topup[]) ?? []
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

export interface DriverPerf {
  user_id: string
  name: string | null
  phone: string
  rating: number | null
  rides: number
  earnings: number
  cancels: number
}
/** أداء السائقين (أدمن): رحلات/تقييم/إيرادات/إلغاءات خلال مدّة. */
export async function getDriverPerformance(days = 30): Promise<DriverPerf[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase.rpc('admin_driver_performance', { p_days: days })
  return (data as DriverPerf[]) ?? []
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

// ------------------------- الحسابات الداخلية (HR) -------------------------

export async function listCompanyAccounts() {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase.from('company_accounts').select('*').order('created_at')
  return data ?? []
}
export async function addCompanyAccount(a: { name: string; bank?: string; number?: string; balance?: number }) {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.from('company_accounts').insert(a)
  return error ? { error: error.message } : {}
}
export async function deleteCompanyAccount(id: string) {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.from('company_accounts').delete().eq('id', id)
  return error ? { error: error.message } : {}
}

export async function listHrEmployees() {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase.from('hr_employees').select('*').order('created_at', { ascending: false })
  return data ?? []
}
export async function addHrEmployee(e: { name: string; role?: string; phone?: string; salary?: number }) {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.from('hr_employees').insert(e)
  return error ? { error: error.message } : {}
}
export async function deleteHrEmployee(id: string) {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.from('hr_employees').delete().eq('id', id)
  return error ? { error: error.message } : {}
}

export async function listExpenses(limit = 100) {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase
    .from('expenses')
    .select('*')
    .order('spent_at', { ascending: false })
    .limit(limit)
  return data ?? []
}
export async function addExpense(p: {
  category: string
  description?: string
  amount: number
  employee?: string | null
  account?: string | null
  date?: string | null
}) {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('add_expense', {
    p_category: p.category,
    p_description: p.description ?? null,
    p_amount: p.amount,
    p_employee: p.employee ?? null,
    p_account: p.account ?? null,
    p_date: p.date ?? null,
  })
  return error ? { error: error.message } : {}
}
export async function paySalaries(accountId: string | null, note?: string): Promise<{ total?: number; error?: string }> {
  if (!isSupabaseConfigured) return { total: 0 }
  const { data, error } = await supabase.rpc('pay_salaries', { p_account: accountId, p_note: note ?? null })
  return error ? { error: error.message } : { total: Number(data) }
}

/** تقرير الميزانية للفترة (شهري/سنوي). */
export async function getBudgetReport(scope: 'month' | 'year') {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase.rpc('budget_report', { p_scope: scope })
  return (data ?? []) as { category: string; percent: number; allocated: number; spent: number; income: number }[]
}

/** ضبط نسبة بند في الميزانية. */
export async function setBudget(category: string, percent: number) {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('set_budget', { p_category: category, p_percent: percent })
  return error ? { error: error.message } : {}
}

/** الصورة المالية: أمانات العملاء/السائقين + نصيبي (المتاح) + الاستدانة. */
export async function getCompanyFinance() {
  if (!isSupabaseConfigured)
    return { customer_float: 0, driver_float: 0, commission: 0, expenses: 0, borrowed: 0, treasury: 0 }
  const { data } = await supabase.rpc('company_finance')
  const r = data?.[0]
  return {
    customer_float: Number(r?.customer_float ?? 0),
    driver_float: Number(r?.driver_float ?? 0),
    commission: Number(r?.commission ?? 0),
    expenses: Number(r?.expenses ?? 0),
    borrowed: Number(r?.borrowed ?? 0),
    treasury: Number(r?.treasury ?? 0),
  }
}

export async function listLoans() {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase.from('loans').select('*').order('created_at', { ascending: false })
  return data ?? []
}
export async function borrowFromFloat(source: 'customer' | 'driver', amount: number, note?: string) {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('borrow_from_float', { p_source: source, p_amount: amount, p_note: note ?? null })
  return error ? { error: error.message } : {}
}
export async function repayLoan(id: string) {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('repay_loan', { p_id: id })
  return error ? { error: error.message } : {}
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

/** تجميعات لوحة الأدمن (بلا سقف صفوف). null → المعاينة/تعذّر (اللوحة تحسبها من العيّنة). */
export interface AdminAnalytics {
  completedCount: number
  revenue: number
  weekly: { d: string; value: number }[]
  weeklyRevenue: { d: string; value: number }[]
  vehicle: { service_id: string; value: number }[]
  vehicleRevenue: { service_id: string; value: number }[]
}

export async function getAdminAnalytics(): Promise<AdminAnalytics | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.rpc('admin_analytics')
  if (error || !data) return null
  return data as AdminAnalytics
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

/**
 * يرفع صورة عرض (صورة السائق أو المركبة) إلى bucket عام ويعيد رابطها المباشر —
 * تُعرَض للعميل عند قبول الرحلة (بعكس وثائق KYC الخاصّة).
 */
export async function uploadDriverPhoto(
  userId: string,
  kind: 'selfie' | 'vehicle',
  file: File,
): Promise<{ url?: string; error?: string }> {
  if (!isSupabaseConfigured) return { url: `demo/${kind}` }
  const ext = (file.name.split('.').pop() || 'jpg').replace(/[^\w]+/g, '') || 'jpg'
  const path = `${userId}/${kind}-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('driver-photos')
    .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })
  if (error) return { error: error.message }
  const { data } = supabase.storage.from('driver-photos').getPublicUrl(path)
  return { url: data.publicUrl }
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
  _driverId: string,
  online: boolean,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  // عبر دالة آمنة تفرض الحدّ الأدنى للرصيد عند الاتصال (يعمل على السائق الحالي).
  const { error } = await supabase.rpc('set_driver_online', { p_online: online })
  return error ? { error: error.message } : {}
}

/** يحدّث موقع السائق الحالي (أثناء الاتصال) لعرضه للعملاء القريبين. */
export async function updateMyLocation(lat: number, lng: number): Promise<void> {
  if (!isSupabaseConfigured) return
  await supabase.rpc('update_my_location', { p_lat: lat, p_lng: lng })
}

/** مضاعف الذروة الحالي (تلقائي حسب الطلب أو يدوي). */
export async function getCurrentSurge(): Promise<number> {
  if (!isSupabaseConfigured) return 1
  const { data } = await supabase.rpc('current_surge')
  const n = typeof data === 'number' ? data : Number(data)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

/** نقاط ولاء العميل الحالي + قيمة النقطة. */
export async function getMyLoyalty(): Promise<{ points: number; point_value: number }> {
  if (!isSupabaseConfigured) return { points: 0, point_value: 0 }
  const { data } = await supabase.rpc('my_loyalty')
  const row = (data as { points: number; point_value: number }[])?.[0]
  return { points: row?.points ?? 0, point_value: row?.point_value ?? 0 }
}

/** استبدال نقاط ولاء برصيد في المحفظة. */
export async function redeemLoyalty(points: number): Promise<{ amount?: number; error?: string }> {
  if (!isSupabaseConfigured) return { amount: 0 }
  const { data, error } = await supabase.rpc('redeem_loyalty', { p_points: points })
  if (error) return { error: error.message }
  return { amount: (data as { amount?: number })?.amount ?? 0 }
}

/** نقاط كثافة الطلب الأخيرة (لخريطة السائق الحرارية). */
export async function getDemandHotspots(hours = 3): Promise<{ lat: number; lng: number }[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase.rpc('demand_hotspots', { p_hours: hours })
  return (data as { lat: number; lng: number }[]) ?? []
}

/** سائقون متصلون قريبون (إحداثيات فقط) لعرضهم على خريطة العميل قبل الطلب. */
export async function nearbyOnlineDrivers(
  lat: number,
  lng: number,
  radiusKm = 6,
): Promise<{ lat: number; lng: number; vehicle_type: string }[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase.rpc('nearby_online_drivers', {
    p_lat: lat,
    p_lng: lng,
    p_radius_km: radiusKm,
  })
  return (data as { lat: number; lng: number; vehicle_type: string }[]) ?? []
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
  // RPC آمنة تُرفق اسم الراكب وتقييمه (للسائقين فقط).
  const { data } = await supabase.rpc('list_available_rides')
  return (data as Ride[]) ?? []
}

/** معلومات الراكب لرحلة السائق الجارية (اسم/هاتف/تقييم) — للاتصال والتحقّق. */
export async function getRideCustomer(
  rideId: string,
): Promise<{ full_name: string | null; phone: string | null; rating: number | null } | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.rpc('get_ride_customer', { p_ride: rideId })
  const row = Array.isArray(data) ? data[0] : data
  return row ?? null
}

/**
 * قبول الرحلة ذرّياً عبر RPC آمنة.
 *   • error → فشل حقيقي (شبكة/رحلة جارية).
 *   • taken → أُخذت من سائق آخر أو لم تعد متاحة (بلا خطأ).
 */
export async function acceptRide(rideId: string): Promise<{ error?: string; taken?: boolean }> {
  if (!isSupabaseConfigured) return {}
  const { data, error } = await supabase.rpc('accept_ride', { p_ride: rideId })
  if (error) return { error: error.message }
  if (data === false) return { taken: true }
  return {}
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
export interface CancelResult {
  fee: number // الرسوم المطبَّقة (0 إن مبرّر أو قبل القبول)
  charged: number // المخصوم فعلاً من المحفظة
  debt: number // ما تحوّل لدَيْن على الرحلة القادمة
  excused: boolean // هل اعتُبر الإلغاء مبرّراً؟
}

export async function cancelRide(
  rideId: string,
  reason?: string | null,
  reasonCode?: string | null,
): Promise<{ result?: CancelResult; error?: string }> {
  if (!isSupabaseConfigured) return { result: { fee: 0, charged: 0, debt: 0, excused: true } }
  const { data, error } = await supabase.rpc('cancel_ride', {
    p_ride: rideId,
    p_reason: reason?.trim() || null,
    p_reason_code: reasonCode ?? null,
  })
  if (error) return { error: error.message }
  return { result: (data as CancelResult) ?? { fee: 0, charged: 0, debt: 0, excused: true } }
}

// ---------- دعوة صديق (إحالة) ----------
/** رمز الإحالة للمستخدم الحالي (يولّده الخادم إن لم يوجد). */
export async function getMyReferralCode(): Promise<string | null> {
  if (!isSupabaseConfigured) return 'QAREEB'
  const { data } = await supabase.rpc('get_my_referral_code')
  return (data as string) ?? null
}

/** إدخال رمز دعوة صديق (مرّة واحدة). */
export async function applyReferralCode(code: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('apply_referral_code', { p_code: code })
  return error ? { error: error.message } : {}
}

// ---------- حوافز السائق ----------
/** حوافز السائق الحالي مع تقدّمه. */
export async function getMyIncentives(): Promise<MyIncentive[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase.rpc('my_incentives')
  return (data as MyIncentive[]) ?? []
}

/** أدمن: قائمة كل الحوافز (الفعّالة والمعطّلة). */
export async function listIncentives(): Promise<DriverIncentive[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase
    .from('driver_incentives')
    .select('*')
    .order('period', { ascending: true })
    .order('target_rides', { ascending: true })
  return (data as DriverIncentive[]) ?? []
}

/** أدمن: إضافة/تعديل حافز. */
export async function upsertIncentive(inc: {
  id?: string | null
  title: string
  period: 'daily' | 'weekly'
  target_rides: number
  reward: number
  active: boolean
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('admin_upsert_incentive', {
    p_id: inc.id ?? null,
    p_title: inc.title,
    p_period: inc.period,
    p_target: inc.target_rides,
    p_reward: inc.reward,
    p_active: inc.active,
  })
  return error ? { error: error.message } : {}
}

/** أدمن: حذف حافز. */
export async function deleteIncentive(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('admin_delete_incentive', { p_id: id })
  return error ? { error: error.message } : {}
}

// ---------- المحادثة داخل الرحلة ----------
/** رسائل رحلة محدّدة مرتّبة زمنياً. */
export async function listRideMessages(rideId: string): Promise<RideMessage[]> {
  if (!isSupabaseConfigured || !rideId) return []
  const { data } = await supabase
    .from('ride_messages')
    .select('*')
    .eq('ride_id', rideId)
    .order('created_at', { ascending: true })
  return (data as RideMessage[]) ?? []
}

/** إرسال رسالة داخل الرحلة (يحدّد الدور من طرف الرحلة). */
export async function sendRideMessage(
  rideId: string,
  senderId: string,
  role: 'customer' | 'driver',
  body: string,
): Promise<{ error?: string }> {
  const text = body.trim()
  if (!text) return { error: 'رسالة فارغة' }
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.from('ride_messages').insert({
    ride_id: rideId,
    sender_id: senderId,
    sender_role: role,
    body: text.slice(0, 500),
  })
  return error ? { error: error.message } : {}
}

// ---------- الرحلات المجدولة ----------
export async function createScheduledRide(params: {
  serviceId: string
  scheduledAt: string // ISO
  pickup: { lat: number; lng: number; address: string }
  dropoff: { lat: number; lng: number; address: string }
  payment: PaymentMethod
  fare: number
}): Promise<{ id?: string; error?: string }> {
  if (!isSupabaseConfigured) return { id: 'demo-scheduled' }
  const { data, error } = await supabase.rpc('create_scheduled_ride', {
    p_service: params.serviceId,
    p_scheduled_at: params.scheduledAt,
    p_pickup_lat: params.pickup.lat,
    p_pickup_lng: params.pickup.lng,
    p_pickup_address: params.pickup.address,
    p_dropoff_lat: params.dropoff.lat,
    p_dropoff_lng: params.dropoff.lng,
    p_dropoff_address: params.dropoff.address,
    p_payment: params.payment,
    p_fare: params.fare,
  })
  if (error) return { error: error.message }
  return { id: data as string }
}

export async function listScheduledRides(userId: string): Promise<ScheduledRide[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase
    .from('scheduled_rides')
    .select('*')
    .eq('customer_id', userId)
    .order('scheduled_at', { ascending: true })
  return (data as ScheduledRide[]) ?? []
}

export async function cancelScheduledRide(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('cancel_scheduled_ride', { p_id: id })
  return error ? { error: error.message } : {}
}

/** دَيْن رسوم الإلغاء المعلّق على العميل (يُضاف لأجرة الرحلة القادمة). */
export async function getCancellationDebt(userId: string): Promise<number> {
  if (!isSupabaseConfigured) return 0
  const { data } = await supabase
    .from('wallets')
    .select('cancellation_debt')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as { cancellation_debt?: number } | null)?.cancellation_debt ?? 0
}

/** تسوية الرحلة عند اكتمالها: يُقيَّد للسائق (الأجرة − العمولة) عبر دالة آمنة. */
export async function settleRide(rideId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('settle_ride', { p_ride: rideId })
  return error ? { error: error.message } : {}
}

/** الدفع المسبق بالمحفظة: يخصم الأجرة فوراً عند تأكيد رحلة «محفظة قريب». */
export async function prepayRide(rideId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('prepay_ride', { p_ride: rideId })
  return error ? { error: error.message } : {}
}

// ---------- البرومو كود + إعفاء العمولة + VIP ----------
export interface PromoResult {
  valid: boolean
  discount: number
  final: number
  message: string
}

/** يتحقّق من كود خصم ويعيد قيمة الخصم والسعر النهائي (بلا كشف الأكواد). */
export async function validatePromo(code: string, fare: number): Promise<PromoResult> {
  if (!isSupabaseConfigured) return { valid: false, discount: 0, final: fare, message: 'غير متاح' }
  const { data, error } = await supabase.rpc('validate_promo', { p_code: code, p_fare: fare })
  const row = Array.isArray(data) ? data[0] : data
  if (error || !row) return { valid: false, discount: 0, final: fare, message: 'تعذّر التحقّق' }
  return {
    valid: Boolean(row.valid),
    discount: Number(row.discount ?? 0),
    final: Number(row.final ?? fare),
    message: String(row.message ?? ''),
  }
}

/** قائمة أكواد الخصم (أدمن/موظف). */
export async function listPromos(): Promise<PromoCode[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false })
  return data ?? []
}

/** إنشاء/تعديل كود خصم (أدمن — صلاحية settings). */
export async function upsertPromo(promo: Partial<PromoCode> & { code: string }): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.from('promo_codes').upsert({ ...promo, code: promo.code.trim() })
  return error ? { error: error.message } : {}
}

/** حذف كود خصم. */
export async function deletePromo(code: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.from('promo_codes').delete().eq('code', code)
  return error ? { error: error.message } : {}
}

/** جعل سائق VIP (بلا عمولة — اشتراك) أو إلغاؤه. */
export async function setDriverVip(userId: string, vip: boolean): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('admin_set_driver_vip', { p_user: userId, p_vip: vip })
  return error ? { error: error.message } : {}
}

/** منح سائق إعفاء عمولة مؤقّت حتى تاريخ (null = إلغاء الإعفاء). */
export async function setDriverCommissionFree(
  userId: string,
  until: string | null,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('admin_set_driver_commission_free', {
    p_user: userId,
    p_until: until,
  })
  return error ? { error: error.message } : {}
}

/** تحصيل اشتراكات VIP المستحقّة الآن (أدمن) — يعيد عدد المدفوع والمتعذّر. */
export async function chargeVipSubscriptions(): Promise<{
  charged: number
  failed: number
  error?: string
}> {
  if (!isSupabaseConfigured) return { charged: 0, failed: 0 }
  const { data, error } = await supabase.rpc('charge_due_vip_subscriptions')
  if (error) return { charged: 0, failed: 0, error: error.message }
  const row = Array.isArray(data) ? data[0] : data
  return { charged: row?.charged ?? 0, failed: row?.failed ?? 0 }
}

// ---------- طلبات اشتراك VIP من السائق ----------
/** السائق يطلب VIP: دفع من المحفظة (فوري) أو تحويل بنكي بإيصال (اعتماد أدمن). */
export async function requestVip(
  method: 'wallet' | 'bank_transfer',
  proofPath: string | null = null,
): Promise<{ status?: 'approved' | 'pending'; error?: string }> {
  if (!isSupabaseConfigured) return { status: method === 'wallet' ? 'approved' : 'pending' }
  const { data, error } = await supabase.rpc('request_vip', {
    p_method: method,
    p_proof_url: proofPath,
  })
  if (error) return { error: error.message }
  return { status: (data as { status?: 'approved' | 'pending' })?.status }
}

/** أحدث طلب VIP للسائق (لعرض حالته: معلّق/معتمد/مرفوض). */
export async function getMyVipRequest(driverUserId: string): Promise<VipRequest | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase
    .from('vip_requests')
    .select('*')
    .eq('driver_id', driverUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as VipRequest) ?? null
}

/** طلبات VIP المعلّقة (أدمن) مع اسم/هاتف السائق. */
export async function listPendingVipRequests(): Promise<VipRequest[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase
    .from('vip_requests')
    .select('*, users:driver_id(full_name, phone)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return (data as VipRequest[]) ?? []
}

export async function approveVipRequest(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('approve_vip_request', { p_id: id })
  return error ? { error: error.message } : {}
}

export async function rejectVipRequest(
  id: string,
  note: string | null = null,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('reject_vip_request', { p_id: id, p_note: note })
  return error ? { error: error.message } : {}
}

// ---------- مدفوعات العملاء: سحب بنكي أو تحويل إلى الرصيد ----------
export interface DriverRideStats {
  today: number
  today_count: number
  today_net: number
  month: number
  total: number
  count: number
}

const EMPTY_DRIVER_STATS: DriverRideStats = {
  today: 0,
  today_count: 0,
  today_net: 0,
  month: 0,
  total: 0,
  count: 0,
}

/** إحصاء قيم مشاوير السائق (اليوم/الشهر/الكلي + عدد اليوم + صافي اليوم — يشمل الكاش). */
export async function getDriverRideStats(): Promise<DriverRideStats> {
  if (!isSupabaseConfigured) return EMPTY_DRIVER_STATS
  const { data } = await supabase.rpc('driver_ride_stats')
  return { ...EMPTY_DRIVER_STATS, ...((data as Partial<DriverRideStats>) ?? {}) }
}

/** طلب سحب بنكي من مدفوعات العملاء — يُخصم فوراً كحجز ويعتمده الأدمن. */
export async function requestWithdrawal(
  amount: number,
  destination: string | null = null,
): Promise<{ status?: 'pending'; error?: string }> {
  if (!isSupabaseConfigured) return { status: 'pending' }
  const { data, error } = await supabase.rpc('request_withdrawal', {
    p_amount: amount,
    p_method: 'bank_transfer',
    p_destination: destination,
  })
  if (error) return { error: error.message }
  return { status: (data as { status?: 'pending' })?.status }
}

/** تحويل مدفوعات العملاء إلى رصيد السائق (فوري، بلا اعتماد). */
export async function convertEarningsToBalance(amount: number): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('convert_earnings_to_balance', { p_amount: amount })
  return error ? { error: error.message } : {}
}

/** طلبات السحب الخاصّة بالسائق (لعرض حالتها). */
export async function getMyWithdrawals(driverUserId: string): Promise<Withdrawal[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase
    .from('withdrawals')
    .select('*')
    .eq('driver_id', driverUserId)
    .order('created_at', { ascending: false })
  return (data as Withdrawal[]) ?? []
}

/** طلبات السحب المعلّقة (أدمن) مع اسم/هاتف السائق. */
export async function listPendingWithdrawals(): Promise<Withdrawal[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase
    .from('withdrawals')
    .select('*, users:driver_id(full_name, phone)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return (data as Withdrawal[]) ?? []
}

export async function approveWithdrawal(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('approve_withdrawal', { p_id: id })
  return error ? { error: error.message } : {}
}

export async function rejectWithdrawal(
  id: string,
  note: string | null = null,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase.rpc('reject_withdrawal', { p_id: id, p_note: note })
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
