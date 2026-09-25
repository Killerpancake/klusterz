import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Button, Field, inputCls, Panel, Spinner, Toast } from '../components/ui'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) => i) // 00:00 .. 23:00, each cell = 1 hour

// day index (0=Mon) + hour -> absolute minute from Monday 00:00
const cellStart = (day, hour) => day * 1440 + hour * 60
const fmtMin = (m) => {
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  const mm = m % 60
  return `${DAYS[d]} ${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export default function Timetable() {
  const { group, refreshGroup } = useAuth()
  const [items, setItems] = useState(null)
  const [toast, setToast] = useState(null)
  const [dragKind, setDragKind] = useState(null) // 'lesson' | 'personal' | null while dragging
  const [dragging, setDragging] = useState(false)
  const [label, setLabel] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('unavailability')
      .select('id, kind, start_min, end_min, label')
      .eq('group_id', group.id)
      .order('start_min')
    if (error) setToast({ kind: 'error', message: error.message })
    else setItems(data)
  }, [group.id])

  useEffect(() => {
    load()
  }, [load])

  // which item (if any) covers this hour cell
  const covering = (day, hour) => {
    const s = cellStart(day, hour)
    return items?.find((it) => it.start_min <= s && it.end_min > s)
  }

  async function addCell(day, hour, kind) {
    const s = cellStart(day, hour)
    const e = s + 60
    const existing = covering(day, hour)
    if (existing) {
      // clicking a filled cell removes that whole block
      await supabase.from('unavailability').delete().eq('id', existing.id)
      load()
      return
    }
    const { error } = await supabase
      .from('unavailability')
      .insert({ group_id: group.id, kind, start_min: s, end_min: e, label: label || null })
    if (error) setToast({ kind: 'error', message: error.message })
    load()
  }

  async function toggleNight(value) {
    const { error } = await supabase.rpc('set_night_opt_in', { p_value: value })
    if (error) setToast({ kind: 'error', message: error.message })
    else refreshGroup()
  }

  if (items === null) return <Spinner />

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg font-medium text-ink">Timetable</h1>
          <p className="text-mute text-sm mt-1">
            Click a cell to mark it, click again to clear it. Lessons and personal blocks both hide those slots from
            booking.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm shrink-0">
          <input
            type="checkbox"
            checked={!!group.night_opt_in}
            onChange={(e) => toggleNight(e.target.checked)}
            className="accent-open w-4 h-4"
          />
          Show night sessions
        </label>
      </div>

      <Panel className="p-4 mb-4 flex flex-wrap items-end gap-3">
        <Field label="Marking as" className="shrink-0">
          <div className="flex gap-1 bg-panel2 border border-line rounded-md p-1">
            <button
              onClick={() => setDragKind('lesson')}
              className={`px-3 py-1.5 rounded text-sm transition ${
                dragKind !== 'personal' ? 'bg-full/20 text-full' : 'text-mute'
              }`}
            >
              Lesson
            </button>
            <button
              onClick={() => setDragKind('personal')}
              className={`px-3 py-1.5 rounded text-sm transition ${
                dragKind === 'personal' ? 'bg-filling/20 text-filling' : 'text-mute'
              }`}
            >
              Personal
            </button>
          </div>
        </Field>
        <div className="flex-1 min-w-[180px]">
          <Field label="Label (optional)">
            <input
              className={inputCls}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. BDA lecture, no transport"
            />
          </Field>
        </div>
      </Panel>

      <Panel className="p-3 overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-8 gap-px text-xs text-mute mb-1">
            <div />
            {DAYS.map((d) => (
              <div key={d} className="text-center py-1">
                {d}
              </div>
            ))}
          </div>
          {HOURS.map((h) => (
            <div key={h} className="grid grid-cols-8 gap-px">
              <div className="text-xs text-mute text-right pr-2 py-1 font-mono">
                {String(h).padStart(2, '0')}:00
              </div>
              {DAYS.map((_, day) => {
                const item = covering(day, h)
                const bg = !item
                  ? 'bg-panel2 hover:bg-line'
                  : item.kind === 'lesson'
                  ? 'bg-full/70 hover:bg-full'
                  : 'bg-filling/70 hover:bg-filling'
                return (
                  <button
                    key={day}
                    title={item?.label || ''}
                    onClick={() => addCell(day, h, dragKind || 'lesson')}
                    className={`h-6 rounded-sm transition ${bg}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </Panel>

      <div className="flex gap-4 mt-3 text-xs text-mute">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-full/70 inline-block" /> Lesson
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-filling/70 inline-block" /> Personal
        </span>
      </div>

      {items.length > 0 && (
        <Panel className="p-4 mt-6">
          <h2 className="text-sm font-medium text-ink mb-3">All blocks</h2>
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-center justify-between text-sm">
                <span className="font-mono text-mute">
                  {fmtMin(it.start_min)} – {fmtMin(it.end_min).split(' ')[1]}
                </span>
                <span className="text-ink">{it.label || (it.kind === 'lesson' ? 'Lesson' : 'Personal')}</span>
                <button
                  className="text-mute hover:text-full transition"
                  onClick={async () => {
                    await supabase.from('unavailability').delete().eq('id', it.id)
                    load()
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Toast {...toast} onClose={() => setToast(null)} />
    </div>
  )
}
