import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button, Field, inputCls, Panel, Toast } from '../components/ui'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Clicking the emailed link redirects here with a recovery code in the URL;
    // supabase-js exchanges it for a temporary session automatically and fires
    // this event once that's done. Until then the form stays hidden so a stray
    // visit to this URL can't be used to change someone else's password.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function submit(e) {
    e.preventDefault()
    if (password !== confirm) {
      setToast({ kind: 'error', message: "Passwords don't match." })
      return
    }
    setBusy(true)
    setToast(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setToast({ kind: 'error', message: error.message })
    } else {
      setDone(true)
      setTimeout(() => navigate('/book'), 1500)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-mono text-xl text-ink mb-1">KlusterZ</h1>
          <p className="text-mute text-sm">Set a new password</p>
        </div>

        <Panel className="p-6">
          {!ready && !done && (
            <p className="text-sm text-mute text-center py-4">
              Opening this link should sign you in automatically — waiting on that now. If nothing happens after a
              few seconds, the link may have expired; request a new one from the sign-in page.
            </p>
          )}

          {ready && !done && (
            <form onSubmit={submit} className="space-y-4">
              <Field label="New password" hint="At least 6 characters">
                <input
                  type="password"
                  required
                  minLength={6}
                  className={inputCls}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm password">
                <input
                  type="password"
                  required
                  minLength={6}
                  className={inputCls}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Saving…' : 'Save new password'}
              </Button>
            </form>
          )}

          {done && <p className="text-sm text-open text-center py-4">Password updated — taking you in…</p>}
        </Panel>
      </div>
      <Toast {...toast} onClose={() => setToast(null)} />
    </div>
  )
}
