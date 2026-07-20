/**
 * مدن السودان التي يعمل فيها «قريب» — تُستخدم في لوحة الأدمن لفصل الخريطة
 * المباشرة بتبويب لكل مدينة (تصفية السائقين/الرحلات حول مركزها) إضافةً لخريطة
 * السودان الكاملة. لإضافة/إزالة مدينة عدّل هذه القائمة فقط.
 *
 * center: مركز المدينة (تُوسَّط الخريطة عنده).
 * zoom:   تقريب الخريطة لعرض المدينة.
 * radiusKm: نصف قطر النطاق الذي تُحسب داخله السائقون/الرحلات تابعين للمدينة.
 */
export interface City {
  id: string
  name: string
  center: google.maps.LatLngLiteral
  zoom: number
  radiusKm: number
}

/** مركز السودان تقريبياً لعرض الخريطة الكاملة. */
export const SUDAN_CENTER: google.maps.LatLngLiteral = { lat: 15.5, lng: 30.2 }
export const SUDAN_ZOOM = 6

export const cities: City[] = [
  { id: 'khartoum', name: 'الخرطوم', center: { lat: 15.5007, lng: 32.5599 }, zoom: 12, radiusKm: 45 },
  { id: 'omdurman', name: 'أم درمان', center: { lat: 15.6445, lng: 32.4777 }, zoom: 12, radiusKm: 35 },
  { id: 'bahri', name: 'بحري', center: { lat: 15.6339, lng: 32.5399 }, zoom: 12, radiusKm: 30 },
  { id: 'madani', name: 'ود مدني', center: { lat: 14.4012, lng: 33.5199 }, zoom: 12, radiusKm: 30 },
  { id: 'portsudan', name: 'بورتسودان', center: { lat: 19.6158, lng: 37.2164 }, zoom: 12, radiusKm: 30 },
  { id: 'kassala', name: 'كسلا', center: { lat: 15.451, lng: 36.4 }, zoom: 12, radiusKm: 30 },
  { id: 'gedaref', name: 'القضارف', center: { lat: 14.0354, lng: 35.3837 }, zoom: 12, radiusKm: 30 },
  { id: 'obeid', name: 'الأبيّض', center: { lat: 13.1833, lng: 30.2167 }, zoom: 12, radiusKm: 30 },
  { id: 'atbara', name: 'عطبرة', center: { lat: 17.7022, lng: 33.9866 }, zoom: 12, radiusKm: 30 },
  { id: 'dongola', name: 'دنقلا', center: { lat: 19.1667, lng: 30.4833 }, zoom: 12, radiusKm: 30 },
  { id: 'kosti', name: 'كوستي', center: { lat: 13.1629, lng: 32.6635 }, zoom: 12, radiusKm: 30 },
  { id: 'sennar', name: 'سنار', center: { lat: 13.55, lng: 33.6167 }, zoom: 12, radiusKm: 30 },
  { id: 'nyala', name: 'نيالا', center: { lat: 12.0489, lng: 24.8807 }, zoom: 12, radiusKm: 30 },
  { id: 'fasher', name: 'الفاشر', center: { lat: 13.6276, lng: 25.3494 }, zoom: 12, radiusKm: 30 },
]
