import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Button, Field, inputCls, Panel, Toast } from '../components/ui'

export default function Login() {
  const { session, loadingAuth } = useAuth()
  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  if (!loadingAuth && session) return <Navigate to="/book" replace />

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setToast(null)
    const fn = mode === 'signin' ? supabase.auth.signInWithPassword : supabase.auth.signUp
    const { error } = await fn({ email: email.trim(), password })
    setBusy(false)
    if (error) {
      setToast({ kind: 'error', message: error.message })
    } else if (mode === 'signup') {
      setToast({ kind: 'success', message: 'Account created — you can sign in now.' })
      setMode('signin')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-mono text-xl text-ink mb-1">KlusterZ</h1>
          <p className="text-mute text-sm">Cluster time-slot booking</p>
        </div>

        <Panel className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <input
                type="email"
                required
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </Field>
            <Field label="Password" hint={mode === 'signup' ? 'At least 6 characters' : undefined}>
              <input
                type="password"
                required
                minLength={6}
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </Field>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <button
            className="text-sm text-mute hover:text-ink mt-4 w-full text-center transition"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </Panel>
      </div>
      <Toast {...toast} onClose={() => setToast(null)} />
    </div>
  )
}
