/**
 * أنواع قاعدة البيانات — تعكس supabase/schema.sql.
 * يمكن استبدالها لاحقاً بالأنواع المولّدة تلقائياً عبر:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/types.ts
 */

export type PaymentMethod = 'cash' | 'bank_transfer' | 'wallet'

export type RideStatus =
  | 'requested'
  | 'searching'
  | 'accepted'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type TransactionType = 'topup' | 'ride_payment' | 'ride_earning' | 'commission'

export type TopupStatus = 'pending' | 'approved' | 'rejected'

export interface AppUser {
  id: string
  phone: string
  full_name: string | null
  role: 'customer' | 'driver' | 'admin'
  created_at: string
}

export interface Driver {
  id: string
  user_id: string
  vehicle_type: string
  plate_number: string | null
  is_online: boolean
  rating: number | null
  created_at: string
}

export interface Ride {
  id: string
  customer_id: string
  driver_id: string | null
  service_id: string
  status: RideStatus
  pickup_lat: number
  pickup_lng: number
  pickup_address: string | null
  dropoff_lat: number | null
  dropoff_lng: number | null
  dropoff_address: string | null
  fare: number | null
  driver_lat?: number | null // آخر موقع مباشر للسائق (تتبع)
  driver_lng?: number | null
  driver_loc_at?: string | null
  payment_method: PaymentMethod
  rating: number | null
  created_at: string
}

export interface Wallet {
  id: string
  user_id: string
  balance: number
  updated_at: string
}

export interface Transaction {
  id: string
  wallet_id: string
  type: TransactionType
  amount: number
  ride_id: string | null
  note: string | null
  created_at: string
}

export interface Topup {
  id: string
  wallet_id: string
  amount: number
  proof_url: string | null
  status: TopupStatus
  reviewed_by: string | null
  created_at: string
}

export interface Settings {
  id: number
  commission_rate: number // 0..1 مثال 0.15
  surge_multiplier: number // معامل التسعير الديناميكي، مثال 1.0 / 1.2 / 1.5
  tier1_max_km: number // نهاية شريحة فتح العداد (كم) — افتراضي 2
  tier2_max_km: number // نهاية الشريحة الحضرية (كم) — افتراضي 10
  bank_name: string | null
  bank_account_name: string | null
  bank_account_number: string | null
  updated_at: string
}

/** تسعيرة نوع مركبة واحد — تُدار من لوحة الأدمن. */
export interface ServicePricing {
  service_id: string
  name: string
  base_fare: number // أجرة فتح العداد (تغطي حتى tier1_max_km)
  per_km_urban: number // سعر الكيلومتر في الشريحة الحضرية (tier1..tier2)
  per_km_far: number // سعر الكيلومتر التعويضي (> tier2)
  per_minute: number // سعر الدقيقة
  sort_order: number
  active: boolean
  updated_at: string
}

// ---------- الطوارئ (SOS) ----------
export type SosRole = 'customer' | 'driver'
export type SosStatus = 'open' | 'resolved'

/** تنبيه طوارئ من راكب أو سائق أثناء رحلة — يظهر للأدمن لحظياً. */
export interface SosAlert {
  id: string
  ride_id: string | null
  user_id: string
  role: SosRole
  lat: number | null
  lng: number | null
  note: string | null
  status: SosStatus
  created_at: string
}

// ---------- ترحيل (المشاركة اليومية) ----------
export type CommuteStatus = 'forming' | 'dispatched' | 'active' | 'cancelled'

/** طلب ترحيل: وجهة مشتركة (العمل) + وقت + أيام، ينضمّ إليه أعضاء كلٌّ بمنزله. */
export interface CommuteOrder {
  id: string
  organizer_id: string | null
  service_id: string
  dest_lat: number
  dest_lng: number
  dest_address: string | null // مكان العمل
  scheduled_time: string // "HH:MM"
  days: string[]
  round_trip: boolean
  invite_code: string
  status: CommuteStatus
  created_at: string
}

/** عضو في طلب ترحيل — نقطة انطلاقه (منزله). */
export interface CommuteMember {
  id: string
  order_id: string
  name: string
  home_lat: number
  home_lng: number
  home_address: string | null
  is_organizer: boolean
  created_at: string
}

// نوع Database مبسّط لعميل supabase-js. وسّعه عند الحاجة.
export interface Database {
  public: {
    Tables: {
      users: { Row: AppUser; Insert: Partial<AppUser>; Update: Partial<AppUser> }
      drivers: { Row: Driver; Insert: Partial<Driver>; Update: Partial<Driver> }
      rides: { Row: Ride; Insert: Partial<Ride>; Update: Partial<Ride> }
      wallets: { Row: Wallet; Insert: Partial<Wallet>; Update: Partial<Wallet> }
      transactions: {
        Row: Transaction
        Insert: Partial<Transaction>
        Update: Partial<Transaction>
      }
      topups: { Row: Topup; Insert: Partial<Topup>; Update: Partial<Topup> }
      settings: { Row: Settings; Insert: Partial<Settings>; Update: Partial<Settings> }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
