import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Panel, Spinner, StatusDot, loadColor, Toast } from '../components/ui'

function startOfWeek(offsetWeeks = 0) {
  const now = new Date()
  const day = (now.getDay() + 6) % 7
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(now.getDate() - day + offsetWeeks * 7)
  return monday
}
function fmtDay(d) {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function AdminLive() {
  const [clusters, setClusters] = useState([])
  const [clusterId, setClusterId] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [rows, setRows] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    supabase
      .from('clusters')
      .select('id, name, default_capacity, campuses ( name )')
      .then(({ data, error }) => {
        if (error) return setToast({ kind: 'error', message: error.message })
        setClusters(data || [])
        if (data?.length && !clusterId) setClusterId(data[0].id)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = useCallback(async () => {
    if (!clusterId) return
    setRows(null)
    const { data, error } = await supabase
      .from('admin_live')
      .select('*')
      .gte('start_at', startOfWeek(weekOffset).toISOString())
      .lt('start_at', startOfWeek(weekOffset + 1).toISOString())
      .order('start_at')
    if (error) return setToast({ kind: 'error', message: error.message })
    setRows((data || []).filter((r) => true))
  }, [clusterId, weekOffset])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!clusterId) return
    const channel = supabase
      .channel('admin-live-' + clusterId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [clusterId, load])

  // group rows -> one entry per slot with its list of group names
  const bySlot = {}
  ;(rows || [])
    .filter((r) => r.slot_id)
    .forEach((r) => {
      if (!bySlot[r.slot_id]) {
        bySlot[r.slot_id] = {
          slot_id: r.slot_id,
          start_at: r.start_at,
          end_at: r.end_at,
          session_type: r.session_type,
          capacity: r.capacity,
          booked_count: r.booked_count,
          groups: [],
        }
      }
      if (r.group_name) bySlot[r.slot_id].groups.push(r.group_name)
    })

  const slotList = Object.values(bySlot)
  const byDay = {}
  slotList.forEach((s) => {
    const key = new Date(s.start_at).toDateString()
    byDay[key] = byDay[key] || []
    byDay[key].push(s)
  })

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-lg font-medium text-ink">Live view</h1>
        <div className="flex gap-3 items-center">
          <select
            value={clusterId || ''}
            onChange={(e) => setClusterId(e.target.value)}
            className="bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-ink"
          >
            {clusters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.campuses?.name} — {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            disabled={weekOffset === 0}
            className="text-sm text-mute hover:text-ink disabled:opacity-30 transition"
          >
            ← Prev
          </button>
          <button onClick={() => setWeekOffset((w) => w + 1)} className="text-sm text-mute hover:text-ink transition">
            Next →
          </button>
        </div>
      </div>

      {rows === null && <Spinner />}

      {rows &&
        Object.entries(byDay).map(([day, daySlots]) => (
          <div key={day} className="mb-6">
            <h2 className="text-sm text-mute mb-2">{fmtDay(new Date(day))}</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {daySlots.map((s) => {
                const pct = Math.min(s.booked_count / Math.max(s.capacity, 1), 1)
                const status = loadColor(pct)
                return (
                  <Panel key={s.slot_id} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs text-ink">
                        {fmtTime(s.start_at)}–{fmtTime(s.end_at)}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-mute">
                        <StatusDot status={status} />
                        <span className="font-mono">
                          {s.booked_count}/{s.capacity}
                        </span>
                      </span>
                    </div>
                    {s.groups.length === 0 ? (
                      <p className="text-xs text-mute">Empty</p>
                    ) : (
                      <ul className="text-xs text-ink space-y-0.5">
                        {s.groups.map((g, i) => (
                          <li key={i} className="truncate">
                            {g}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                )
              })}
            </div>
          </div>
        ))}

      <Toast {...toast} onClose={() => setToast(null)} />
    </div>
  )
}
