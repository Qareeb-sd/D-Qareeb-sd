/**
 * العناوين المحفوظة للعميل (المنزل/العمل/المفضلة) — تُخزَّن محلياً لكل مستخدم.
 * مصدر واحد مشترك بين تحديد الرحلة (SelectLocation) وشاشة إدارة العناوين
 * (Addresses)، فلا تتكرر منطق التخزين ولا تتعارض المفاتيح.
 */
import { House, Briefcase, Star, type LucideIcon } from 'lucide-react'

export interface SavedPlace {
  lat: number
  lng: number
  address: string
}

export type SavedKey = 'home' | 'work' | 'favorite'

export const SAVED_SLOTS: { key: SavedKey; label: string; icon: LucideIcon }[] = [
  { key: 'home', label: 'المنزل', icon: House },
  { key: 'work', label: 'العمل', icon: Briefcase },
  { key: 'favorite', label: 'المفضلة', icon: Star },
]

function storageKey(userId?: string): string {
  return `qareeb_places_${userId ?? 'guest'}`
}

export function loadPlaces(userId?: string): Record<string, SavedPlace> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || '{}') as Record<
      string,
      SavedPlace
    >
  } catch {
    return {}
  }
}

/** يكتب مجموعة العناوين كاملة (يُستخدم بعد تعديل/حذف عنصر). */
export function writePlaces(userId: string | undefined, places: Record<string, SavedPlace>): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(places))
  } catch {
    /* التخزين المحلي غير متاح */
  }
}

/** يحفظ/يستبدل عنواناً واحداً ويعيد المجموعة المحدّثة. */
export function savePlace(
  userId: string | undefined,
  current: Record<string, SavedPlace>,
  key: SavedKey,
  place: SavedPlace,
): Record<string, SavedPlace> {
  const next = { ...current, [key]: place }
  writePlaces(userId, next)
  return next
}

/** يحذف عنواناً واحداً ويعيد المجموعة المحدّثة. */
export function removePlace(
  userId: string | undefined,
  current: Record<string, SavedPlace>,
  key: SavedKey,
): Record<string, SavedPlace> {
  const next = { ...current }
  delete next[key]
  writePlaces(userId, next)
  return next
}
