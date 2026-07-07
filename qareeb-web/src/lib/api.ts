import { supabase, isSupabaseConfigured } from './supabase'
import type { Settings, Wallet, Transaction, Ride } from './types'

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
export async function createTopup(
  walletId: string,
  amount: number,
  proofUrl: string | null,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return {}
  const { error } = await supabase
    .from('topups')
    .insert({ wallet_id: walletId, amount, proof_url: proofUrl, status: 'pending' })
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

export async function listRides(customerId: string): Promise<Ride[]> {
  if (!isSupabaseConfigured) return []
  const { data } = await supabase
    .from('rides')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  return data ?? []
}
