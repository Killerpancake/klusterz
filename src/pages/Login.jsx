import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Button, Field, inputCls, Panel, Toast } from '../components/ui'

export default function Login() {
  const { session, loadingAuth } = useAuth()
  const [mode, setMode] = useState('signin') // signin | signup | reset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  if (!loadingAuth && session) return <Navigate to="/book" replace />

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setToast(null)

    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        setToast({
          kind: 'success',
          message: "If that email has an account, we've sent a reset link. Check your inbox.",
        })
        return
      }

      const { error } =
        mode === 'signin'
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
          : await supabase.auth.signUp({ email: email.trim(), password })
      if (error) throw error

      if (mode === 'signup') {
        setToast({ kind: 'success', message: 'Account created — you can sign in now.' })
        setMode('signin')
      }
    } catch (err) {
      setToast({ kind: 'error', message: err.message || 'Something went wrong. Please try again.' })
    } finally {
      setBusy(false)
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
            {mode !== 'reset' && (
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
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy
                ? 'Working…'
                : mode === 'signin'
                ? 'Sign in'
                : mode === 'signup'
                ? 'Create account'
                : 'Send reset link'}
            </Button>
          </form>

          {mode === 'signin' && (
            <button
              className="text-sm text-mute hover:text-ink mt-3 w-full text-center transition"
              onClick={() => {
                setMode('reset')
                setToast(null)
              }}
            >
              Forgot password?
            </button>
          )}

          <button
            className="text-sm text-mute hover:text-ink mt-2 w-full text-center transition"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setToast(null)
            }}
          >
            {mode === 'signin' && "Don't have an account? Sign up"}
            {mode === 'signup' && 'Already have an account? Sign in'}
            {mode === 'reset' && 'Back to sign in'}
          </button>
        </Panel>
      </div>
      <Toast {...toast} onClose={() => setToast(null)} />
    </div>
  )
}
