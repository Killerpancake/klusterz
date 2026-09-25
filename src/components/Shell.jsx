import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block px-3 py-2 rounded-md text-sm transition ${
          isActive ? 'bg-panel2 text-ink' : 'text-mute hover:text-ink'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

export default function Shell() {
  const { isAdmin, group, signOut } = useAuth()

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <nav className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-line bg-base px-4 py-4 md:py-6 flex md:flex-col gap-1">
        <div className="mb-2 md:mb-6 px-3">
          <span className="font-mono text-sm tracking-tight text-ink">KlusterZ</span>
          {group && <div className="text-xs text-mute mt-0.5">{group.name}</div>}
          {isAdmin && <div className="text-xs text-open mt-0.5">admin</div>}
        </div>

        <div className="flex md:flex-col gap-1 flex-1 overflow-x-auto md:overflow-visible">
          {!isAdmin && (
            <>
              <NavItem to="/book">Book a slot</NavItem>
              <NavItem to="/bookings">My bookings</NavItem>
              <NavItem to="/timetable">Timetable</NavItem>
            </>
          )}
          {isAdmin && (
            <>
              <NavItem to="/admin/live">Live view</NavItem>
              <NavItem to="/admin/settings">Settings</NavItem>
            </>
          )}
        </div>

        <button
          onClick={signOut}
          className="hidden md:block text-left px-3 py-2 rounded-md text-sm text-mute hover:text-full transition mt-auto"
        >
          Sign out
        </button>
      </nav>

      <main className="flex-1 min-w-0 px-4 py-6 md:px-8 md:py-8">
        <Outlet />
      </main>
    </div>
  )
}
