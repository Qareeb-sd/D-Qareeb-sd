import type { Ride } from './types'

/** يرسم إيصال رحلة على canvas ويشاركه كصورة (أو يحمّله كبديل). */
export async function shareRideReceipt(ride: Ride, serviceName: string): Promise<void> {
  const W = 720
  const pad = 48
  const canvas = document.createElement('canvas')
  const scale = 2 // دقّة مضاعفة لوضوح على الشاشات الحادّة
  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: 'التاريخ', value: fmtDate(ride.created_at) },
    { label: 'الخدمة', value: serviceName },
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
  if (!ctx) return
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

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) return
  const file = new File([blob], `qareeb-receipt-${ride.id.slice(0, 8)}.png`, { type: 'image/png' })

  // مشاركة كملف إن أمكن، وإلا تنزيل.
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean
    share?: (d: { files?: File[]; title?: string }) => Promise<void>
  }
  try {
    if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: 'إيصال رحلة قريب' })
      return
    }
  } catch {
    /* أُلغيت المشاركة — نُكمل للتنزيل */
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** يصيغ ملخّص إيصال نصّياً ويشاركه — مشاركة النظام الأصلية (تشمل واتساب وغيره)
 *  مع رجوع إلى رابط واتساب إن لم تتوفّر. */
export async function shareReceiptWhatsApp(ride: Ride, serviceName: string): Promise<void> {
  const lines = [
    '🚗 *إيصال رحلة قريب*',
    '',
    `📅 ${fmtDate(ride.created_at)}`,
    `🚕 الخدمة: ${serviceName}`,
    `📍 من: ${ride.pickup_address ?? '—'}`,
    `🏁 إلى: ${ride.dropoff_address ?? '—'}`,
    `💳 الدفع: ${payLabel(ride.payment_method)}`,
    ...(ride.rider_name ? [`👤 الراكب: ${ride.rider_name}`] : []),
    '',
    `💰 *الإجمالي: ${Math.round(ride.fare ?? 0).toLocaleString('en')} ج.س*`,
    '',
    `رقم الرحلة: ${ride.id.slice(0, 8)}`,
    'شكراً لاستخدامك قريب 🙏',
  ]
  const body = lines.join('\n')
  // مشاركة أصلية (تفتح ورقة المشاركة ليختار المستخدم واتساب أو أي تطبيق) — أنسب على الجوّال.
  const nav = navigator as Navigator & { share?: (d: { text?: string; title?: string }) => Promise<void> }
  if (nav.share) {
    try {
      await nav.share({ title: 'إيصال رحلة قريب', text: body })
      return
    } catch {
      /* أُلغيت المشاركة أو تعذّرت — نُكمل لرابط واتساب */
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(body)}`, '_blank', 'noopener')
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('ar-SD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
