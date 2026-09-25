import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Button, Field, inputCls, Panel, Toast } from '../components/ui'

export default function JoinGroup() {
  const { group, isAdmin, refreshGroup } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  if (isAdmin) return <Navigate to="/admin/live" replace />
  if (group) return <Navigate to="/book" replace />

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setToast(null)
    const { error } = await supabase.rpc('claim_group', { p_join_code: code.trim() })
    setBusy(false)
    if (error) {
      setToast({ kind: 'error', message: error.message })
    } else {
      await refreshGroup()
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-8">
      <h1 className="text-lg font-medium text-ink mb-1">Join your group</h1>
      <p className="text-mute text-sm mb-6">
        Enter the join code your lecturer or group gave you. Only one account can hold a group at a time.
      </p>
      <Panel className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Join code">
            <input
              className={`${inputCls} font-mono uppercase tracking-wider`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 7F3K9QZX"
              required
            />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Joining…' : 'Join group'}
          </Button>
        </form>
      </Panel>
      <Toast {...toast} onClose={() => setToast(null)} />
    </div>
  )
}
