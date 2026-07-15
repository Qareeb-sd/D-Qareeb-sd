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

export type TransactionType =
  | 'topup'
  | 'ride_payment'
  | 'ride_earning'
  | 'commission'
  | 'withdrawal'

export type TopupStatus = 'pending' | 'approved' | 'rejected'

export interface AppUser {
  id: string
  phone: string
  full_name: string | null
  role: 'customer' | 'driver' | 'admin'
  sos_contact1?: string | null // جهة طوارئ 1 (يضبطها العميل)
  sos_contact2?: string | null // جهة طوارئ 2
  birthdate?: string | null // تاريخ الميلاد (YYYY-MM-DD)
  rating?: number | null // متوسط تقييمه (من الطرف الآخر في الرحلات)
  ratings_count?: number // عدد التقييمات المستلمة
  created_at: string
}

export type DriverStatus = 'pending' | 'approved' | 'rejected'

export interface Driver {
  id: string
  user_id: string
  vehicle_type: string
  plate_number: string | null
  is_online: boolean
  rating: number | null
  status?: DriverStatus // حالة قديمة (نظام تسجيل مبسّط) — التسجيل الرسمي عبر driver_applications
  vip?: boolean // سائق VIP — بلا عمولة (اشتراك)
  vip_paid_until?: string | null // اشتراك VIP مدفوع حتى هذا التاريخ
  commission_free_until?: string | null // إعفاء عمولة مؤقّت حتى هذا التاريخ
  photo_url?: string | null
  vehicle_photo_url?: string | null
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
  promo_code?: string | null
  discount?: number
  created_at: string
  // تظهر فقط في قائمة الطلبات المتاحة للسائق (من list_available_rides).
  customer_name?: string | null
  customer_rating?: number | null
}

export interface Wallet {
  id: string
  user_id: string
  balance: number
  withdrawable?: number // أرباح رحلات المحفظة القابلة للسحب (منفصلة عن التعبئة)
  cancellation_debt?: number // دَيْن رسوم إلغاء يُضاف لأجرة الرحلة القادمة
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
  vip_subscription_fee: number // رسم اشتراك VIP الشهري (يُخصم من محفظة السائق)
  cancellation_fee: number // رسوم إلغاء العميل بعد قبول السائق (0 = معطّلة)
  cancellation_far_km: number // مسافة تُعفي العميل («السائق بعيد») — كم
  cancellation_far_min: number // زمن وصول مقدّر يُعفي العميل — دقيقة
  min_driver_balance: number // أدنى رصيد يسمح للسائق بالاتصال (استقبال الرحلات)
  updated_at: string
}

/** تسعيرة نوع مركبة واحد — تُدار من لوحة الأدمن. */
export type ServiceState = 'available' | 'maintenance' | 'coming_soon' | 'hidden'

/** طلب اشتراك VIP من السائق (دفع من المحفظة أو تحويل بنكي بإيصال). */
export interface VipRequest {
  id: string
  driver_id: string
  amount: number
  method: 'wallet' | 'bank_transfer'
  proof_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  note: string | null
  reviewed_by: string | null
  created_at: string
  users?: { full_name: string | null; phone: string } | null
}

/** طلب سحب أرباح من السائق (يُخصم المبلغ فوراً ويُعتمد/يُرفض من الأدمن). */
export interface Withdrawal {
  id: string
  driver_id: string
  wallet_id: string
  amount: number
  method: 'cash' | 'bank_transfer'
  destination: string | null
  status: 'pending' | 'approved' | 'rejected'
  note: string | null
  reviewed_by: string | null
  created_at: string
  users?: { full_name: string | null; phone: string } | null
}

/** كود خصم للعملاء (يُدار من لوحة الأدمن). */
export interface PromoCode {
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  active: boolean
  max_uses: number | null
  min_fare: number
  expires_at: string | null
  created_at: string
}

export interface ServicePricing {
  service_id: string
  name: string
  base_fare: number // أجرة فتح العداد (تغطي حتى tier1_max_km)
  per_km_urban: number // سعر الكيلومتر في الشريحة الحضرية (tier1..tier2)
  per_km_far: number // سعر الكيلومتر التعويضي (> tier2)
  per_minute: number // سعر الدقيقة
  commission_rate: number | null // نسبة العمولة لهذا النوع (0..1)؛ null = العمولة العامة
  sort_order: number
  active: boolean
  updated_at: string
  // حقول العرض الديناميكية (تُدار من لوحة الأدمن)
  tagline?: string | null
  seats?: number
  art?: string
  tint?: string
  image_url?: string | null
  female_driver?: boolean
  sharable?: boolean
  destination_optional?: boolean
  noun?: string | null
  state?: ServiceState
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
  scheduled_time: string // وقت الذهاب (الوصول للعمل) "HH:MM"
  return_time: string | null // وقت الإياب (المغادرة من العمل) "HH:MM"
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
  driver_photo_url: string | null // صورة السائق (عرض للعميل)
  vehicle_photo_url: string | null // صورة المركبة (عرض للعميل)
  status: DriverAppStatus
  review_note: string | null
  reviewed_by: string | null
  created_at: string
  updated_at: string
}

// ---------- الموظفون (وصول محدود للوحة الإدارة) ----------
/** صلاحيات لوحة الإدارة المتاحة للموظفين. */
export type StaffPerm = 'requests' | 'drivers' | 'rides' | 'settings'

/** موظف لوحة الإدارة وصلاحياته. */
export interface StaffRow {
  user_id: string
  perms: StaffPerm[]
  active: boolean
  created_by: string | null
  created_at: string
  users?: { full_name: string | null; phone: string } // join للاسم والهاتف
}

/** صلاحياتي في اللوحة (نتيجة my_admin_access). */
export interface AdminAccess {
  is_admin: boolean
  perms: StaffPerm[]
}

/** سجلّ نشاط — من فعل ماذا ومتى. */
export interface AuditEntry {
  id: number
  actor_id: string | null
  actor_name: string | null
  action: string
  target: string | null
  created_at: string
}

// ---------- الحسابات الداخلية (HR مصغّر) ----------
export type ExpenseCategory =
  | 'salary'
  | 'rent'
  | 'fuel'
  | 'maintenance'
  | 'marketing'
  | 'other'

/** حساب/خزينة بنكية للشركة. */
export interface CompanyAccount {
  id: string
  name: string
  bank: string | null
  number: string | null
  balance: number
  created_at: string
}

/** موظف في كشف الرواتب. */
export interface HrEmployee {
  id: string
  name: string
  role: string | null
  phone: string | null
  salary: number
  active: boolean
  created_at: string
}

/** منصرف (راتب/إيجار/…). */
export interface Expense {
  id: string
  category: ExpenseCategory
  description: string | null
  amount: number
  employee_id: string | null
  account_id: string | null
  spent_at: string
  created_by: string | null
  created_at: string
}

/** الصورة المالية للخزينة (نتيجة company_finance). */
export interface CompanyFinance {
  customer_float: number
  driver_float: number
  commission: number
  expenses: number
  borrowed: number
  treasury: number
}

/** دَين استدانة من المحافظ. */
export interface Loan {
  id: string
  source: 'customer' | 'driver'
  amount: number
  note: string | null
  active: boolean
  created_at: string
}

/** بند ميزانية للفترة (نتيجة budget_report). */
export interface BudgetRow {
  category: ExpenseCategory
  percent: number
  allocated: number
  spent: number
  income: number
}

/** عميل مسجّل كما يظهر للأدمن (مع تقييمه وعدد رحلاته). */
export interface AdminCustomer {
  id: string
  full_name: string | null
  phone: string
  rating: number | null
  ratings_count: number
  rides_count: number
  created_at: string
}

/** شكوى مرتبطة بتقييم رحلة — تظهر للأدمن. */
export interface Complaint {
  id: string
  ride_id: string
  stars: number
  complaint: string
  complaint_status: 'open' | 'resolved'
  rater_role: 'customer' | 'driver'
  rater_name: string | null // مقدّم الشكوى
  ratee_name: string | null // المُشتكى عليه
  created_at: string
}

/** لقطة تتبّع رحلة مُشارَكة (يراها طرف ثالث عبر الرمز). */
export interface TrackedRide {
  status: RideStatus
  service_id: string
  pickup_lat: number
  pickup_lng: number
  pickup_address: string | null
  dropoff_lat: number | null
  dropoff_lng: number | null
  dropoff_address: string | null
  driver_lat: number | null
  driver_lng: number | null
  driver_loc_at: string | null
  driver_name: string | null
}

/** اشتراك Web Push مخزّن لمستخدم. */
export interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
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
      push_subscriptions: {
        Row: PushSubscriptionRow
        Insert: Partial<PushSubscriptionRow>
        Update: Partial<PushSubscriptionRow>
      }
      sos_alerts: {
        Row: SosAlert
        Insert: Partial<SosAlert>
        Update: Partial<SosAlert>
      }
      staff: {
        Row: StaffRow
        Insert: Partial<StaffRow>
        Update: Partial<StaffRow>
      }
    }
    Views: Record<string, never>
    Functions: {
      approve_topup: { Args: { p_topup: string }; Returns: undefined }
      reject_topup: { Args: { p_topup: string }; Returns: undefined }
      settle_ride: { Args: { p_ride: string }; Returns: undefined }
      set_ride_status: { Args: { p_ride: string; p_status: string }; Returns: undefined }
      cancel_ride: { Args: { p_ride: string }; Returns: undefined }
      update_driver_location: {
        Args: { p_ride: string; p_lat: number; p_lng: number }
        Returns: undefined
      }
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
      my_admin_access: {
        Args: Record<string, never>
        Returns: { is_admin: boolean; perms: string[] }[]
      }
      submit_review: {
        Args: { p_ride: string; p_stars: number; p_complaint?: string | null }
        Returns: undefined
      }
      admin_list_customers: {
        Args: Record<string, never>
        Returns: AdminCustomer[]
      }
      admin_list_complaints: {
        Args: Record<string, never>
        Returns: Complaint[]
      }
      admin_resolve_complaint: { Args: { p_review: string }; Returns: undefined }
      ensure_ride_share: { Args: { p_ride: string }; Returns: string }
      track_shared_ride: { Args: { p_token: string }; Returns: TrackedRide[] }
      admin_set_staff: { Args: { p_phone: string; p_perms: string[] }; Returns: string }
      admin_remove_staff: { Args: { p_user: string }; Returns: undefined }
      admin_delete_driver: { Args: { p_user: string }; Returns: undefined }
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
