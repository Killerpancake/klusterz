import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, EmptyState, Panel, Spinner, Toast, inputCls } from '../components/ui'

export default function AdminGroups() {
  const [clusters, setClusters] = useState([])
  const [clusterId, setClusterId] = useState('all')
  const [rows, setRows] = useState(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => {
    supabase
      .from('clusters')
      .select('id, name, campuses ( name )')
      .then(({ data, error }) => {
        if (error) return setToast({ kind: 'error', message: error.message })
        setClusters(data || [])
      })
  }, [])

  const load = useCallback(async () => {
    setRows(null)
    let query = supabase
      .from('groups')
      .select('id, name, join_code, night_opt_in, members, cluster_id, clusters ( name, campuses ( name ) )')
      .order('name')
    if (clusterId !== 'all') query = query.eq('cluster_id', clusterId)
    const { data, error } = await query
    if (error) setToast({ kind: 'error', message: error.message })
    setRows(data || [])
  }, [clusterId])

  useEffect(() => {
    load()
  }, [load])

  async function copyCode(id, code) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500)
    } catch {
      setToast({ kind: 'error', message: 'Could not copy — select and copy manually.' })
    }
  }

  function copyAll() {
    const text = filtered
      .map((r) => `${r.name}\t${r.join_code}\t${(r.members || []).length} members`)
      .join('\n')
    navigator.clipboard
      .writeText(text)
      .then(() => setToast({ kind: 'success', message: `Copied ${filtered.length} join codes.` }))
      .catch(() => setToast({ kind: 'error', message: 'Could not copy — try again.' }))
  }

  const filtered = (rows || []).filter((r) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      r.name.toLowerCase().includes(q) ||
      r.join_code.toLowerCase().includes(q) ||
      (r.members || []).some((m) => m.toLowerCase().includes(q))
    )
  })

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg font-medium text-ink">Groups</h1>
          <p className="text-mute text-sm mt-1">Join codes for every group, and who's in each one.</p>
        </div>
        <Button variant="ghost" onClick={copyAll} disabled={filtered.length === 0} className="!px-3 !py-1.5">
          Copy all as list
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={clusterId}
          onChange={(e) => setClusterId(e.target.value)}
          className="bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-ink"
        >
          <option value="all">All clusters</option>
          {clusters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.campuses?.name} — {c.name}
            </option>
          ))}
        </select>
        <input
          className={`${inputCls} flex-1 min-w-[180px]`}
          placeholder="Search by group name, join code, or member…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {rows === null && <Spinner />}

      {rows && filtered.length === 0 && (
        <Panel>
          <EmptyState title="No groups found" body="Try a different search or cluster." />
        </Panel>
      )}

      {rows && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((r) => (
            <Panel key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-ink">{r.name}</span>
                    {r.night_opt_in && (
                      <span className="text-[11px] text-mute border border-line rounded-full px-2 py-0.5">
                        night on
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-mute mt-1">
                    {r.clusters?.campuses?.name} · {(r.members || []).length} member
                    {(r.members || []).length === 1 ? '' : 's'}
                  </div>
                  {r.members?.length > 0 && (
                    <div className="text-xs text-mute mt-1.5 truncate" title={r.members.join(', ')}>
                      {r.members.join(', ')}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => copyCode(r.id, r.join_code)}
                  className="shrink-0 font-mono text-sm bg-panel2 border border-line rounded-md px-3 py-1.5 text-ink hover:border-open transition"
                  title="Copy join code"
                >
                  {copiedId === r.id ? 'Copied' : r.join_code}
                </button>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Toast {...toast} onClose={() => setToast(null)} />
    </div>
  )
}
