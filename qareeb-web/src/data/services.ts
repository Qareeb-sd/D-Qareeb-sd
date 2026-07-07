/**
 * كتالوج خدمات "قريب".
 * الصور الحقيقية تُوضع في public/vehicles/ (انظر public/vehicles/README.md).
 * أمجاد (الداماس الأزرق) ما زالت تنتظر الصورة الحقيقية — حالياً placeholder.
 */

export interface Service {
  id: string
  name: string
  tagline: string
  image: string
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
    seats: 4,
    baseFare: 500,
    perKm: 120,
  },
  {
    id: 'commute',
    name: 'ترحيل',
    tagline: 'مشوار يومي ذهاب وإياب',
    image: '/vehicles/commute.png',
    seats: 4,
    baseFare: 400,
    perKm: 90,
  },
  {
    id: 'vip',
    name: 'قريب VIP',
    tagline: 'مرسيدس مايباخ · فخامة',
    image: '/vehicles/vip.png',
    seats: 4,
    baseFare: 1500,
    perKm: 300,
  },
  {
    id: 'hiace',
    name: 'هايس',
    tagline: '14 راكب · للمجموعات',
    image: '/vehicles/hiace.png',
    seats: 14,
    baseFare: 1200,
    perKm: 200,
  },
  {
    id: 'amjad',
    name: 'أمجاد',
    tagline: 'داماس · نقل عائلي',
    image: '/vehicles/amjad.png',
    seats: 7,
    baseFare: 800,
    perKm: 160,
    pending: true,
  },
  {
    id: 'open',
    name: 'مشوار مفتوح',
    tagline: 'استأجر بالساعة أو اليوم',
    image: '/vehicles/open.png',
    seats: 4,
    baseFare: 2000,
    perKm: 0,
  },
  {
    id: 'rickshaw',
    name: 'ركشة',
    tagline: 'مشاوير قصيرة · اقتصادي',
    image: '/vehicles/rickshaw.png',
    seats: 3,
    baseFare: 300,
    perKm: 80,
  },
]

export const getService = (id: string) => services.find((s) => s.id === id)
