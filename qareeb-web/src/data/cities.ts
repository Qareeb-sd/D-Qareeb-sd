/**
 * مدن السودان — تُستخدم في لوحة الأدمن:
 *  • تبويبات الخريطة المباشرة (المدن النشطة فقط: active=true).
 *  • قسم «التوسّع»: كل المدن مع حالة النزوح في ولايتها لتقرير أين تدخل بعد.
 *
 * ملاحظة مهمّة: لا نضع أرقام سكان (تعداد ٢٠٠٨ قديم، والحرب منذ ٢٠٢٣ غيّرت
 * الخريطة السكانية جذرياً). بدلاً منها نستعين بمؤشّر النزوح على مستوى الولاية
 * من IOM DTM (Sudan Mobility Update) — وهو أصدق دلالة على أين يتركّز الناس
 * اليوم. المؤشّر على مستوى الولاية لا المدينة. آخر مرجعنا: مايو ٢٠٢٦ (الجولة ٣٦):
 * ~٨.٨ مليون نازح، ~٤.٤ مليون عائد. المصدر الحيّ: https://dtm.iom.int/sudan
 * لإضافة/تفعيل مدينة عدّل هذه القائمة فقط.
 */
export type Displacement = 'conflict' | 'host' | 'returning' | 'stable'

/** وسم حالة النزوح في الولاية (مبنيّ على IOM DTM). */
export const DISPLACEMENT_LABEL: Record<Displacement, string> = {
  conflict: '🔴 نزاع نشط',
  host: '🟠 استضافة نازحين عالية',
  returning: '🟢 عودة/تعافٍ',
  stable: '⚪ مستقرّة',
}

export interface City {
  id: string
  name: string
  center: google.maps.LatLngLiteral
  zoom: number
  radiusKm: number
  state: string // الولاية
  displacement: Displacement // حالة النزوح في الولاية (IOM DTM)
  active: boolean // يعمل فيها التطبيق؟
}

/** مركز السودان تقريبياً لعرض الخريطة الكاملة. */
export const SUDAN_CENTER: google.maps.LatLngLiteral = { lat: 15.5, lng: 30.2 }
export const SUDAN_ZOOM = 6

/**
 * مدن السودان الكبرى مع ولايتها وحالة نزوحها (IOM DTM — سبتمبر ٢٠٢٥):
 * أعلى الولايات استضافةً للنازحين: جنوب/شمال دارفور، نهر النيل، القضارف.
 * ولايات عودة/تعافٍ: الخرطوم والجزيرة (بعد استعادتها ٢٠٢٥).
 * ولايات نزاع نشط: شمال/غرب دارفور، النيل الأزرق، كردفان.
 */
export const sudanCities: City[] = [
  { id: 'khartoum', name: 'الخرطوم', center: { lat: 15.5007, lng: 32.5599 }, zoom: 12, radiusKm: 45, state: 'الخرطوم', displacement: 'returning', active: true },
  { id: 'omdurman', name: 'أم درمان', center: { lat: 15.6445, lng: 32.4777 }, zoom: 12, radiusKm: 35, state: 'الخرطوم', displacement: 'returning', active: true },
  { id: 'bahri', name: 'بحري', center: { lat: 15.6339, lng: 32.5399 }, zoom: 12, radiusKm: 30, state: 'الخرطوم', displacement: 'returning', active: true },
  { id: 'madani', name: 'ود مدني', center: { lat: 14.4012, lng: 33.5199 }, zoom: 12, radiusKm: 30, state: 'الجزيرة', displacement: 'returning', active: true },
  { id: 'portsudan', name: 'بورتسودان', center: { lat: 19.6158, lng: 37.2164 }, zoom: 12, radiusKm: 30, state: 'البحر الأحمر', displacement: 'host', active: true },
  { id: 'kassala', name: 'كسلا', center: { lat: 15.451, lng: 36.4 }, zoom: 12, radiusKm: 30, state: 'كسلا', displacement: 'host', active: true },
  { id: 'gedaref', name: 'القضارف', center: { lat: 14.0354, lng: 35.3837 }, zoom: 12, radiusKm: 30, state: 'القضارف', displacement: 'host', active: true },
  { id: 'atbara', name: 'عطبرة', center: { lat: 17.7022, lng: 33.9866 }, zoom: 12, radiusKm: 30, state: 'نهر النيل', displacement: 'host', active: true },
  { id: 'damar', name: 'الدامر', center: { lat: 17.5915, lng: 33.9686 }, zoom: 12, radiusKm: 30, state: 'نهر النيل', displacement: 'host', active: false },
  { id: 'shendi', name: 'شندي', center: { lat: 16.6915, lng: 33.4335 }, zoom: 12, radiusKm: 30, state: 'نهر النيل', displacement: 'host', active: false },
  { id: 'dongola', name: 'دنقلا', center: { lat: 19.1667, lng: 30.4833 }, zoom: 12, radiusKm: 30, state: 'الشمالية', displacement: 'host', active: true },
  { id: 'kosti', name: 'كوستي', center: { lat: 13.1629, lng: 32.6635 }, zoom: 12, radiusKm: 30, state: 'النيل الأبيض', displacement: 'host', active: true },
  { id: 'rabak', name: 'ربك', center: { lat: 13.1808, lng: 32.7441 }, zoom: 12, radiusKm: 30, state: 'النيل الأبيض', displacement: 'host', active: false },
  { id: 'dueim', name: 'الدويم', center: { lat: 13.9959, lng: 32.3239 }, zoom: 12, radiusKm: 30, state: 'النيل الأبيض', displacement: 'host', active: false },
  { id: 'sennar', name: 'سنار', center: { lat: 13.55, lng: 33.6167 }, zoom: 12, radiusKm: 30, state: 'سنار', displacement: 'returning', active: true },
  { id: 'nyala', name: 'نيالا', center: { lat: 12.0489, lng: 24.8807 }, zoom: 12, radiusKm: 30, state: 'جنوب دارفور', displacement: 'host', active: true },
  { id: 'daein', name: 'الضعين', center: { lat: 11.4614, lng: 26.1265 }, zoom: 12, radiusKm: 30, state: 'شرق دارفور', displacement: 'host', active: false },
  { id: 'fasher', name: 'الفاشر', center: { lat: 13.6276, lng: 25.3494 }, zoom: 12, radiusKm: 30, state: 'شمال دارفور', displacement: 'conflict', active: true },
  { id: 'geneina', name: 'الجنينة', center: { lat: 13.4526, lng: 22.4471 }, zoom: 12, radiusKm: 30, state: 'غرب دارفور', displacement: 'conflict', active: false },
  { id: 'obeid', name: 'الأبيّض', center: { lat: 13.1833, lng: 30.2167 }, zoom: 12, radiusKm: 30, state: 'شمال كردفان', displacement: 'conflict', active: true },
  { id: 'kadugli', name: 'كادقلي', center: { lat: 11.0111, lng: 29.7172 }, zoom: 12, radiusKm: 30, state: 'جنوب كردفان', displacement: 'conflict', active: false },
  { id: 'damazin', name: 'الدمازين', center: { lat: 11.7898, lng: 34.3593 }, zoom: 12, radiusKm: 30, state: 'النيل الأزرق', displacement: 'conflict', active: false },
  // مدن إضافية (مرشّحة) — لتغطية أوسع في قسم التوسّع.
  { id: 'merowe', name: 'مروي', center: { lat: 18.4667, lng: 31.8167 }, zoom: 12, radiusKm: 30, state: 'الشمالية', displacement: 'host', active: false },
  { id: 'debba', name: 'الدبة', center: { lat: 18.0546, lng: 30.9505 }, zoom: 12, radiusKm: 30, state: 'الشمالية', displacement: 'host', active: false },
  { id: 'berber', name: 'بربر', center: { lat: 18.0186, lng: 33.986 }, zoom: 12, radiusKm: 30, state: 'نهر النيل', displacement: 'host', active: false },
  { id: 'newhalfa', name: 'حلفا الجديدة', center: { lat: 15.3167, lng: 35.6 }, zoom: 12, radiusKm: 30, state: 'كسلا', displacement: 'host', active: false },
  { id: 'girba', name: 'خشم القربة', center: { lat: 14.9333, lng: 35.9167 }, zoom: 12, radiusKm: 30, state: 'كسلا', displacement: 'host', active: false },
  { id: 'tokar', name: 'طوكر', center: { lat: 18.4333, lng: 37.7333 }, zoom: 12, radiusKm: 30, state: 'البحر الأحمر', displacement: 'host', active: false },
  { id: 'singa', name: 'سنجة', center: { lat: 13.15, lng: 33.9333 }, zoom: 12, radiusKm: 30, state: 'سنار', displacement: 'returning', active: false },
  { id: 'hasahisa', name: 'الحصاحيصا', center: { lat: 14.7444, lng: 33.2914 }, zoom: 12, radiusKm: 30, state: 'الجزيرة', displacement: 'returning', active: false },
  { id: 'managil', name: 'المناقل', center: { lat: 14.2506, lng: 32.9906 }, zoom: 12, radiusKm: 30, state: 'الجزيرة', displacement: 'returning', active: false },
  { id: 'umruwaba', name: 'أم روابة', center: { lat: 12.9061, lng: 31.2144 }, zoom: 12, radiusKm: 30, state: 'شمال كردفان', displacement: 'conflict', active: false },
  { id: 'nahud', name: 'النهود', center: { lat: 12.7, lng: 28.4333 }, zoom: 12, radiusKm: 30, state: 'غرب كردفان', displacement: 'conflict', active: false },
  { id: 'babanusa', name: 'بابنوسة', center: { lat: 11.3333, lng: 27.8 }, zoom: 12, radiusKm: 30, state: 'غرب كردفان', displacement: 'conflict', active: false },
  { id: 'zalingei', name: 'زالنجي', center: { lat: 12.9092, lng: 23.4706 }, zoom: 12, radiusKm: 30, state: 'وسط دارفور', displacement: 'conflict', active: false },
  { id: 'kutum', name: 'كتم', center: { lat: 14.2, lng: 24.6667 }, zoom: 12, radiusKm: 30, state: 'شمال دارفور', displacement: 'conflict', active: false },
]

/**
 * تقدير سكان الولاية — أساس UN/CBS لإسقاطات ما قبل الحرب (بالمليون، تقريبيّ
 * للمقارنة فقط؛ غيّرت الحرب التوزيع فعلياً). المصدر العام: OCHA Sudan HNRP.
 */
export const STATE_POP: Record<string, number> = {
  الخرطوم: 9_000_000,
  الجزيرة: 5_500_000,
  'جنوب دارفور': 5_000_000,
  'شمال كردفان': 3_400_000,
  كسلا: 2_900_000,
  'شمال دارفور': 2_900_000,
  'جنوب كردفان': 2_900_000,
  'النيل الأبيض': 2_700_000,
  'غرب كردفان': 2_600_000,
  القضارف: 2_400_000,
  'وسط دارفور': 2_300_000,
  سنار: 2_200_000,
  'البحر الأحمر': 1_900_000,
  'غرب دارفور': 1_900_000,
  'شرق دارفور': 1_800_000,
  'نهر النيل': 1_700_000,
  'النيل الأزرق': 1_300_000,
  الشمالية: 1_000_000,
}

/** المدن النشطة فقط — تُستخدم في تبويبات الخريطة المباشرة. */
export const cities: City[] = sudanCities.filter((c) => c.active)
