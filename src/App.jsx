import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Shell from './components/Shell'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import JoinGroup from './pages/JoinGroup'
import Book from './pages/Book'
import MyBookings from './pages/MyBookings'
import Timetable from './pages/Timetable'
import AdminLive from './pages/AdminLive'
import AdminSettings from './pages/AdminSettings'
import { Spinner } from './components/ui'

function Gate({ children }) {
  const { loadingAuth, session } = useAuth()
  if (loadingAuth) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  return children
}

function NeedsGroup({ children }) {
  const { loadingAuth, group, isAdmin } = useAuth()
  if (loadingAuth) return <Spinner />
  if (isAdmin) return <Navigate to="/admin/live" replace />
  if (!group) return <Navigate to="/join" replace />
  return children
}

function NeedsAdmin({ children }) {
  const { loadingAuth, isAdmin } = useAuth()
  if (loadingAuth) return <Spinner />
  if (!isAdmin) return <Navigate to="/book" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          element={
            <Gate>
              <Shell />
            </Gate>
          }
        >
          <Route path="/join" element={<JoinGroup />} />
          <Route
            path="/book"
            element={
              <NeedsGroup>
                <Book />
              </NeedsGroup>
            }
          />
          <Route
            path="/bookings"
            element={
              <NeedsGroup>
                <MyBookings />
              </NeedsGroup>
            }
          />
          <Route
            path="/timetable"
            element={
              <NeedsGroup>
                <Timetable />
              </NeedsGroup>
            }
          />
          <Route
            path="/admin/live"
            element={
              <NeedsAdmin>
                <AdminLive />
              </NeedsAdmin>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <NeedsAdmin>
                <AdminSettings />
              </NeedsAdmin>
            }
          />
          <Route path="*" element={<Navigate to="/book" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
