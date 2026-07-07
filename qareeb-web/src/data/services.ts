/**
 * كتالوج خدمات "قريب".
 * الصور الحقيقية تُوضع في public/vehicles/ (انظر public/vehicles/README.md).
 * حين تغيب الصورة يُعرض رسم SVG مميّز لكل نوع (art + tint) بدل صورة عامّة.
 * أمجاد (الداماس الأزرق) ما زالت تنتظر الصورة الحقيقية — حالياً رسم مؤقت.
 */

export type VehicleArt = 'sedan' | 'taxi' | 'luxury' | 'van' | 'microbus' | 'rickshaw'

export interface Service {
  id: string
  name: string
  tagline: string
  image: string
  art: VehicleArt // شكل الرسم البديل
  tint: string // لون هيكل المركبة في الرسم
  seats: number
  baseFare: number // بالجنيه السوداني (مبدئي — يُضبط لاحقاً)
  perKm: number
  pending?: boolean // صورة/بيانات مؤقتة
}

export const services: Service[] = [
  {
    id: 'standard',
    name: 'قريب عادي',
    tagline: 'يارس · اقتصادي وسريع',
    image: '/vehicles/standard.png',
    art: 'sedan',
    tint: '#EDEFEC',
    seats: 4,
    baseFare: 500,
    perKm: 120,
  },
  {
    id: 'commute',
    name: 'ترحيل',
    tagline: 'مشوار يومي ذهاب وإياب',
    image: '/vehicles/commute.png',
    art: 'taxi',
    tint: '#EDEFEC',
    seats: 4,
    baseFare: 400,
    perKm: 90,
  },
  {
    id: 'vip',
    name: 'قريب VIP',
    tagline: 'مرسيدس مايباخ · فخامة',
    image: '/vehicles/vip.png',
    art: 'luxury',
    tint: '#20242A',
    seats: 4,
    baseFare: 1500,
    perKm: 300,
  },
  {
    id: 'hiace',
    name: 'هايس',
    tagline: '14 راكب · للمجموعات',
    image: '/vehicles/hiace.png',
    art: 'van',
    tint: '#CED2CE',
    seats: 14,
    baseFare: 1200,
    perKm: 200,
  },
  {
    id: 'amjad',
    name: 'أمجاد',
    tagline: 'داماس · نقل عائلي',
    image: '/vehicles/amjad.png',
    art: 'microbus',
    tint: '#3A6FB0',
    seats: 7,
    baseFare: 800,
    perKm: 160,
  },
  {
    id: 'open',
    name: 'مشوار مفتوح',
    tagline: 'استأجر بالساعة أو اليوم',
    image: '/vehicles/open.png',
    art: 'sedan',
    tint: '#EDEFEC',
    seats: 4,
    baseFare: 2000,
    perKm: 0,
  },
  {
    id: 'rickshaw',
    name: 'ركشة',
    tagline: 'مشاوير قصيرة · اقتصادي',
    image: '/vehicles/rickshaw.png',
    art: 'rickshaw',
    tint: '#2B2F2C',
    seats: 3,
    baseFare: 300,
    perKm: 80,
  },
]

export const getService = (id: string) => services.find((s) => s.id === id)
