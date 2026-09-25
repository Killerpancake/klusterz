import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Button, EmptyState, Panel, Spinner, Toast } from '../components/ui'

function fmt(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function MyBookings() {
  const { group } = useAuth()
  const [rows, setRows] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, status, created_at, slots ( id, start_at, end_at, session_type )')
      .eq('group_id', group.id)
      .eq('status', 'booked')
      .order('created_at', { ascending: false })
    if (error) setToast({ kind: 'error', message: error.message })
    setRows((data || []).filter((r) => r.slots).sort((a, b) => new Date(a.slots.start_at) - new Date(b.slots.start_at)))
  }, [group.id])

  useEffect(() => {
    load()
  }, [load])

  async function cancel(bookingId) {
    setBusyId(bookingId)
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId })
    setBusyId(null)
    if (error) setToast({ kind: 'error', message: error.message })
    else {
      setToast({ kind: 'success', message: 'Booking cancelled.' })
      load()
    }
  }

  if (rows === null) return <Spinner />

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-medium text-ink mb-6">My bookings</h1>

      {rows.length === 0 && (
        <Panel>
          <EmptyState title="No upcoming bookings" body="Book a slot and it will show up here." />
        </Panel>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <Panel key={r.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-mono text-sm text-ink">
                {fmt(r.slots.start_at)} – {new Date(r.slots.end_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-xs text-mute mt-0.5 capitalize">{r.slots.session_type} session</div>
            </div>
            <Button variant="danger" onClick={() => cancel(r.id)} disabled={busyId === r.id} className="!px-3 !py-1.5">
              {busyId === r.id ? 'Cancelling…' : 'Cancel'}
            </Button>
          </Panel>
        ))}
      </div>

      <Toast {...toast} onClose={() => setToast(null)} />
    </div>
  )
}
