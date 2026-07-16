import { useEffect, useState } from 'react'
import { Trophy, Trash2, Plus } from 'lucide-react'
import { listIncentives, upsertIncentive, deleteIncentive } from '@/lib/api'
import { money } from '@/lib/format'
import type { DriverIncentive } from '@/lib/types'

const emptyForm = {
  id: null as string | null,
  title: '',
  period: 'daily' as 'daily' | 'weekly',
  target_rides: 5,
  reward: 5000,
  active: true,
}

/** إدارة حوافز السائقين (أهداف يومية/أسبوعية + مكافأة). */
export default function IncentivesManager() {
  const [list, setList] = useState<DriverIncentive[]>([])
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => void listIncentives().then(setList)
  useEffect(load, [])

  const edit = (inc: DriverIncentive) =>
    setForm({
      id: inc.id,
      title: inc.title,
      period: inc.period,
      target_rides: inc.target_rides,
      reward: inc.reward,
      active: inc.active,
    })

  const reset = () => setForm(emptyForm)

  const save = async () => {
    if (!form.title.trim()) {
      setMsg('أدخل عنوان الحافز')
      return
    }
    setBusy(true)
    setMsg('')
    const { error } = await upsertIncentive({
      id: form.id,
      title: form.title.trim(),
      period: form.period,
      target_rides: Math.max(1, Math.round(form.target_rides)),
      reward: Math.max(0, form.reward),
      active: form.active,
    })
    setBusy(false)
    if (error) {
      setMsg(`خطأ: ${error}`)
      return
    }
    setMsg(form.id ? 'تم تحديث الحافز ✓' : 'تمت إضافة الحافز ✓')
    reset()
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('حذف هذا الحافز نهائياً؟')) return
    await deleteIncentive(id)
    if (form.id === id) reset()
    load()
  }

  return (
    <div className="card space-y-3 p-4">
      <p className="flex items-center gap-2 font-bold">
        <Trophy className="h-5 w-5 text-sand-ink" strokeWidth={2} />
        حوافز ومكافآت السائق
      </p>
      <p className="text-xs text-ink-muted">
        عرّف أهدافاً (عدد رحلات) يومية أو أسبوعية. عند بلوغ السائق الهدف خلال الفترة تُضاف
        المكافأة إلى رصيده تلقائياً مرّة واحدة لكل فترة. اضغط أيّ حافز لتعديله.
      </p>

      {/* نموذج إضافة/تعديل */}
      <div className="rounded-2xl border border-hairline bg-green-mint/50 p-3">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">العنوان</span>
          <input
            className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-ink outline-none focus:border-green"
            placeholder="مثال: أكمل 10 رحلات اليوم"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">الفترة</span>
            <select
              className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-ink outline-none focus:border-green"
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value as 'daily' | 'weekly' })}
            >
              <option value="daily">يومي</option>
              <option value="weekly">أسبوعي</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">عدد الرحلات</span>
            <input
              type="number"
              min={1}
              className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-ink outline-none focus:border-green"
              value={form.target_rides}
              onChange={(e) => setForm({ ...form, target_rides: Number(e.target.value) })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-ink-soft">المكافأة (ج.س)</span>
            <input
              type="number"
              min={0}
              step={500}
              className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-ink outline-none focus:border-green"
              value={form.reward}
              onChange={(e) => setForm({ ...form, reward: Number(e.target.value) })}
            />
          </label>
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-green"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          فعّال (يظهر للسائقين)
        </label>
        {msg && (
          <p className={`mt-2 text-sm ${msg.startsWith('خطأ') ? 'text-danger' : 'text-green'}`}>
            {msg}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="btn-primary flex flex-1 items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            {busy ? '…' : form.id ? 'حفظ التعديل' : 'إضافة حافز'}
          </button>
          {form.id && (
            <button onClick={reset} className="btn-outline px-4">
              إلغاء
            </button>
          )}
        </div>
      </div>

      {/* القائمة */}
      {list.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-muted">لا حوافز بعد.</p>
      ) : (
        <div className="divide-y divide-hairline">
          {list.map((inc) => (
            <div key={inc.id} className="flex items-center gap-3 py-3">
              <button onClick={() => edit(inc)} className="min-w-0 flex-1 text-right">
                <p className="truncate font-bold text-royal">
                  {inc.title}
                  {!inc.active && (
                    <span className="ms-2 chip bg-ink-muted/15 text-[10px] text-ink-muted">معطّل</span>
                  )}
                </p>
                <p className="text-xs text-ink-muted">
                  {inc.period === 'daily' ? 'يومي' : 'أسبوعي'} · {inc.target_rides} رحلة ·{' '}
                  <span className="font-bold text-green">{money(inc.reward)}</span>
                </p>
              </button>
              <button
                onClick={() => remove(inc.id)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-danger hover:bg-danger/10"
                aria-label="حذف"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
