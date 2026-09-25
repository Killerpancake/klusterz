import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Field, inputCls, Panel, Spinner, Toast } from '../components/ui'

function nextMonday() {
  const now = new Date()
  const day = (now.getDay() + 6) % 7
  const d = new Date(now)
  d.setDate(now.getDate() - day + (day === 0 ? 0 : 7))
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}
function weeksLater(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n * 7 - 1)
  return d.toISOString().slice(0, 10)
}

export default function AdminSettings() {
  const [clusters, setClusters] = useState(null)
  const [saving, setSaving] = useState(null)
  const [toast, setToast] = useState(null)
  const [genFrom, setGenFrom] = useState(nextMonday())
  const [genWeeks, setGenWeeks] = useState(8)
  const [generating, setGenerating] = useState(null)

  const load = async () => {
    const { data, error } = await supabase
      .from('clusters')
      .select('id, name, default_capacity, slot_length_minutes, max_sessions_per_week, cancel_cutoff_minutes, campuses ( name )')
      .order('name')
    if (error) setToast({ kind: 'error', message: error.message })
    setClusters(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function save(cluster, patch) {
    setSaving(cluster.id)
    const { error } = await supabase.from('clusters').update(patch).eq('id', cluster.id)
    setSaving(null)
    if (error) setToast({ kind: 'error', message: error.message })
    else {
      setToast({ kind: 'success', message: 'Saved.' })
      load()
    }
  }

  async function generate(cluster) {
    setGenerating(cluster.id)
    const to = weeksLater(genFrom, genWeeks)
    const { data, error } = await supabase.rpc('generate_slots', {
      p_cluster_id: cluster.id,
      p_from: genFrom,
      p_to: to,
    })
    setGenerating(null)
    if (error) setToast({ kind: 'error', message: error.message })
    else setToast({ kind: 'success', message: `Created ${data} new slot(s) for ${cluster.name}.` })
  }

  if (clusters === null) return <Spinner />

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-medium text-ink mb-6">Settings</h1>

      <Panel className="p-4 mb-6">
        <h2 className="text-sm font-medium text-ink mb-3">Generate slots</h2>
        <p className="text-xs text-mute mb-4">
          Creates bookable slots from each cluster's day/night windows. Safe to run again later — existing slots are
          never duplicated.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="Starting Monday">
            <input
              type="date"
              className={inputCls}
              value={genFrom}
              onChange={(e) => setGenFrom(e.target.value)}
            />
          </Field>
          <Field label="Weeks">
            <input
              type="number"
              min={1}
              max={26}
              className={`${inputCls} w-20`}
              value={genWeeks}
              onChange={(e) => setGenWeeks(Number(e.target.value))}
            />
          </Field>
        </div>
      </Panel>

      <div className="space-y-4">
        {clusters.map((c) => (
          <Panel key={c.id} className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-ink">
                {c.campuses?.name} — {c.name}
              </h3>
              <Button
                variant="ghost"
                onClick={() => generate(c)}
                disabled={generating === c.id}
                className="!px-3 !py-1.5"
              >
                {generating === c.id ? 'Generating…' : 'Generate slots'}
              </Button>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <NumberSetting
                label="Max groups per slot"
                value={c.default_capacity}
                onSave={(v) => save(c, { default_capacity: v })}
                busy={saving === c.id}
              />
              <NumberSetting
                label="Slot length (minutes)"
                value={c.slot_length_minutes}
                onSave={(v) => save(c, { slot_length_minutes: v })}
                busy={saving === c.id}
              />
              <NumberSetting
                label="Max sessions / group / week"
                value={c.max_sessions_per_week}
                onSave={(v) => save(c, { max_sessions_per_week: v })}
                busy={saving === c.id}
              />
            </div>
          </Panel>
        ))}
      </div>

      <Toast {...toast} onClose={() => setToast(null)} />
    </div>
  )
}

function NumberSetting({ label, value, onSave, busy }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const dirty = Number(v) !== value
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          className={inputCls}
          value={v}
          onChange={(e) => setV(e.target.value)}
        />
        {dirty && (
          <Button onClick={() => onSave(Number(v))} disabled={busy} className="!px-3 !py-2 shrink-0">
            Save
          </Button>
        )}
      </div>
    </Field>
  )
}
