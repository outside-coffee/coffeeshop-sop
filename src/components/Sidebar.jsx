import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import {
  BarChart2, CheckSquare, Coffee, Package,
  BookOpen, Star, Users, LogOut, MoreHorizontal, X, Shield, TrendingUp, ListChecks, Award, ClipboardList, UsersRound, Receipt, Wallet, Database
} from 'lucide-react'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Avatar } from './UI'

const PRIMARY_NAV = [
  { to: '/',          icon: BarChart2,   label: 'Dashboard',  minRole: 'barista' },
  { to: '/ouverture', icon: CheckSquare, label: 'Ouverture',  minRole: 'barista' },
  { to: '/fermeture', icon: CheckSquare, label: 'Fermeture',  minRole: 'barista' },
  { to: '/rapport',     icon: Coffee,      label: 'Shift',       minRole: 'barista' },
  { to: '/shift-matin', icon: CheckSquare, label: 'Fin matin',   minRole: 'barista' },
]

const MORE_NAV = [
  // Opérationnel
  { to: '/shift-matin',     icon: CheckSquare,  label: 'Fin shift matin', minRole: 'barista', section: 'Opérationnel' },
  { to: '/stock',           icon: Package,      label: 'Stock',         minRole: 'barista',  section: null },
  { to: '/recettes',        icon: BookOpen,     label: 'Recettes',      minRole: 'barista',  section: null },
  { to: '/standards',       icon: Star,         label: 'Standards',     minRole: 'barista',  section: null },
  // Analyse
  { to: '/ecarts',          icon: TrendingUp,   label: 'Écarts',        minRole: 'manager',  section: 'Analyse' },
  { to: '/performance',     icon: Award,        label: 'Performance',   minRole: 'manager',  section: null },
  { to: '/finance',         icon: Wallet,       label: 'Finance',       minRole: 'manager',  section: null },
  // Équipe
  { to: '/equipe',          icon: Users,        label: 'Équipe',        minRole: 'manager',  section: 'Équipe' },
  { to: '/staff',           icon: UsersRound,   label: 'Staff',         minRole: 'manager',  section: null },
  { to: '/admin-tasks',     icon: ClipboardList,label: 'Tâches admin',  minRole: 'manager',  section: null },
  // Administration
  { to: '/catalogue',       icon: Database,     label: 'Catalogue',     minRole: 'manager',  section: 'Administration' },
  { to: '/factures',        icon: Receipt,      label: 'Factures',      minRole: 'manager',  section: null },
  { to: '/checklist-admin', icon: ListChecks,   label: 'Listes',        minRole: 'admin',    section: null },
]

const ALL_NAV = [
  // Vue d'ensemble
  { to: '/',            icon: BarChart2,    label: 'Dashboard',     section: "Vue d'ensemble", minRole: 'barista'  },
  // Opérationnel
  { to: '/ouverture',   icon: CheckSquare,  label: 'Ouverture',     section: 'Opérationnel',   minRole: 'barista'  },
  { to: '/fermeture',   icon: CheckSquare,  label: 'Fermeture',     section: null,             minRole: 'barista'  },
  { to: '/rapport',     icon: Coffee,       label: 'Shift',         section: null,             minRole: 'barista'  },
  { to: '/shift-matin', icon: CheckSquare,  label: 'Fin shift matin', section: null,           minRole: 'barista'  },
  { to: '/stock',       icon: Package,      label: 'Stock',         section: null,             minRole: 'barista'  },
  { to: '/recettes',    icon: BookOpen,     label: 'Recettes',      section: null,             minRole: 'barista'  },
  { to: '/standards',   icon: Star,         label: 'Standards',     section: null,             minRole: 'barista'  },
  // Analyse
  { to: '/ecarts',      icon: TrendingUp,   label: 'Écarts',        section: 'Analyse',        minRole: 'manager'  },
  { to: '/performance', icon: Award,        label: 'Performance',   section: null,             minRole: 'manager'  },
  { to: '/finance',     icon: Wallet,       label: 'Finance',       section: null,             minRole: 'manager'  },
  // Équipe
  { to: '/equipe',      icon: Users,        label: 'Équipe',        section: 'Équipe',         minRole: 'manager'  },
  { to: '/staff',       icon: UsersRound,   label: 'Staff',         section: null,             minRole: 'manager'  },
  { to: '/admin-tasks', icon: ClipboardList,label: 'Tâches admin',  section: null,             minRole: 'manager'  },
  // Administration
  { to: '/catalogue',       icon: Database,  label: 'Catalogue',    section: 'Administration', minRole: 'manager'  },
  { to: '/factures',        icon: Receipt,   label: 'Factures',     section: null,             minRole: 'manager'  },
  { to: '/checklist-admin', icon: ListChecks,label: 'Listes',       section: null,             minRole: 'admin'    },
]

const ROLE_STYLES = {
  admin:   { label: 'Admin',   color: 'var(--outside-orange)' },
  manager: { label: 'Manager', color: 'var(--outside-amber)'  },
  barista: { label: 'Barista', color: 'rgba(255,255,255,0.4)' },
}

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const roleStyle = ROLE_STYLES[profile?.role] || ROLE_STYLES.barista

  const visiblePrimary = PRIMARY_NAV.filter(i => hasRole(profile, i.minRole))
  const visibleMore    = MORE_NAV.filter(i => hasRole(profile, i.minRole))
  const isMoreActive   = visibleMore.some(i => location.pathname === i.to)

  return (
    <>
      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Outside</h1>
          <span>Your Everyday Escape</span>
        </div>

        <nav className="sidebar-nav">
          {ALL_NAV.filter(i => hasRole(profile, i.minRole)).map(item => (
            <div key={item.to}>
              {item.section && <div className="nav-section-label">{item.section}</div>}
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
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
              <div style={{ fontSize: '0.65rem', color: roleStyle.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '3px' }}>
                {profile?.role === 'admin' && <Shield size={9} />}
                {roleStyle.label}
              </div>
            </div>
            <button className="btn btn-ghost btn-icon"
              style={{ color: 'rgba(255,255,255,0.4)', padding: '6px' }}
              onClick={handleSignOut}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MOBILE BOTTOM NAV ───────────────────────────────────────── */}
      <nav className="bottom-nav">
        {visiblePrimary.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <item.icon size={22} />
            {item.label}
          </NavLink>
        ))}

        {visibleMore.length > 0 && (
          <button
            className={`bottom-nav-item${isMoreActive || moreOpen ? ' active' : ''}`}
            onClick={() => setMoreOpen(o => !o)}
          >
            {moreOpen ? <X size={22} /> : <MoreHorizontal size={22} />}
            Plus
          </button>
        )}
      </nav>

      {/* ── MORE MENU ───────────────────────────────────────────────── */}
      {moreOpen && (
        <>
          <div className="more-overlay" onClick={() => setMoreOpen(false)} />
          <div className="more-menu">
            {visibleMore.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `more-menu-item${isActive ? ' active' : ''}`}
                onClick={() => setMoreOpen(false)}
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
            <button
              className="more-menu-item"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onClick={handleSignOut}
            >
              <LogOut size={18} />
              Deconnexion
            </button>
          </div>
        </>
      )}
    </>
  )
}
