/**
 * مدن السودان — تُستخدم في لوحة الأدمن:
 *  • تبويبات الخريطة المباشرة (المدن النشطة فقط: active=true).
 *  • قسم «التوسّع»: كل المدن مرتّبة بالكثافة السكانية لتقرير أين تدخل بعد.
 *
 * population: تقدير تقريبي لعدد سكان المدينة (لأغراض المقارنة والترتيب فقط —
 *            عدّله بأرقامك حين تتوفّر بيانات أدق).
 * active:    هل يعمل فيها التطبيق حالياً (true) أم مرشّحة للتوسّع (false).
 * لإضافة/تفعيل مدينة عدّل هذه القائمة فقط.
 */
export interface City {
  id: string
  name: string
  center: google.maps.LatLngLiteral
  zoom: number
  radiusKm: number
  population: number
  active: boolean
}

/** مركز السودان تقريبياً لعرض الخريطة الكاملة. */
export const SUDAN_CENTER: google.maps.LatLngLiteral = { lat: 15.5, lng: 30.2 }
export const SUDAN_ZOOM = 6

/** كل مدن السودان الكبرى (نشطة ومرشّحة) — أرقام السكان تقديرية للمقارنة. */
export const sudanCities: City[] = [
  { id: 'omdurman', name: 'أم درمان', center: { lat: 15.6445, lng: 32.4777 }, zoom: 12, radiusKm: 35, population: 2800000, active: true },
  { id: 'khartoum', name: 'الخرطوم', center: { lat: 15.5007, lng: 32.5599 }, zoom: 12, radiusKm: 45, population: 2000000, active: true },
  { id: 'bahri', name: 'بحري', center: { lat: 15.6339, lng: 32.5399 }, zoom: 12, radiusKm: 30, population: 1500000, active: true },
  { id: 'nyala', name: 'نيالا', center: { lat: 12.0489, lng: 24.8807 }, zoom: 12, radiusKm: 30, population: 1200000, active: true },
  { id: 'portsudan', name: 'بورتسودان', center: { lat: 19.6158, lng: 37.2164 }, zoom: 12, radiusKm: 30, population: 700000, active: true },
  { id: 'kassala', name: 'كسلا', center: { lat: 15.451, lng: 36.4 }, zoom: 12, radiusKm: 30, population: 550000, active: true },
  { id: 'obeid', name: 'الأبيّض', center: { lat: 13.1833, lng: 30.2167 }, zoom: 12, radiusKm: 30, population: 450000, active: true },
  { id: 'gedaref', name: 'القضارف', center: { lat: 14.0354, lng: 35.3837 }, zoom: 12, radiusKm: 30, population: 400000, active: true },
  { id: 'fasher', name: 'الفاشر', center: { lat: 13.6276, lng: 25.3494 }, zoom: 12, radiusKm: 30, population: 380000, active: true },
  { id: 'kosti', name: 'كوستي', center: { lat: 13.1629, lng: 32.6635 }, zoom: 12, radiusKm: 30, population: 350000, active: true },
  { id: 'madani', name: 'ود مدني', center: { lat: 14.4012, lng: 33.5199 }, zoom: 12, radiusKm: 30, population: 350000, active: true },
  { id: 'geneina', name: 'الجنينة', center: { lat: 13.4526, lng: 22.4471 }, zoom: 12, radiusKm: 30, population: 260000, active: false },
  { id: 'damazin', name: 'الدمازين', center: { lat: 11.7898, lng: 34.3593 }, zoom: 12, radiusKm: 30, population: 250000, active: false },
  { id: 'sennar', name: 'سنار', center: { lat: 13.55, lng: 33.6167 }, zoom: 12, radiusKm: 30, population: 180000, active: true },
  { id: 'rabak', name: 'ربك', center: { lat: 13.1808, lng: 32.7441 }, zoom: 12, radiusKm: 30, population: 160000, active: false },
  { id: 'atbara', name: 'عطبرة', center: { lat: 17.7022, lng: 33.9866 }, zoom: 12, radiusKm: 30, population: 140000, active: true },
  { id: 'dueim', name: 'الدويم', center: { lat: 13.9959, lng: 32.3239 }, zoom: 12, radiusKm: 30, population: 130000, active: false },
  { id: 'daein', name: 'الضعين', center: { lat: 11.4614, lng: 26.1265 }, zoom: 12, radiusKm: 30, population: 120000, active: false },
  { id: 'shendi', name: 'شندي', center: { lat: 16.6915, lng: 33.4335 }, zoom: 12, radiusKm: 30, population: 110000, active: false },
  { id: 'dongola', name: 'دنقلا', center: { lat: 19.1667, lng: 30.4833 }, zoom: 12, radiusKm: 30, population: 100000, active: true },
  { id: 'kadugli', name: 'كادقلي', center: { lat: 11.0111, lng: 29.7172 }, zoom: 12, radiusKm: 30, population: 90000, active: false },
  { id: 'damar', name: 'الدامر', center: { lat: 17.5915, lng: 33.9686 }, zoom: 12, radiusKm: 30, population: 80000, active: false },
]

/** المدن النشطة فقط — تُستخدم في تبويبات الخريطة المباشرة. */
export const cities: City[] = sudanCities.filter((c) => c.active)
