/**
 * جلب أحدث أرقام النزوح في السودان من واجهة IOM DTM (Admin0) لتحديث لوحة
 * «التوسّع» تلقائياً. عند تعذّر الجلب (حجب/CORS/تغيّر الواجهة) نعود للقطة ثابتة
 * فلا يتعطّل العرض أبداً. المصدر الحيّ: https://dtm.iom.int/sudan
 */
export interface DtmSnapshot {
  idps: number
  returnees?: number
  round?: number
  date?: string // نصّ مختصر مثل «مايو ٢٠٢٦» أو ISO
  live: boolean // true إن جاء من الواجهة الحيّة، false إن كان اللقطة الثابتة
}

/** لقطة احتياطية (IOM DTM — مايو ٢٠٢٦، الجولة ٣٦). تُستعمل إن تعذّر الجلب الحيّ. */
export const DTM_FALLBACK: DtmSnapshot = {
  idps: 8805506,
  returnees: 4441570,
  round: 36,
  date: 'مايو ٢٠٢٦',
  live: false,
}

const DTM_URL = 'https://dtmapi.iom.int/api/IdpAdmin0Data/GetAdmin0Data?CountryName=Sudan'

/** يقرأ أوّل رقم صالح من عدّة أسماء حقول محتملة (تحصيناً ضد تغيّر الواجهة). */
function pickNum(row: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = Number(row[k])
    if (Number.isFinite(v) && v > 0) return v
  }
  return 0
}

/** يجلب أحدث لقطة نزوح للسودان، أو null عند أي تعذّر (فيُستعمل DTM_FALLBACK). */
export async function fetchDtmSudan(signal?: AbortSignal): Promise<DtmSnapshot | null> {
  try {
    const res = await fetch(DTM_URL, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const json: unknown = await res.json()
    const rows = (
      Array.isArray(json)
        ? json
        : ((json as { result?: unknown[]; data?: unknown[] })?.result ??
          (json as { data?: unknown[] })?.data ??
          [])
    ) as Record<string, unknown>[]
    if (!rows.length) return null
    // أحدث جولة (أعلى roundNumber).
    const latest = rows.reduce((a, b) =>
      Number(b.roundNumber ?? 0) >= Number(a.roundNumber ?? 0) ? b : a,
    )
    const idps = pickNum(latest, ['numPresentIdpInd', 'idpTotal', 'numIdp', 'totalIdps'])
    if (!idps) return null
    const round = Number(latest.roundNumber) || undefined
    const date = latest.reportingDate ? String(latest.reportingDate).slice(0, 10) : undefined
    return {
      idps,
      returnees: pickNum(latest, ['numReturnee', 'returneeTotal']) || undefined,
      round,
      date,
      live: true,
    }
  } catch {
    return null
  }
}
