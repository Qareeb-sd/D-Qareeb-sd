import { type ReactNode } from 'react'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  emptyMessage?: string
  onRowClick?: (row: T) => void
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'لا توجد بيانات',
  onRowClick,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="card flex h-48 flex-col items-center justify-center gap-2 text-ink-muted">
        <span className="text-3xl">📭</span>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-right">
          <thead>
            <tr className="border-b border-hairline bg-bg/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-ink-muted"
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                className={`transition ${onRowClick ? 'cursor-pointer hover:bg-green-soft/30' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-5 py-3.5 text-sm">
                    {col.render ? col.render(row) : (row as Record<string, unknown>)[col.key] as ReactNode}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
