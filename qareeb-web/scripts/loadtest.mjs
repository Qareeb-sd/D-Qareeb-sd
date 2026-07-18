#!/usr/bin/env node
/**
 * اختبار حِمل واقعي لخلفية «قريب» على Supabase.
 *
 * يحاكي عملاء متزامنين يطرقون أثقل مسارات القراءة (السائقون القريبون، التسعير،
 * الرحلة النشطة) بمعدّل عالٍ لمدّة محدّدة، ويقيس زمن الاستجابة (p50/p95/p99)
 * والإنتاجية ونسبة الأخطاء — أرقام حقيقية بدل التخمين.
 *
 * آمن: قراءة فقط افتراضياً (لا ينشئ رحلات ولا يلوّث البيانات).
 *
 * التشغيل (من داخل مجلّد qareeb-web، والجهاز متّصل بالإنترنت):
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   ANON_KEY=eyJhbGc... \
 *   TEST_PHONE=0123886336 TEST_PASSWORD=123456 \
 *   CONCURRENCY=100 DURATION_SEC=30 \
 *   node scripts/loadtest.mjs
 *
 * ملاحظات:
 *  - ANON_KEY هو المفتاح العلني الآمن (ليس service_role — لا تستعمله هنا أبداً).
 *  - TEST_PHONE/TEST_PASSWORD حساب عميل تجريبيّ موجود (لتسجيل الدخول والحصول على JWT).
 *  - ارفع CONCURRENCY تدريجياً (50 → 200 → 500) وراقب p95 ونسبة الأخطاء وباقة Supabase.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const ANON_KEY = process.env.ANON_KEY || ''
const TEST_PHONE = process.env.TEST_PHONE || ''
const TEST_PASSWORD = process.env.TEST_PASSWORD || ''
const CONCURRENCY = Number(process.env.CONCURRENCY || 100)
const DURATION_SEC = Number(process.env.DURATION_SEC || 30)
// الخرطوم تقريباً (لاستعلام السائقين القريبين).
const LAT = Number(process.env.LAT || 15.5007)
const LNG = Number(process.env.LNG || 32.5599)

if (!SUPABASE_URL || !ANON_KEY || !TEST_PHONE || !TEST_PASSWORD) {
  console.error('ينقص متغيّر بيئة: SUPABASE_URL / ANON_KEY / TEST_PHONE / TEST_PASSWORD')
  process.exit(1)
}

const digits = TEST_PHONE.replace(/\D/g, '')
const email = `${digits}@qareeb.sd`

/** تسجيل الدخول للحصول على JWT (نفس آلية التطبيق: هاتف → بريد صوري). */
async function signIn() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  })
  if (!res.ok) {
    console.error('فشل تسجيل الدخول:', res.status, await res.text())
    process.exit(1)
  }
  const j = await res.json()
  return j.access_token
}

// أثقل مسارات القراءة التي يطرقها العميل باستمرار (polling/تحميل الشاشة).
function endpoints(jwt) {
  const h = { apikey: ANON_KEY, authorization: `Bearer ${jwt}`, 'content-type': 'application/json' }
  return [
    {
      name: 'nearby_online_drivers',
      run: () =>
        fetch(`${SUPABASE_URL}/rest/v1/rpc/nearby_online_drivers`, {
          method: 'POST',
          headers: h,
          body: JSON.stringify({ p_lat: LAT, p_lng: LNG, p_radius_km: 6 }),
        }),
    },
    {
      name: 'service_pricing',
      run: () =>
        fetch(`${SUPABASE_URL}/rest/v1/service_pricing?select=*`, { headers: h }),
    },
    {
      name: 'active_ride',
      run: () =>
        fetch(
          `${SUPABASE_URL}/rest/v1/rides?select=id,status&status=in.(requested,searching,accepted,arrived,in_progress)&order=created_at.desc&limit=1`,
          { headers: h },
        ),
    },
  ]
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[i]
}

async function main() {
  console.log(`تسجيل الدخول كـ ${email} ...`)
  const jwt = await signIn()
  const eps = endpoints(jwt)
  console.log(
    `بدء الاختبار: ${CONCURRENCY} عامل متزامن × ${DURATION_SEC}s على ${eps.length} مسارات...\n`,
  )

  const latencies = []
  let ok = 0
  let err = 0
  const errCodes = {}
  const deadline = Date.now() + DURATION_SEC * 1000
  let ei = 0

  async function worker() {
    while (Date.now() < deadline) {
      const ep = eps[ei++ % eps.length]
      const t0 = performance.now()
      try {
        const res = await ep.run()
        const dt = performance.now() - t0
        latencies.push(dt)
        if (res.ok) ok++
        else {
          err++
          errCodes[res.status] = (errCodes[res.status] || 0) + 1
          // استهلاك الجسم لتحرير الاتصال
          await res.text().catch(() => {})
        }
      } catch (e) {
        err++
        errCodes[e?.name || 'network'] = (errCodes[e?.name || 'network'] || 0) + 1
      }
    }
  }

  const t0 = Date.now()
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  const elapsed = (Date.now() - t0) / 1000

  latencies.sort((a, b) => a - b)
  const total = ok + err
  const rps = total / elapsed
  const r = (n) => Math.round(n)

  console.log('══════════ النتيجة ══════════')
  console.log(`الطلبات: ${total}  |  ناجحة: ${ok}  |  فاشلة: ${err} (${((err / total) * 100).toFixed(2)}%)`)
  console.log(`الإنتاجية: ${r(rps)} طلب/ثانية`)
  console.log(`زمن الاستجابة (ms):  p50=${r(percentile(latencies, 50))}  p95=${r(percentile(latencies, 95))}  p99=${r(percentile(latencies, 99))}  max=${r(latencies[latencies.length - 1] || 0)}`)
  if (err) console.log('رموز الأخطاء:', errCodes)
  console.log('═════════════════════════════')
  console.log(
    '\nدلالة الأرقام: p95 < 300ms ونسبة أخطاء ~0% = ممتاز. إن ارتفع p95 كثيراً أو ظهرت أخطاء 5xx/546،\n' +
      'فذلك مؤشّر على الحاجة لترقية باقة Supabase أو تفعيل تجميع الاتصالات (Supavisor) أو فهرس ناقص.',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
