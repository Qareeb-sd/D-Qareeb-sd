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

/** حالة الخدمة كما يتحكّم بها الأدمن وتنعكس على تطبيق العميل. */
export type ServiceState = 'available' | 'maintenance' | 'coming_soon' | 'hidden'

export interface Service {
  id: string
  name: string
  tagline: string
  image: string
  imageUrl?: string // صورة مرفوعة من لوحة الأدمن (تُفضّل على image المحلّية)
  art: VehicleArt
  tint: string
  seats: number
  noun: string // اسم المركبة في الصياغة، مثل «السحّاب»/«الركشة» (لنماذج التسجيل)
  femaleDriver?: boolean
  sharable?: boolean // يدعم ترحيل
  destinationOptional?: boolean // الوجهة اختيارية (مشوار مفتوح)
  state?: ServiceState // available افتراضياً
}

export const services: Service[] = [
  {
    id: 'standard',
    name: 'قريب',
    tagline: 'سيارة عادية · اقتصادي وسريع',
    image: '/vehicles/standard.png',
    art: 'sedan',
    tint: '#EDEFEC',
    seats: 4,
    noun: 'السيارة',
    sharable: true,
  },
  {
    id: 'open',
    name: 'مشوار مفتوح',
    tagline: 'استأجر بالساعة أو اليوم',
    image: '/vehicles/open.png',
    art: 'sedan',
    tint: '#EDEFEC',
    seats: 4,
    noun: 'السيارة',
    sharable: true,
    destinationOptional: true,
  },
  {
    id: 'ladies',
    name: 'قريب نسائي',
    tagline: 'سائقة · للنساء والعائلات',
    image: '/vehicles/ladies.png',
    art: 'ladies',
    tint: '#E85C9E',
    seats: 4,
    noun: 'السيارة',
    femaleDriver: true,
    sharable: true,
  },
  {
    id: 'rickshaw',
    name: 'ركشة',
    tagline: 'مشاوير قصيرة · اقتصادي',
    image: '/vehicles/rickshaw.png',
    art: 'rickshaw',
    tint: '#2B2F2C',
    seats: 3,
    noun: 'الركشة',
    sharable: true,
  },
  {
    id: 'hiace',
    name: 'هايس',
    tagline: '11 راكب · للمجموعات',
    image: '/vehicles/hiace.png',
    art: 'van',
    tint: '#CED2CE',
    seats: 11,
    noun: 'الهايس',
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
    noun: 'الأمجاد',
    sharable: true,
  },
  {
    id: 'tow',
    name: 'سحاب',
    tagline: 'سطحة · نقل وإنقاذ المركبات',
    image: '/vehicles/tow.png',
    art: 'tow',
    tint: '#EDEFEC',
    seats: 2,
    noun: 'السطحة',
    sharable: false,
  },
  // خدمتان خاصّتان لا تظهران في قائمة اختيار المركبة (state=hidden)، لكن لهما
  // تسعيرهما الكامل بالمسافة/الزمن في لوحة الأدمن مثل بقية المركبات.
  {
    id: 'package',
    name: 'توصيل طرد',
    tagline: 'أرسل غرضاً لأي مكان',
    image: '/vehicles/rickshaw.png',
    art: 'rickshaw',
    tint: '#B0870F',
    seats: 1,
    noun: 'الطرد',
    sharable: false,
    state: 'hidden',
  },
  {
    id: 'intercity',
    name: 'سفر بين المدن',
    tagline: 'رحلة لمدينة أخرى',
    image: '/vehicles/standard.png',
    art: 'sedan',
    tint: '#0E3B2E',
    seats: 4,
    noun: 'السيارة',
    sharable: false,
    state: 'hidden',
  },
]

/**
 * ذاكرة الخدمات وقت التشغيل: تُحمّل من قاعدة البيانات (service_pricing) عبر
 * ServicesContext ثم تُحقن هنا، فتصبح كل الشاشات ديناميكية بلا تحديث للتطبيق.
 * قبل التحميل نعود إلى القائمة المبدئية (services) حتى لا تظهر شاشة فارغة.
 */
let runtime: Service[] | null = null

/** يحقن قائمة الخدمات القادمة من قاعدة البيانات. */
export function setRuntimeServices(list: Service[] | null) {
  runtime = list && list.length ? list : null
}

/** كل الخدمات (المخفية مشمولة — الفلترة تتم في طبقة العرض). */
export function allServices(): Service[] {
  return runtime ?? services
}

/** الخدمات المرئية للعميل (تستبعد المخفية). */
export function visibleServices(): Service[] {
  return allServices().filter((s) => (s.state ?? 'available') !== 'hidden')
}

export const getService = (id: string) => allServices().find((s) => s.id === id)

export const DEFAULT_SERVICE_ID = services[0].id
