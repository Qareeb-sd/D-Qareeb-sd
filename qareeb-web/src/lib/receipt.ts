import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { getRideDriver } from './api'
import type { Ride } from './types'

const isNative = Capacitor.isNativePlatform()

/** يرسم إيصال الرحلة على canvas ويعيده كصورة PNG (Blob + base64). */
async function renderReceipt(
  ride: Ride,
  serviceName: string,
  extra?: { plate?: string | null },
): Promise<{ blob: Blob; base64: string } | null> {
  const W = 720
  const pad = 48
  const canvas = document.createElement('canvas')
  const scale = 2 // دقّة مضاعفة لوضوح على الشاشات الحادّة
  const rows: { label: string; value: string }[] = [
    { label: 'التاريخ', value: fmtDateOnly(ride.created_at) },
    { label: 'وقت الطلب', value: fmtTime(ride.created_at) },
    ...(ride.started_at ? [{ label: 'وقت التحرّك', value: fmtTime(ride.started_at) }] : []),
    ...(ride.completed_at ? [{ label: 'وقت الوصول', value: fmtTime(ride.completed_at) }] : []),
    ...(ride.started_at && ride.completed_at
      ? [{ label: 'مدّة الرحلة', value: fmtDuration(ride.started_at, ride.completed_at) }]
      : []),
    { label: 'الخدمة', value: serviceName },
    ...(extra?.plate ? [{ label: 'رقم السيارة', value: extra.plate }] : []),
    { label: 'من', value: ride.pickup_address ?? '—' },
    { label: 'إلى', value: ride.dropoff_address ?? '—' },
    { label: 'طريقة الدفع', value: payLabel(ride.payment_method) },
    ...(ride.rider_name ? [{ label: 'الراكب', value: ride.rider_name }] : []),
  ]
  // ارتفاع ديناميكي حسب عدد الأسطر.
  const H = 360 + rows.length * 56
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(scale, scale)
  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  const right = W - pad
  const left = pad

  // خلفية
  ctx.fillStyle = '#F7F5EF'
  ctx.fillRect(0, 0, W, H)
  // بطاقة
  ctx.fillStyle = '#FFFFFF'
  roundRect(ctx, pad / 2, pad / 2, W - pad, H - pad, 24)
  ctx.fill()

  // ترويسة خضراء
  ctx.fillStyle = '#0E3B2E'
  roundRect(ctx, pad / 2, pad / 2, W - pad, 96, 24)
  ctx.fill()
  ctx.fillRect(pad / 2, pad / 2 + 60, W - pad, 36) // إبقاء أسفل الترويسة مستقيماً
  ctx.fillStyle = '#E8D9B6'
  ctx.font = 'bold 34px "IBM Plex Sans Arabic", system-ui, sans-serif'
  ctx.fillText('قريب', right - 12, pad / 2 + 42)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '600 20px "IBM Plex Sans Arabic", system-ui, sans-serif'
  ctx.fillText('إيصال رحلة', right - 12, pad / 2 + 74)

  // الأسطر
  let y = pad / 2 + 150
  ctx.font = '400 19px "IBM Plex Sans Arabic", system-ui, sans-serif'
  for (const r of rows) {
    ctx.fillStyle = '#8A8F88'
    ctx.textAlign = 'right'
    ctx.fillText(r.label, right - 12, y)
    ctx.fillStyle = '#1A1E1B'
    ctx.textAlign = 'left'
    ctx.font = '600 19px "IBM Plex Sans Arabic", system-ui, sans-serif'
    ctx.fillText(truncate(r.value, 34), left + 12, y)
    ctx.font = '400 19px "IBM Plex Sans Arabic", system-ui, sans-serif'
    y += 56
  }

  // خطّ متقطّع
  y += 6
  ctx.strokeStyle = '#D9D5CB'
  ctx.setLineDash([6, 6])
  ctx.beginPath()
  ctx.moveTo(left + 12, y)
  ctx.lineTo(right - 12, y)
  ctx.stroke()
  ctx.setLineDash([])

  // الإجمالي
  y += 54
  ctx.textAlign = 'right'
  ctx.fillStyle = '#0E3B2E'
  ctx.font = 'bold 24px "IBM Plex Sans Arabic", system-ui, sans-serif'
  ctx.fillText('الإجمالي', right - 12, y)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#1B6B3F'
  ctx.font = 'bold 30px "IBM Plex Sans Arabic", system-ui, sans-serif'
  ctx.fillText(`${Math.round(ride.fare ?? 0).toLocaleString('en')} ج.س`, left + 12, y)

  // تذييل
  y += 54
  ctx.textAlign = 'center'
  ctx.fillStyle = '#8A8F88'
  ctx.font = '400 15px "IBM Plex Sans Arabic", system-ui, sans-serif'
  ctx.fillText(`رقم الرحلة: ${ride.id.slice(0, 8)}`, W / 2, y)
  ctx.fillText('شكراً لاستخدامك قريب 🚗', W / 2, y + 26)

  const dataUrl = canvas.toDataURL('image/png')
  const base64 = dataUrl.split(',')[1] ?? ''
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) return null
  return { blob, base64 }
}

/**
 * يشارك صورة الإيصال فقط (بلا نصّ) عبر ورقة المشاركة الأصلية (واتساب/تيليجرام/حفظ للمعرض…).
 * على الجوّال الأصلي يكتب الصورة لملفّ ويشاركها كملف حقيقي عبر Capacitor Share؛
 * وعلى الويب يستعمل Web Share للملفّات ثم يرجع للتنزيل.
 */
export async function shareRideReceipt(ride: Ride, serviceName: string): Promise<{ ok: boolean; reason?: string }> {
  // رقم السيارة من دالة آمنة (قد تفشل بلا اتصال — نتجاهلها ونكمل).
  const plate = await getRideDriver(ride.id)
    .then((d) => d?.plate_number ?? null)
    .catch(() => null)
  const img = await renderReceipt(ride, serviceName, { plate })
  if (!img) return { ok: false, reason: 'تعذّر إنشاء صورة الإيصال' }
  const fileName = `qareeb-receipt-${ride.id.slice(0, 8)}.png`

  // ===== الجوّال الأصلي: كتابة الصورة لملفّ ثم مشاركتها كملفّ (صورة فقط) =====
  if (isNative) {
    try {
      const written = await Filesystem.writeFile({
        path: fileName,
        data: img.base64,
        directory: Directory.Cache,
      })
      const canShare = await Share.canShare().then((r) => r.value).catch(() => true)
      if (canShare) {
        await Share.share({
          title: 'إيصال رحلة قريب',
          files: [written.uri],
          dialogTitle: 'مشاركة الإيصال',
        })
        return { ok: true }
      }
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e)
      // إلغاء المستخدم لورقة المشاركة ليس خطأً.
      if (/cancel|dismiss/i.test(msg)) return { ok: true }
      return { ok: false, reason: `تعذّرت المشاركة: ${msg}` }
    }
  }

  // ===== الويب: Web Share للملفّات إن دعمها المتصفّح (صورة فقط) =====
  const file = new File([img.blob], fileName, { type: 'image/png' })
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean
    share?: (d: { files?: File[]; title?: string }) => Promise<void>
  }
  try {
    if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: 'إيصال رحلة قريب' })
      return { ok: true }
    }
  } catch (e) {
    const msg = (e as Error)?.name ?? ''
    if (msg === 'AbortError') return { ok: true } // ألغى المستخدم
    /* نُكمل للتنزيل */
  }
  // رجوع أخير: تنزيل الصورة.
  const url = URL.createObjectURL(img.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return { ok: true }
}

/**
 * زرّ واتساب: يشارك صورة الإيصال فقط (بلا نصّ قابل للتزوير) — نفس ورقة المشاركة
 * حيث واتساب أوّل الخيارات على الجوّال.
 */
export async function shareReceiptWhatsApp(ride: Ride, serviceName: string): Promise<{ ok: boolean; reason?: string }> {
  return shareRideReceipt(ride, serviceName)
}

function fmtDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('ar-SD', { year: 'numeric', month: 'long', day: 'numeric' })
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ar-SD', { hour: '2-digit', minute: '2-digit' })
}
/** مدّة الرحلة بين لحظتين، بصيغة «س ساعة د دقيقة» أو «د دقيقة». */
function fmtDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const mins = Math.round(ms / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0) return m > 0 ? `${h} ساعة ${m} دقيقة` : `${h} ساعة`
  return `${m} دقيقة`
}
function payLabel(m: string): string {
  return m === 'wallet' ? 'محفظة قريب' : m === 'bank_transfer' ? 'تحويل بنكي' : 'كاش'
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
