/**
 * هوية "قريب" البصرية — مصدر واحد للحقيقة (يطابق tailwind.config.ts).
 * استخدمها عند الحاجة للألوان في JS (مثل خرائط قوقل والرسومات).
 */
export const colors = {
  green: '#1B6B3F',
  greenDark: '#125531',
  greenSoft: '#E8F1EC',
  mint: '#F3F8F4',

  gold: '#C9A138',
  goldDeep: '#A88528',
  goldSoft: '#FBF4DD',

  lemon: '#F2E21C',

  bg: '#FAF7F2',
  ink: '#1A1F1B',
  inkSoft: '#52584E',
  inkMuted: '#8B9189',
  hairline: '#E5E7E2',

  danger: '#C5453B',
  warning: '#D88A2B',
  info: '#3A6FB0',
} as const

export type ColorToken = keyof typeof colors

// إحداثيات افتراضية: الخرطوم، السودان
export const KHARTOUM: google.maps.LatLngLiteral = {
  lat: 15.5007,
  lng: 32.5599,
}
