import { supabase, isSupabaseConfigured } from './supabase'
import type { CommuteOrder, CommuteMember } from './types'

/**
 * طلبات "ترحيل" (المشاركة اليومية).
 * في وضع المعاينة (بدون Supabase) تُخزَّن في localStorage حتى يعمل تدفّق
 * (إنشاء → مشاركة الرابط → انضمام → عرض) بالكامل بدون backend.
 */

export interface Place {
  lat: number
  lng: number
  address: string
}

export type CommutePlan = 'daily' | 'monthly'
export type CommutePayMethod = 'cash' | 'wallet'

export interface NewCommuteInput {
  service_id: string
  dest: Place
  scheduled_time: string
  return_time: string | null
  days: string[]
  round_trip: boolean
  plan: CommutePlan
  organizer: { name: string; home: Place; fare: number; pay_method: CommutePayMethod }
}

export interface JoinInput {
  name: string
  home: Place
  fare: number
  pay_method: CommutePayMethod
}

// ------------------------- مخزن المعاينة (localStorage) -------------------------
const LS_ORDERS = 'qareeb.commute.orders'
const LS_MEMBERS = 'qareeb.commute.members'

function lsGet<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}
function lsSet<T>(key: string, val: T[]) {
  localStorage.setItem(key, JSON.stringify(val))
}
const rid = () => Math.random().toString(36).slice(2, 10)
const invite = () => Math.random().toString(36).slice(2, 8)

// ------------------------------- الإنشاء -------------------------------
export async function createCommuteOrder(
  input: NewCommuteInput,
  organizerId: string | null,
): Promise<CommuteOrder> {
  if (!isSupabaseConfigured) {
    const order: CommuteOrder = {
      id: rid(),
      organizer_id: organizerId,
      service_id: input.service_id,
      dest_lat: input.dest.lat,
      dest_lng: input.dest.lng,
      dest_address: input.dest.address,
      scheduled_time: input.scheduled_time,
      return_time: input.return_time,
      days: input.days,
      round_trip: input.round_trip,
      plan: input.plan,
      invite_code: invite(),
      status: 'forming',
      driver_id: null,
      created_at: new Date().toISOString(),
    }
    lsSet(LS_ORDERS, [...lsGet<CommuteOrder>(LS_ORDERS), order])
    const member: CommuteMember = {
      id: rid(),
      order_id: order.id,
      name: input.organizer.name,
      home_lat: input.organizer.home.lat,
      home_lng: input.organizer.home.lng,
      home_address: input.organizer.home.address,
      is_organizer: true,
      fare: input.organizer.fare,
      pay_method: input.plan === 'monthly' ? 'wallet' : input.organizer.pay_method,
      created_at: new Date().toISOString(),
    }
    lsSet(LS_MEMBERS, [...lsGet<CommuteMember>(LS_MEMBERS), member])
    return order
  }

  const { data: order, error } = await supabase
    .from('commute_orders')
    .insert({
      organizer_id: organizerId,
      service_id: input.service_id,
      dest_lat: input.dest.lat,
      dest_lng: input.dest.lng,
      dest_address: input.dest.address,
      scheduled_time: input.scheduled_time,
      return_time: input.return_time,
      days: input.days,
      round_trip: input.round_trip,
      plan: input.plan,
    })
    .select('*')
    .single()
  if (error || !order) throw new Error(error?.message ?? 'تعذّر إنشاء الطلب')

  // المنظّم عضو أيضاً: يومي → إدراج مباشر؛ شهري → دفع مقدّم عبر دالة آمنة.
  const org = input.organizer
  const home = { ...org.home }
  if (input.plan === 'monthly') {
    const { error: mErr } = await supabase.rpc('commute_join_monthly', {
      p_order: order.id, p_name: org.name, p_home_lat: home.lat, p_home_lng: home.lng,
      p_home_addr: home.address, p_fare: org.fare, p_organizer: true,
    })
    if (mErr) throw new Error(mErr.message)
  } else {
    // يومي → عبر الدالّة الآمنة (p_organizer) بدل الإدراج المباشر الملغى.
    const { error: iErr } = await supabase.rpc('commute_join_daily', {
      p_order: order.id, p_name: org.name,
      p_home_lat: home.lat, p_home_lng: home.lng, p_home_addr: home.address,
      p_fare: org.fare, p_pay_method: org.pay_method, p_organizer: true,
    })
    if (iErr) throw new Error(iErr.message)
  }
  return order as CommuteOrder
}

// ------------------------------- الجلب -------------------------------
export async function getCommuteOrder(id: string): Promise<CommuteOrder | null> {
  if (!isSupabaseConfigured)
    return lsGet<CommuteOrder>(LS_ORDERS).find((o) => o.id === id) ?? null
  const { data } = await supabase.from('commute_orders').select('*').eq('id', id).single()
  return (data as CommuteOrder) ?? null
}

export async function getCommuteOrderByCode(code: string): Promise<CommuteOrder | null> {
  if (!isSupabaseConfigured)
    return lsGet<CommuteOrder>(LS_ORDERS).find((o) => o.invite_code === code) ?? null
  // عبر دالة آمنة — الطلبات لم تعد قابلة للقراءة المباشرة لغير المشاركين.
  const { data } = await supabase.rpc('commute_order_by_code', { p_code: code })
  const row = Array.isArray(data) ? data[0] : data
  return (row as CommuteOrder) ?? null
}

export async function listCommuteMembers(orderId: string): Promise<CommuteMember[]> {
  if (!isSupabaseConfigured)
    return lsGet<CommuteMember>(LS_MEMBERS)
      .filter((m) => m.order_id === orderId)
      .sort((a, b) => Number(b.is_organizer) - Number(a.is_organizer))
  // عبر دالة آمنة — تُرجع الأعضاء للمصرّح لهم فقط (منظّم/سائق/عضو/طاقم).
  const { data } = await supabase.rpc('commute_members_of', { p_order: orderId })
  return (data as CommuteMember[]) ?? []
}

/** عدد أعضاء الطلب (لفحص السعة قبل الانضمام) — بلا كشف تفاصيلهم. */
export async function commuteMemberCount(orderId: string): Promise<number> {
  if (!isSupabaseConfigured)
    return lsGet<CommuteMember>(LS_MEMBERS).filter((m) => m.order_id === orderId).length
  const { data } = await supabase.rpc('commute_order_member_count', { p_order: orderId })
  return typeof data === 'number' ? data : 0
}

// ------------------------------- الانضمام -------------------------------
export async function joinCommuteOrder(
  orderId: string,
  input: JoinInput,
  plan: CommutePlan = 'daily',
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) {
    const member: CommuteMember = {
      id: rid(),
      order_id: orderId,
      name: input.name,
      home_lat: input.home.lat,
      home_lng: input.home.lng,
      home_address: input.home.address,
      is_organizer: false,
      fare: input.fare,
      pay_method: plan === 'monthly' ? 'wallet' : input.pay_method,
      created_at: new Date().toISOString(),
    }
    lsSet(LS_MEMBERS, [...lsGet<CommuteMember>(LS_MEMBERS), member])
    return {}
  }
  // شهري → دفع مقدّم من المحفظة عبر دالة آمنة؛ يومي → إدراج (يُحصَّل يوماً بيوم).
  if (plan === 'monthly') {
    const { error } = await supabase.rpc('commute_join_monthly', {
      p_order: orderId, p_name: input.name, p_home_lat: input.home.lat, p_home_lng: input.home.lng,
      p_home_addr: input.home.address, p_fare: input.fare, p_organizer: false,
    })
    return error ? { error: error.message } : {}
  }
  // يومي → دالّة آمنة تفرض سعة المقاعد وتمنع سباق الانضمام (بدل إدراج مباشر).
  const { error } = await supabase.rpc('commute_join_daily', {
    p_order: orderId,
    p_name: input.name,
    p_home_lat: input.home.lat,
    p_home_lng: input.home.lng,
    p_home_addr: input.home.address,
    p_fare: input.fare,
    p_pay_method: input.pay_method,
  })
  return error ? { error: error.message } : {}
}

// ------------------------------- الإرسال للسائق -------------------------------
export async function dispatchCommuteOrder(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) {
    const orders = lsGet<CommuteOrder>(LS_ORDERS).map((o) =>
      o.id === id ? { ...o, status: 'dispatched' as const } : o,
    )
    lsSet(LS_ORDERS, orders)
    return {}
  }
  const { error } = await supabase
    .from('commute_orders')
    .update({ status: 'dispatched' })
    .eq('id', id)
  return error ? { error: error.message } : {}
}

/** السائق يقبل طلب ترحيل مُرسَلاً (dispatched → active) ويعيّن نفسه سائقاً. */
export async function acceptCommuteOrder(
  orderId: string,
  driverId: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) {
    const orders = lsGet<CommuteOrder>(LS_ORDERS).map((o) =>
      o.id === orderId ? { ...o, status: 'active' as const, driver_id: driverId } : o,
    )
    lsSet(LS_ORDERS, orders)
    return {}
  }
  // عبر دالة آمنة ذرّية (dispatched → active، السائق = المتصل).
  const { error } = await supabase.rpc('accept_commute_order', { p_order: orderId })
  return error ? { error: error.message } : {}
}

/** طلبات الترحيل المُرسَلة (المتاحة للقبول — لواجهة السائق). */
export async function listDispatchedCommutes(): Promise<CommuteOrder[]> {
  if (!isSupabaseConfigured)
    return lsGet<CommuteOrder>(LS_ORDERS).filter((o) => o.status === 'dispatched')
  // عبر دالة آمنة — الطلبات لم تعد قابلة للقراءة المباشرة لغير المشاركين.
  const { data } = await supabase.rpc('list_dispatched_commutes')
  return (data as CommuteOrder[]) ?? []
}

/** السائق يؤكّد «تم ترحيل اليوم» فيُحصَّل يوم كل راكب (مرّة واحدة/يوم). */
export async function settleCommuteDay(
  orderId: string,
): Promise<{
  result?: { wallet_paid: number; cash: number; fallback_cash: number }
  error?: string
}> {
  if (!isSupabaseConfigured) return { result: { wallet_paid: 0, cash: 0, fallback_cash: 0 } }
  const { data, error } = await supabase.rpc('commute_settle_day', { p_order: orderId })
  if (error) return { error: error.message }
  return { result: data as { wallet_paid: number; cash: number; fallback_cash: number } }
}

/** رحلات الترحيل التي قبِلها السائق (active) — لواجهته. */
export async function listDriverCommutes(driverId: string): Promise<CommuteOrder[]> {
  if (!isSupabaseConfigured)
    return lsGet<CommuteOrder>(LS_ORDERS).filter(
      (o) => o.status === 'active' && o.driver_id === driverId,
    )
  const { data } = await supabase
    .from('commute_orders')
    .select('*')
    .eq('driver_id', driverId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  return (data as CommuteOrder[]) ?? []
}

/**
 * رابط ويب عام للدعوة — يعمل فقط عند ضبط VITE_PUBLIC_URL بعنوان تطبيق الويب
 * المنشور. داخل تطبيق Capacitor يكون origin = https://localhost (رابط لا يعمل
 * على أجهزة أخرى)، لذا نُرجع '' في هذه الحالة ونعتمد رمز الدعوة بدلاً منه.
 */
const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/$/, '')

export function inviteLink(code: string): string {
  const base =
    PUBLIC_URL && /^https?:\/\//.test(PUBLIC_URL) && !/localhost/.test(PUBLIC_URL)
      ? PUBLIC_URL
      : typeof window !== 'undefined' && !/localhost/.test(window.location.origin)
        ? window.location.origin
        : ''
  return base ? `${base}/commute/join/${code}` : ''
}

/** نصّ مشاركة الدعوة — يعتمد الرمز دائماً، ويضيف الرابط إن توفّر عنوان عام. */
export function inviteShareText(code: string): string {
  const link = inviteLink(code)
  return (
    `انضم لمشوار الترحيل اليومي في «قريب» 🚗\n` +
    `رمز الدعوة: ${code}\n` +
    `افتح تطبيق قريب ← ترحيل ← «انضمام برمز» ← أدخل الرمز.` +
    (link ? `\nأو افتح الرابط: ${link}` : '')
  )
}
