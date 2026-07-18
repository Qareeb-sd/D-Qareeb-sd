/* Service Worker لتطبيق «قريب»
 * دوران في آنٍ واحد:
 *  1) تخزين مؤقت (PWA) — فتح سريع حتى على شبكة ضعيفة/منقطعة (مهم للسودان).
 *  2) استقبال إشعارات Web Push وعرضها والنقر عليها.
 *
 * استراتيجية التخزين (الشبكة أولاً دائماً لضمان أحدث كود بعد كل تحديث):
 *  - التنقّل (HTML) والأصول (/assets/*): الشبكة أولاً ثم الكاش عند انقطاع الشبكة.
 *    (داخل التطبيق الأصلي «الشبكة» = ملفّات محلّية فورية، فلا بطء؛ ويمنع بقاء
 *     نسخة قديمة بعد تحديث الـ APK بـ install -r دون حذف.)
 *  - أي شيء آخر (Supabase/قوقل/الخطوط): لا نتدخّل — يذهب للشبكة مباشرة.
 */

const CACHE = 'qareeb-v3'
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/vehicles/') ||
    /\.(?:js|css|png|jpg|jpeg|webp|svg|woff2?)$/.test(url.pathname)
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // نتدخّل فقط في نفس النطاق — لا نلمس Supabase/قوقل/الخطوط.
  if (url.origin !== self.location.origin) return

  // التنقّل: الشبكة أولاً، وعند فشلها نُرجع نسخة الصفحة المخزّنة (تشغيل دون اتصال).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    )
    return
  }

  // الأصول: الشبكة أولاً (أحدث كود دائماً) ثم الكاش عند انقطاع الشبكة فقط.
  if (isStaticAsset(url)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(request)),
    )
  }
})

/* ---------------- إشعارات Web Push ---------------- */

self.addEventListener('push', (event) => {
  // نرسل إشعارات بلا حمولة (أخفّ وأكثر موثوقية)، فنعرض رسالة السائق الافتراضية.
  let data = {
    title: '🚗 طلب رحلة جديد',
    body: 'يوجد راكب قريب منك — افتح «قريب» لقبول الطلب',
    url: '/driver',
  }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    /* حمولة غير JSON — نُبقي الافتراضي */
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      tag: data.tag || 'qareeb-ride',
      renotify: true,
      vibrate: [120, 60, 120],
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/driver'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
