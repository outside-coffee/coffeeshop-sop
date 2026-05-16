import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  Coffee, CheckSquare, BarChart2, Package,
  BookOpen, LogOut, Menu, X, Star
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Avatar } from './UI'

const navItems = [
  { to: '/', icon: BarChart2, label: 'Dashboard', section: 'Vue d\'ensemble' },
  { to: '/ouverture', icon: CheckSquare, label: 'Ouverture', section: 'Opérations' },
  { to: '/fermeture', icon: CheckSquare, label: 'Fermeture', section: null },
  { to: '/rapport', icon: Coffee, label: 'Rapport de shift', section: null },
  { to: '/stock', icon: Package, label: 'Stock', section: null },
  { to: '/recettes', icon: BookOpen, label: 'Recettes', section: null },
  { to: '/standards', icon: Star, label: 'Standards SOP', section: null },
]

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const sidebarContent = (
    <>
      <div className="sidebar-logo">
        <h1>☕ SOP Manager</h1>
        <span>Coffeeshop Operations</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item, i) => (
          <div key={item.to}>
            {item.section && (
              <div className="nav-section-label">{item.section}</div>
            )}
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip">
          <Avatar name={profile?.name || '?'} color={profile?.avatar_color} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.name || 'Chargement…'}
            </div>
            <div className="user-role">{profile?.role}</div>
          </div>
          <button
            className="btn btn-ghost btn-icon"
            style={{ color: 'var(--brown-300)', padding: '4px' }}
            onClick={handleSignOut}
            title="Se déconnecter"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile header */}
      <div className="mobile-header">
        <button
          className="btn btn-ghost btn-icon"
          style={{ color: 'white' }}
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={20} />
        </button>
        <span style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
          ☕ SOP Manager
        </span>
      </div>

      {/* Desktop sidebar */}
      <aside className={`sidebar${mobileOpen ? ' open' : ''}`}>
        {mobileOpen && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.75rem 1rem 0' }}>
            <button
              className="btn btn-ghost btn-icon"
              style={{ color: 'var(--brown-300)' }}
              onClick={() => setMobileOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      <div
        className={`overlay-bg${mobileOpen ? ' show' : ''}`}
        onClick={() => setMobileOpen(false)}
      />
    </>
  )
}
