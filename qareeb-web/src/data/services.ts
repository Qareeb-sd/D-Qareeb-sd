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
  noun: string // اسم المركبة في الصياغة، مثل «السحّاب»/«الركشة» (لنماذج التسجيل)
  femaleDriver?: boolean
  sharable?: boolean // يدعم ترحيل
  destinationOptional?: boolean // الوجهة اختيارية (مشوار مفتوح)
}

export const services: Service[] = [
  {
    id: 'standard',
    name: 'قريب',
    tagline: 'سيارة عادية · اقتصادي وسريع',
    image: '/vehicles/salon_original.webp',
    art: 'sedan',
    tint: '#EDEFEC',
    seats: 4,
    noun: 'السيارة',
    sharable: true,
  },
  {
    id: 'ladies',
    name: 'قريب نسائي',
    tagline: 'سائقة · للنساء والعائلات',
    image: '/vehicles/salon_original.webp',
    art: 'ladies',
    tint: '#E85C9E',
    seats: 4,
    noun: 'السيارة',
    femaleDriver: true,
    sharable: true,
  },
  {
    id: 'amjad',
    name: 'أمجاد',
    tagline: 'داماس · نقل عائلي',
    image: '/vehicles/damas_original.jpg',
    art: 'microbus',
    tint: '#3A6FB0',
    seats: 7,
    noun: 'الأمجاد',
    sharable: true,
  },
  {
    id: 'hiace',
    name: 'هايس',
    tagline: '11 راكب · للمجموعات',
    image: '/vehicles/hais_original.jpg',
    art: 'van',
    tint: '#CED2CE',
    seats: 11,
    noun: 'الهايس',
    sharable: true,
  },
  {
    id: 'rickshaw',
    name: 'ركشة',
    tagline: 'مشاوير قصيرة · اقتصادي',
    image: '/vehicles/tuktuk_original.jpg',
    art: 'rickshaw',
    tint: '#2B2F2C',
    seats: 3,
    noun: 'الركشة',
    sharable: true,
  },
  {
    id: 'open',
    name: 'مشوار مفتوح',
    tagline: 'استأجر بالساعة أو اليوم',
    image: '/vehicles/salon_original.webp',
    art: 'sedan',
    tint: '#EDEFEC',
    seats: 4,
    noun: 'السيارة',
    sharable: true,
    destinationOptional: true,
  },
  {
    id: 'tow',
    name: 'سحاب',
    tagline: 'سطحة · نقل وإنقاذ المركبات',
    image: '/vehicles/sahab_original.jpg',
    art: 'tow',
    tint: '#EDEFEC',
    seats: 2,
    noun: 'السطحة',
    sharable: false,
  },
]

export const getService = (id: string) => services.find((s) => s.id === id)

export const DEFAULT_SERVICE_ID = services[0].id
