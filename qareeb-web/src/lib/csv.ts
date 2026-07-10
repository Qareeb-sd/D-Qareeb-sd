/**
 * تصدير جدول إلى ملف CSV يفتح في Excel/Sheets.
 * يضيف BOM (﻿) حتى تظهر العربية صحيحة في Excel.
 */
type Row = Record<string, string | number | null | undefined>

function cell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  // تغليف الخلايا التي تحوي فاصلة/سطر/اقتباس.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** يبني نص CSV من رؤوس وصفوف. */
export function toCsv(headers: { key: string; label: string }[], rows: Row[]): string {
  const head = headers.map((h) => cell(h.label)).join(',')
  const body = rows
    .map((r) => headers.map((h) => cell(r[h.key])).join(','))
    .join('\n')
  return `﻿${head}\n${body}`
}

/** ينزّل نص CSV كملف. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** اختصار: يبني وينزّل مباشرة. */
export function exportCsv(
  filename: string,
  headers: { key: string; label: string }[],
  rows: Row[],
) {
  downloadCsv(filename, toCsv(headers, rows))
}
