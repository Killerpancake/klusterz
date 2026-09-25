import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading, null = logged out
  const [profile, setProfile] = useState(null)
  const [group, setGroup] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      setGroup(null)
      return
    }
    setLoadingProfile(true)
    const { data: p } = await supabase
      .from('profiles')
      .select('user_id, role, group_id')
      .eq('user_id', userId)
      .maybeSingle()
    setProfile(p || null)

    if (p?.group_id) {
      const { data: g } = await supabase
        .from('groups')
        .select('id, name, night_opt_in, cluster_id, join_code, module_id')
        .eq('id', p.group_id)
        .maybeSingle()
      setGroup(g || null)
    } else {
      setGroup(null)
    }
    setLoadingProfile(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      loadProfile(data.session?.user?.id)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      loadProfile(sess?.user?.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const refreshGroup = useCallback(async () => {
    if (session?.user?.id) await loadProfile(session.user.id)
  }, [session, loadProfile])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    group,
    isAdmin: profile?.role === 'admin',
    loadingAuth: session === undefined || loadingProfile,
    refreshGroup,
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
