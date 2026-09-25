import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Button, EmptyState, LoadBar, loadColor, Panel, Spinner, StatusDot, Toast } from '../components/ui'

function startOfWeek(offsetWeeks = 0) {
  const now = new Date()
  const day = (now.getDay() + 6) % 7 // 0 = Monday
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(now.getDate() - day + offsetWeeks * 7)
  return monday
}

function fmtDay(d) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function Book() {
  const { group } = useAuth()
  const [weekOffset, setWeekOffset] = useState(0)
  const [slots, setSlots] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    setSlots(null)
    const from = startOfWeek(weekOffset)
    const to = startOfWeek(weekOffset + 1)
    const { data, error } = await supabase.rpc('get_available_slots', {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
      p_session_type: null,
    })
    if (error) setToast({ kind: 'error', message: error.message })
    setSlots(data || [])
  }, [weekOffset])

  useEffect(() => {
    load()
  }, [load])

  // live: if someone else books while I'm looking, refresh the list quietly
  useEffect(() => {
    const channel = supabase
      .channel('slots-book-' + group.cluster_id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'slots', filter: `cluster_id=eq.${group.cluster_id}` },
        () => load()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [group.cluster_id, load])

  async function book(slotId) {
    setBusyId(slotId)
    const { error } = await supabase.rpc('book_slot', { p_slot_id: slotId })
    setBusyId(null)
    if (error) {
      setToast({ kind: 'error', message: error.message })
      load()
    } else {
      setToast({ kind: 'success', message: 'Slot booked.' })
      load()
    }
  }

  const grouped = {}
  ;(slots || []).forEach((s) => {
    const key = new Date(s.start_at).toDateString()
    grouped[key] = grouped[key] || []
    grouped[key].push(s)
  })

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-medium text-ink">Book a slot</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setWeekOffset((w) => w - 1)} disabled={weekOffset === 0}>
            ← Prev
          </Button>
          <Button variant="ghost" onClick={() => setWeekOffset((w) => w + 1)}>
            Next →
          </Button>
        </div>
      </div>

      {slots === null && <Spinner />}

      {slots && slots.length === 0 && (
        <Panel>
          <EmptyState
            title="No open slots this week"
            body="Every slot is either full or clashes with your timetable. Try next week, or check your timetable if that looks wrong."
          />
        </Panel>
      )}

      {slots &&
        Object.entries(grouped).map(([day, daySlots]) => (
          <div key={day} className="mb-6">
            <h2 className="text-sm text-mute mb-2">{fmtDay(new Date(day))}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {daySlots.map((s) => {
                const pct = Math.min(s.booked_count / Math.max(s.capacity, 1), 1)
                const status = loadColor(pct)
                return (
                  <Panel key={s.slot_id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-ink text-sm">
                        {fmtTime(s.start_at)} – {fmtTime(s.end_at)}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-mute">
                        <StatusDot status={status} />
                        {s.session_type}
                      </span>
                    </div>
                    <LoadBar booked={s.booked_count} capacity={s.capacity} />
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-mute font-mono">
                        {s.seats_left} of {s.capacity} seats left
                      </span>
                      <Button
                        onClick={() => book(s.slot_id)}
                        disabled={busyId === s.slot_id || s.seats_left <= 0}
                        className="!px-3 !py-1.5"
                      >
                        {busyId === s.slot_id ? 'Booking…' : 'Book'}
                      </Button>
                    </div>
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
