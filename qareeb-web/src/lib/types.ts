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
  driver_id: string | null // السائق الذي قبِل الطلب
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

// ---------- طلبات الانضمام كسائق (KYC) ----------
export type DriverAppStatus = 'pending' | 'approved' | 'rejected'

/** طلب انضمام سائق — بياناته ووثائقه وحالة اعتماده. */
export interface DriverApplication {
  id: string
  user_id: string
  full_name: string
  phone: string
  email: string | null
  vehicle_type: string
  plate_number: string
  is_rented: boolean
  residence: string | null
  driving_license_url: string | null
  vehicle_license_url: string | null
  rental_contract_url: string | null
  transport_permit_url: string | null
  photo_front_url: string | null
  photo_back_url: string | null
  photo_side_url: string | null
  photo_interior_url: string | null
  status: DriverAppStatus
  review_note: string | null
  reviewed_by: string | null
  created_at: string
  updated_at: string
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
      service_pricing: {
        Row: ServicePricing
        Insert: Partial<ServicePricing>
        Update: Partial<ServicePricing>
      }
      commute_orders: {
        Row: CommuteOrder
        Insert: Partial<CommuteOrder>
        Update: Partial<CommuteOrder>
      }
      commute_members: {
        Row: CommuteMember
        Insert: Partial<CommuteMember>
        Update: Partial<CommuteMember>
      }
      driver_applications: {
        Row: DriverApplication
        Insert: Partial<DriverApplication>
        Update: Partial<DriverApplication>
      }
    }
    Views: Record<string, never>
    Functions: {
      approve_topup: { Args: { p_topup: string }; Returns: undefined }
      reject_topup: { Args: { p_topup: string }; Returns: undefined }
      settle_ride: { Args: { p_ride: string }; Returns: undefined }
      set_ride_status: { Args: { p_ride: string; p_status: string }; Returns: undefined }
      approve_driver_application: { Args: { p_app: string }; Returns: undefined }
      reject_driver_application: {
        Args: { p_app: string; p_note?: string | null }
        Returns: undefined
      }
      admin_financial_summary: {
        Args: Record<string, never>
        Returns: {
          platform_commission: number
          total_topups: number
          ride_payments: number
          driver_earnings: number
          completed_rides: number
          wallet_liability: number
        }[]
      }
      get_ride_driver: {
        Args: { p_ride: string }
        Returns: {
          full_name: string | null
          phone: string
          rating: number | null
          vehicle_type: string | null
          plate_number: string | null
        }[]
      }
    }
    Enums: Record<string, never>
  }
}
