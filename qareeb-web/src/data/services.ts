/**
 * كتالوج خدمات "قريب".
 * الصور الحقيقية تُوضع في public/vehicles/ (انظر public/vehicles/README.md).
 * حين تغيب الصورة يُعرض رسم SVG مميّز لكل نوع (art + tint).
 *
 * ملاحظات:
 * - التسعير الفعلي يأتي من قاعدة البيانات (جدول service_pricing) ويُدار من لوحة الأدمن.
 * - femaleDriver: خدمة نسائية بسائقة.
 * - sharable: تدعم "ترحيل" (المشاركة اليومية) — متاحة لكل الأنواع عدا سحاب.
 */

export type VehicleArt = 'sedan' | 'ladies' | 'van' | 'microbus' | 'rickshaw' | 'tow'

export interface Service {
  id: string
  name: string
  tagline: string
  image: string
  art: VehicleArt
  tint: string
  seats: number
  femaleDriver?: boolean
  sharable?: boolean // يدعم ترحيل
  destinationOptional?: boolean // الوجهة اختيارية (مشوار مفتوح)
}

export const services: Service[] = [
  {
    id: 'standard',
    name: 'قريب عادي',
    tagline: 'سيارة عادية · اقتصادي وسريع',
    image: '/vehicles/qareeb_adi.png',
    art: 'sedan',
    tint: '#EDEFEC',
    seats: 4,
    sharable: true,
  },
  {
    id: 'ladies',
    name: 'قريب نسائي',
    tagline: 'سائقة · للنساء والعائلات',
    image: '/vehicles/qareeb_adi.png',
    art: 'ladies',
    tint: '#E85C9E',
    seats: 4,
    femaleDriver: true,
    sharable: true,
  },
  {
    id: 'amjad',
    name: 'أمجاد',
    tagline: 'داماس · نقل عائلي',
    image: '/vehicles/amjad.png',
    art: 'microbus',
    tint: '#3A6FB0',
    seats: 7,
    sharable: true,
  },
  {
    id: 'hiace',
    name: 'هايس',
    tagline: '14 راكب · للمجموعات',
    image: '/vehicles/hais.png',
    art: 'van',
    tint: '#CED2CE',
    seats: 14,
    sharable: true,
  },
  {
    id: 'rickshaw',
    name: 'ركشة',
    tagline: 'مشاوير قصيرة · اقتصادي',
    image: '/vehicles/raksha.png',
    art: 'rickshaw',
    tint: '#2B2F2C',
    seats: 3,
    sharable: true,
  },
  {
    id: 'open',
    name: 'مشوار مفتوح',
    tagline: 'استأجر بالساعة أو اليوم',
    image: '/vehicles/qareeb_adi.png',
    art: 'sedan',
    tint: '#EDEFEC',
    seats: 4,
    sharable: true,
    destinationOptional: true,
  },
  {
    id: 'tow',
    name: 'سحاب',
    tagline: 'سطحة · نقل وإنقاذ المركبات',
    image: '/vehicles/sahab.png',
    art: 'tow',
    tint: '#EDEFEC',
    seats: 2,
    sharable: false,
  },
]

export const getService = (id: string) => services.find((s) => s.id === id)

export const DEFAULT_SERVICE_ID = services[0].id
