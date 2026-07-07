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

export interface NewCommuteInput {
  service_id: string
  dest: Place
  scheduled_time: string
  days: string[]
  round_trip: boolean
  organizer: { name: string; home: Place }
}

export interface JoinInput {
  name: string
  home: Place
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
      days: input.days,
      round_trip: input.round_trip,
      invite_code: invite(),
      status: 'forming',
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
      days: input.days,
      round_trip: input.round_trip,
    })
    .select('*')
    .single()
  if (error || !order) throw new Error(error?.message ?? 'تعذّر إنشاء الطلب')

  await supabase.from('commute_members').insert({
    order_id: order.id,
    name: input.organizer.name,
    home_lat: input.organizer.home.lat,
    home_lng: input.organizer.home.lng,
    home_address: input.organizer.home.address,
    is_organizer: true,
  })
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
  const { data } = await supabase
    .from('commute_orders')
    .select('*')
    .eq('invite_code', code)
    .single()
  return (data as CommuteOrder) ?? null
}

export async function listCommuteMembers(orderId: string): Promise<CommuteMember[]> {
  if (!isSupabaseConfigured)
    return lsGet<CommuteMember>(LS_MEMBERS)
      .filter((m) => m.order_id === orderId)
      .sort((a, b) => Number(b.is_organizer) - Number(a.is_organizer))
  const { data } = await supabase
    .from('commute_members')
    .select('*')
    .eq('order_id', orderId)
    .order('is_organizer', { ascending: false })
  return (data as CommuteMember[]) ?? []
}

// ------------------------------- الانضمام -------------------------------
export async function joinCommuteOrder(
  orderId: string,
  input: JoinInput,
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
      created_at: new Date().toISOString(),
    }
    lsSet(LS_MEMBERS, [...lsGet<CommuteMember>(LS_MEMBERS), member])
    return {}
  }
  const { error } = await supabase.from('commute_members').insert({
    order_id: orderId,
    name: input.name,
    home_lat: input.home.lat,
    home_lng: input.home.lng,
    home_address: input.home.address,
    is_organizer: false,
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

/** طلبات الترحيل المُرسَلة (لواجهة السائق). */
export async function listDispatchedCommutes(): Promise<CommuteOrder[]> {
  if (!isSupabaseConfigured)
    return lsGet<CommuteOrder>(LS_ORDERS).filter((o) => o.status === 'dispatched')
  const { data } = await supabase
    .from('commute_orders')
    .select('*')
    .eq('status', 'dispatched')
    .order('created_at', { ascending: false })
  return (data as CommuteOrder[]) ?? []
}

/** رابط الدعوة الكامل. */
export const inviteLink = (code: string) =>
  `${window.location.origin}/commute/join/${code}`
