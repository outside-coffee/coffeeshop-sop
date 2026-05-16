import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Coffee, CheckSquare, BarChart2, Package, BookOpen, LogOut, Menu as MenuIcon, X, Star, Users, Shield, UtensilsCrossed } from 'lucide-react'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Avatar } from './UI'

const navItems = [
  { to: '/',          icon: BarChart2,       label: 'Dashboard',      section: "Vue d'ensemble", minRole: 'barista' },
  { to: '/ouverture', icon: CheckSquare,     label: 'Ouverture',      section: 'Operations',     minRole: 'barista' },
  { to: '/fermeture', icon: CheckSquare,     label: 'Fermeture',      section: null,             minRole: 'barista' },
  { to: '/rapport',   icon: Coffee,          label: 'Rapport shift',  section: null,             minRole: 'barista' },
  { to: '/stock',     icon: Package,         label: 'Stock',          section: null,             minRole: 'barista' },
  { to: '/recettes',  icon: BookOpen,        label: 'Recettes',       section: null,             minRole: 'barista' },
  { to: '/standards', icon: Star,            label: 'Standards SOP',  section: null,             minRole: 'barista' },
  { to: '/equipe',    icon: Users,           label: 'Equipe',         section: 'Gestion',        minRole: 'manager' },
]

const ROLE_STYLES = {
  admin:   { label: 'Admin',   color: 'var(--outside-orange)' },
  manager: { label: 'Manager', color: 'var(--outside-amber)'  },
  barista: { label: 'Barista', color: 'rgba(255,255,255,0.4)' },
}

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const roleStyle = ROLE_STYLES[profile?.role] || ROLE_STYLES.barista

  const sidebarContent = (
    <>
      <div className="sidebar-logo">
        <h1>Outside</h1>
        <span>Your Everyday Escape</span>
      </div>

      <nav className="sidebar-nav">
        {navItems
          .filter(item => hasRole(profile, item.minRole))
          .map(item => (
            <div key={item.to}>
              {item.section && <div className="nav-section-label">{item.section}</div>}
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
              {profile?.name || '...'}
            </div>
            <div style={{ fontSize: '0.68rem', color: roleStyle.color, display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {profile?.role === 'admin' && <Shield size={9} />}
              {roleStyle.label}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon"
            style={{ color: 'rgba(255,255,255,0.4)', padding: '6px' }}
            onClick={handleSignOut} title="Se deconnecter">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      <div className="mobile-header">
        <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setMobileOpen(true)}>
          <MenuIcon size={20} />
        </button>
        <span style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>Outside</span>
      </div>

      <aside className={`sidebar${mobileOpen ? ' open' : ''}`}>
        {mobileOpen && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.75rem 1rem 0' }}>
            <button className="btn btn-ghost btn-icon" style={{ color: 'rgba(255,255,255,0.5)' }} onClick={() => setMobileOpen(false)}>
              <X size={18} />
            </button>
          </div>
        )}
        {sidebarContent}
      </aside>

      <div className={`overlay-bg${mobileOpen ? ' show' : ''}`} onClick={() => setMobileOpen(false)} />
    </>
  )
}
