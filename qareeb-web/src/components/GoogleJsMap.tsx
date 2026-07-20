import { useEffect, useRef } from 'react'
import { KHARTOUM } from '@/theme'
import { loadGoogleMaps } from '@/lib/googleMapsLoader'

/**
 * خريطة Google Maps عبر JavaScript API — تُرسم داخل الـWebView (طبقة الويب)،
 * فتعرض بلاطات قوقل الحقيقية على العميل/الكابتن والأدمن بلا مشكلة الطبقة الأصلية.
 * الواجهة نفسها: center/marker/driver/markers/driverMarkers/route/zoom/أحداث.
 */

interface MapViewProps {
  center?: google.maps.LatLngLiteral
  marker?: google.maps.LatLngLiteral
  driver?: google.maps.LatLngLiteral
  markers?: google.maps.LatLngLiteral[]
  driverMarkers?: (google.maps.LatLngLiteral & { art?: string; icon?: string })[]
  /** طبقة كثافة الطلب — نقاط تُرسم كدوائر شفّافة متراكبة. */
  heat?: google.maps.LatLngLiteral[]
  route?: google.maps.LatLngLiteral[]
  /** طبقة حركة المرور الحيّة (ألوان الازدحام على الطرق). */
  traffic?: boolean
  zoom?: number
  onCenterChanged?: (pos: google.maps.LatLngLiteral) => void
  onUserDrag?: () => void
  className?: string
}

// أيقونة السائق (سيارة داخل شارة زمردية) — نفس هوية «الواحة».
const CAR_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">` +
  `<defs><filter id="cs" x="-30%" y="-30%" width="160%" height="160%">` +
  `<feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="#0E3B2E" flood-opacity="0.35"/></filter></defs>` +
  `<circle cx="28" cy="28" r="21" fill="#0E3B2E" stroke="#fff" stroke-width="3.5" filter="url(#cs)"/>` +
  `<g transform="translate(14.5,14.5) scale(1.12)" fill="#E8D9B6">` +
  `<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/>` +
  `<path d="M6.5 6.5h11L19 11H5z" fill="#0E3B2E"/>` +
  `<circle cx="6.9" cy="14.6" r="1.7" fill="#0E3B2E"/><circle cx="17.1" cy="14.6" r="1.7" fill="#0E3B2E"/>` +
  `</g></svg>`

// أيقونات السيارات القريبة حسب نوع المركبة — رمز زمرديّ على قرص ذهبي بإطار أبيض.
// كل رمز مرسوم في مساحة 24×24 (fill=currentColor عبر الأب).
const G_CAR =
  `<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>`
// أمجاد (ميكروباص صندوقي بنوافذ).
const G_BUS =
  `<path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>`
// هايس (فان بمقدّمة مائلة — يختلف عن الأمجاد الصندوقي).
const G_VAN =
  `<path d="M17 5H3c-1.1 0-2 .89-2 2v9h2c0 1.65 1.34 3 3 3s3-1.35 3-3h5.5c0 1.65 1.34 3 3 3s3-1.35 3-3H23v-5l-6-6zM3 11V7h4v4H3zm3 6.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM13 11H9V7h4v4zm5 6.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm-3-6.5V7h1l4 4h-5z"/>`
const G_TRUCK =
  `<path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9L21.46 12H17V9.5h2.5zM18 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>`
// ركشة (منظور جانبي): قبّة ركّاب + عجلتان + نافذة ذهبية.
const G_RICKSHAW =
  `<path d="M3.5 17.5V13c0-5.2 3.3-8 7.5-8s7 3 7.5 7l1.2 1.6c.5.6.8 1.3.8 2.1v1.8z"/>` +
  `<rect x="6" y="8.5" width="8.2" height="4" rx="1" fill="#D6A93A"/>` +
  `<circle cx="7" cy="18" r="2.4"/><circle cx="16.6" cy="18" r="2.4"/>` +
  `<circle cx="7" cy="18" r="1" fill="#D6A93A"/><circle cx="16.6" cy="18" r="1" fill="#D6A93A"/>`

const nearbySvg = (glyph: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="54" height="54" viewBox="0 0 54 54">` +
  `<defs><filter id="ncs" x="-40%" y="-40%" width="180%" height="180%">` +
  `<feDropShadow dx="0" dy="2.2" stdDeviation="2.4" flood-color="#7A5B12" flood-opacity="0.45"/></filter></defs>` +
  `<circle cx="27" cy="27" r="20.5" fill="#D6A93A" stroke="#fff" stroke-width="3.5" filter="url(#ncs)"/>` +
  `<g transform="translate(14.4,14.4) scale(1.05)" fill="#0E3B2E">${glyph}</g></svg>`

/** يختار رمز المركبة القريبة حسب شكلها (art). */
function nearbyGlyph(art?: string): string {
  if (art === 'van') return G_VAN // هايس
  if (art === 'microbus') return G_BUS // أمجاد
  if (art === 'tow') return G_TRUCK // سحاب
  if (art === 'rickshaw') return G_RICKSHAW // ركشة
  return G_CAR // sedan / ladies / غير معروف
}

const PIN_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">` +
  `<path d="M15 0C6.7 0 0 6.6 0 14.8 0 25.9 15 42 15 42s15-16.1 15-27.2C30 6.6 23.3 0 15 0Z" fill="#E11D48"/>` +
  `<circle cx="15" cy="14.5" r="5.5" fill="#fff"/></svg>`

const svgUrl = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`

// ظلّ أرضيّ بيضاوي ناعم يوضع أسفل صورة المركبة ليمنحها إحساساً ثلاثيّ الأبعاد.
const SHADOW_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="18" viewBox="0 0 48 18">` +
  `<defs><filter id="sb" x="-40%" y="-40%" width="180%" height="180%">` +
  `<feGaussianBlur stdDeviation="2.4"/></filter></defs>` +
  `<ellipse cx="24" cy="10" rx="17" ry="4.6" fill="#0E3B2E" opacity="0.3" filter="url(#sb)"/></svg>`

// يصغّر صورة المركبة مرّة واحدة إلى نسخة خفيفة (~104px) ويخزّنها، فتستخدم الخريطة
// النسخة الصغيرة بدل الأصلية الثقيلة (توفير ذاكرة ووقت فكّ الترميز على الأجهزة الضعيفة).
type MapIcon = { url: string; w: number; h: number }
const iconCache = new Map<string, MapIcon>()
function getMapIcon(url: string): Promise<MapIcon> {
  const cached = iconCache.get(url)
  if (cached) return Promise.resolve(cached)
  return new Promise((resolve) => {
    const im = new Image()
    im.crossOrigin = 'anonymous' // للسماح بالتصغير عبر canvas لصور التخزين (إن سمح CORS)
    im.onload = () => {
      const nw = im.naturalWidth || 60
      const nh = im.naturalHeight || 44
      const scale = Math.min(104 / nw, 80 / nh, 1) // نسخة عرض ×2 للوضوح على الشاشات الحادّة
      const w = Math.max(1, Math.round(nw * scale))
      const h = Math.max(1, Math.round(nh * scale))
      let outUrl = url
      try {
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(im, 0, 0, w, h)
          outUrl = canvas.toDataURL('image/png') // بيانات صغيرة مضمّنة
        }
      } catch {
        /* الصورة «مسمومة» بسبب CORS → نستخدم الأصلية (تعمل، بلا تصغير) */
      }
      const r = { url: outUrl, w, h }
      iconCache.set(url, r)
      resolve(r)
    }
    im.onerror = () => resolve({ url, w: 60, h: 44 })
    im.src = url
  })
}

export default function GoogleJsMap({
  center = KHARTOUM,
  marker,
  driver,
  markers,
  driverMarkers,
  heat,
  route,
  traffic,
  zoom = 14,
  onCenterChanged,
  onUserDrag,
  className = 'h-64 w-full rounded-2xl',
}: MapViewProps) {
  const divRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const overlays = useRef<{
    markers: google.maps.Marker[]
    lines: google.maps.Polyline[]
    circles: google.maps.Circle[]
  }>({
    markers: [],
    lines: [],
    circles: [],
  })
  const lastCam = useRef<google.maps.LatLngLiteral>(center)
  const cbRef = useRef({ onCenterChanged, onUserDrag })
  cbRef.current = { onCenterChanged, onUserDrag }

  // إنشاء الخريطة مرّة واحدة.
  useEffect(() => {
    const el = divRef.current
    if (!el) return
    let cancelled = false

    void loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !divRef.current) return
        const map = new maps.Map(divRef.current, {
          center,
          zoom,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          ],
        })
        mapRef.current = map
        lastCam.current = center

        // طبقة حركة المرور الحيّة (ألوان الازدحام) — لخريطة ازدحام المدن.
        if (traffic) new maps.TrafficLayer().setMap(map)

        map.addListener('idle', () => {
          const c = map.getCenter()
          if (!c) return
          lastCam.current = { lat: c.lat(), lng: c.lng() }
          cbRef.current.onCenterChanged?.({ lat: c.lat(), lng: c.lng() })
        })
        map.addListener('dragstart', () => cbRef.current.onUserDrag?.())

        drawOverlays()
      })
      .catch(() => {
        /* بلا مفتاح/فشل تحميل — MapView سيعرض Leaflet بدلاً منها عبر شرط المفتاح */
      })

    return () => {
      cancelled = true
      overlays.current.markers.forEach((m) => m.setMap(null))
      overlays.current.lines.forEach((l) => l.setMap(null))
      overlays.current.circles.forEach((c) => c.setMap(null))
      overlays.current = { markers: [], lines: [], circles: [] }
      mapRef.current = null
    }
    // إنشاء لمرة واحدة.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // تحديث المركز من الخارج (تفادي حلقة idle↔setCenter).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const c = lastCam.current
    if (Math.abs(c.lat - center.lat) > 1e-6 || Math.abs(c.lng - center.lng) > 1e-6) {
      lastCam.current = center
      map.panTo(center)
    }
  }, [center.lat, center.lng])

  // تحديث العلامات والمسار.
  useEffect(() => {
    if (mapRef.current) drawOverlays()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    marker?.lat,
    marker?.lng,
    driver?.lat,
    driver?.lng,
    JSON.stringify(markers ?? []),
    JSON.stringify(driverMarkers ?? []),
    JSON.stringify(heat ?? []),
    JSON.stringify(route ?? []),
  ])

  function drawOverlays() {
    const map = mapRef.current
    const maps = (window as unknown as { google?: { maps?: typeof google.maps } }).google?.maps
    if (!map || !maps) return

    overlays.current.markers.forEach((m) => m.setMap(null))
    overlays.current.lines.forEach((l) => l.setMap(null))
    overlays.current.circles.forEach((c) => c.setMap(null))
    overlays.current = { markers: [], lines: [], circles: [] }

    // طبقة كثافة الطلب: دوائر برتقالية شفّافة متراكبة (خريطة حرارية بسيطة).
    heat?.forEach((h) => {
      overlays.current.circles.push(
        new maps.Circle({
          center: h,
          radius: 380,
          map,
          fillColor: '#F97316',
          fillOpacity: 0.16,
          strokeOpacity: 0,
          clickable: false,
          zIndex: 1,
        }),
      )
    })

    // خطّ المسار: هالة بيضاء عريضة ثم خطّ ملاحة أخضر زاهٍ فوقها — واضح كخطّ توجيه.
    if (route && route.length > 1) {
      overlays.current.lines.push(
        new maps.Polyline({
          path: route,
          map,
          strokeColor: '#ffffff',
          strokeWeight: 11,
          strokeOpacity: 0.95,
          zIndex: 2,
        }),
        new maps.Polyline({
          path: route,
          map,
          strokeColor: '#12A150',
          strokeWeight: 6.5,
          strokeOpacity: 1,
          zIndex: 3,
        }),
      )
    }

    const pinIcon = {
      url: svgUrl(PIN_SVG),
      scaledSize: new maps.Size(30, 42),
      anchor: new maps.Point(15, 42),
    }
    const carIcon = {
      url: svgUrl(CAR_SVG),
      scaledSize: new maps.Size(56, 56),
      anchor: new maps.Point(28, 28),
    }
    const add = (pos: google.maps.LatLngLiteral, icon: google.maps.Icon, z: number) =>
      overlays.current.markers.push(new maps.Marker({ position: pos, map, icon, zIndex: z }))

    if (marker) add(marker, pinIcon, 10)
    markers?.forEach((m) => add(m, pinIcon, 10))
    if (driver) add(driver, carIcon, 1000)

    // علامة السائق القريب: صورة المركبة الحقيقية بنسبة أبعادها، وإلا رمز حسب النوع.
    const gen = overlays.current // مرجع الجيل الحالي — نتجاهل الإضافات المتأخّرة بعد إعادة رسم.
    driverMarkers?.forEach((d) => {
      if (!d.icon) {
        add(d, {
          url: svgUrl(nearbySvg(nearbyGlyph(d.art))),
          scaledSize: new maps.Size(54, 54),
          anchor: new maps.Point(27, 27),
        }, 500)
        return
      }
      // نسخة مصغّرة خفيفة + ملاءمتها داخل صندوق 52×40 مع الحفاظ على النسبة (بلا تشويه).
      void getMapIcon(d.icon).then(({ url, w, h }) => {
        if (!mapRef.current || overlays.current !== gen) return
        const scale = Math.min(52 / w, 40 / h)
        const iw = Math.round(w * scale)
        const ih = Math.round(h * scale)
        // ظلّ أرضيّ تحت المركبة (علامة منفصلة أدنى في الترتيب) — مركزه عند نقطة القاعدة.
        const shH = Math.round(iw * 0.34)
        add(d, {
          url: svgUrl(SHADOW_SVG),
          scaledSize: new maps.Size(iw, shH),
          anchor: new maps.Point(iw / 2, Math.round(shH * 0.55)),
        }, 499)
        // المركبة نفسها تقف على النقطة (مرساة أسفل الوسط) فوق الظلّ.
        add(d, {
          url,
          scaledSize: new maps.Size(iw, ih),
          anchor: new maps.Point(iw / 2, ih),
        }, 500)
      })
    })
  }

  return <div ref={divRef} dir="ltr" className={`overflow-hidden ${className}`} />
}
