import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import {
  BarChart2, CheckSquare, Coffee, Package,
  BookOpen, Star, Users, LogOut, MoreHorizontal, X, Shield,
  TrendingUp, ListChecks, Award, ClipboardList, UsersRound,
  Receipt, Wallet, Database, ChevronRight
} from 'lucide-react'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Avatar } from './UI'

// ── BOTTOM NAV MOBILE (4 items max) ─────────────────────────────────────
const PRIMARY_NAV = [
  { to: '/',            icon: BarChart2,   label: 'Dashboard',  minRole: 'barista' },
  { to: '/ouverture',   icon: CheckSquare, label: 'Ouverture',  minRole: 'barista' },
  { to: '/shift-matin', icon: CheckSquare, label: 'Fin matin',  minRole: 'barista' },
  { to: '/fermeture',   icon: CheckSquare, label: 'Fermeture',  minRole: 'barista' },
]

// ── MENU "PLUS" — organisé par sections ──────────────────────────────────
const MORE_SECTIONS = [
  {
    label: 'Opérationnel',
    minRole: 'barista',
    items: [
      { to: '/rapport',     icon: Coffee,       label: 'Rapport shift',   minRole: 'barista' },
      { to: '/stock',       icon: Package,      label: 'Stock',           minRole: 'barista' },
      { to: '/recettes',    icon: BookOpen,     label: 'Recettes',        minRole: 'barista' },
      { to: '/standards',   icon: Star,         label: 'Standards',       minRole: 'barista' },
    ]
  },
  {
    label: 'Analyse',
    minRole: 'manager',
    items: [
      { to: '/ecarts',      icon: TrendingUp,   label: 'Écarts',         minRole: 'manager' },
      { to: '/performance', icon: Award,        label: 'Performance',    minRole: 'manager' },
    ]
  },
  {
    label: 'Équipe',
    minRole: 'manager',
    items: [
      { to: '/staff',       icon: UsersRound,   label: 'Staff',          minRole: 'manager' },
    ]
  },
  {
    label: 'Administration',
    minRole: 'manager',
    items: [
      { to: '/finance',         icon: Wallet,       label: 'Finance',          minRole: 'manager' },
      { to: '/admin-tasks',     icon: ClipboardList,label: 'Tâches admin',     minRole: 'manager' },
      { to: '/equipe',          icon: Users,        label: 'Comptes équipe',   minRole: 'admin'   },
      { to: '/catalogue',       icon: Database,     label: 'Catalogue',        minRole: 'manager' },
      { to: '/factures',        icon: Receipt,      label: 'Factures',         minRole: 'manager' },
      { to: '/checklist-admin', icon: ListChecks,   label: 'Gérer les listes', minRole: 'admin'   },
    ]
  },
]

// ── DESKTOP SIDEBAR — flat list avec sections ────────────────────────────
const ALL_NAV = [
  { to: '/',            icon: BarChart2,    label: 'Dashboard',      section: "Vue d'ensemble", minRole: 'barista'  },
  { to: '/ouverture',   icon: CheckSquare,  label: 'Ouverture',      section: 'Opérationnel',   minRole: 'barista'  },
  { to: '/shift-matin', icon: CheckSquare,  label: 'Fin shift matin',section: null,             minRole: 'barista'  },
  { to: '/rapport',     icon: Coffee,       label: 'Shift',          section: null,             minRole: 'barista'  },
  { to: '/fermeture',   icon: CheckSquare,  label: 'Fermeture',      section: null,             minRole: 'barista'  },
  { to: '/stock',       icon: Package,      label: 'Stock',          section: null,             minRole: 'barista'  },
  { to: '/recettes',    icon: BookOpen,     label: 'Recettes',       section: null,             minRole: 'barista'  },
  { to: '/standards',   icon: Star,         label: 'Standards',      section: null,             minRole: 'barista'  },
  { to: '/ecarts',      icon: TrendingUp,   label: 'Écarts',           section: 'Analyse',        minRole: 'manager'  },
  { to: '/performance', icon: Award,        label: 'Performance',      section: null,             minRole: 'manager'  },
  { to: '/equipe',      icon: Users,        label: 'Comptes équipe',   section: 'Administration', minRole: 'admin'    },
  { to: '/staff',       icon: UsersRound,   label: 'Staff',            section: 'Équipe',         minRole: 'manager'  },
  { to: '/finance',         icon: Wallet,       label: 'Finance',          section: 'Administration', minRole: 'manager'  },
  { to: '/admin-tasks',     icon: ClipboardList,label: 'Tâches admin',     section: null,             minRole: 'manager'  },
  { to: '/catalogue',       icon: Database,     label: 'Catalogue',        section: null,             minRole: 'manager'  },
  { to: '/factures',        icon: Receipt,      label: 'Factures',         section: null,             minRole: 'manager'  },
  { to: '/checklist-admin', icon: ListChecks,   label: 'Gérer les listes', section: null,             minRole: 'admin'    },
]

const ROLE_STYLES = {
  admin:   { label: 'Admin',   color: 'var(--outside-amber)'  },
  manager: { label: 'Manager', color: 'var(--outside-amber)'  },
  barista: { label: 'Barista', color: 'rgba(255,255,255,0.4)' },
}

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const roleStyle = ROLE_STYLES[profile?.role] || ROLE_STYLES.barista

  const visiblePrimary = PRIMARY_NAV.filter(i => hasRole(profile, i.minRole))
  const allMoreItems   = MORE_SECTIONS.flatMap(s => s.items)
  const isMoreActive   = allMoreItems.some(i => location.pathname === i.to)

  return (
    <>
      {/* ── DESKTOP SIDEBAR ────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Outside</h1>
          <span>Your Everyday Escape</span>
        </div>

        <nav className="sidebar-nav">
          {ALL_NAV.filter(i => hasRole(profile, i.minRole)).map(item => (
            <div key={item.to}>
              {item.section && <div className="nav-section-label">{item.section}</div>}
              <NavLink to={item.to} end={item.to === '/'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
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

      {/* ── MOBILE BOTTOM NAV ──────────────────────────────────────── */}
      <nav className="bottom-nav">
        {visiblePrimary.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
            <item.icon size={22} />
            {item.label}
          </NavLink>
        ))}
        <button
          className={`bottom-nav-item${isMoreActive || moreOpen ? ' active' : ''}`}
          onClick={() => setMoreOpen(o => !o)}>
          {moreOpen ? <X size={22} /> : <MoreHorizontal size={22} />}
          Plus
        </button>
      </nav>

      {/* ── MORE MENU — avec sections ───────────────────────────────── */}
      {moreOpen && (
        <>
          <div className="more-overlay" onClick={() => setMoreOpen(false)} />
          <div className="more-menu" style={{ overflowY: 'auto', maxHeight: 'calc(100dvh - 80px - env(safe-area-inset-bottom))' }}>

            {/* Header utilisateur */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <Avatar name={profile?.name || '?'} color={profile?.avatar_color} size={32} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}>{profile?.name}</div>
                <div style={{ fontSize: '0.68rem', color: roleStyle.color, fontWeight: 700, textTransform: 'uppercase' }}>
                  {profile?.role === 'admin' && <Shield size={9} style={{ display: 'inline', marginRight: 3 }} />}
                  {roleStyle.label}
                </div>
              </div>
            </div>

            {/* Sections */}
            {MORE_SECTIONS.filter(s => hasRole(profile, s.minRole)).map(section => {
              const items = section.items.filter(i => hasRole(profile, i.minRole))
              if (!items.length) return null
              return (
                <div key={section.label}>
                  <div style={{ padding: '10px 16px 4px', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)' }}>
                    {section.label}
                  </div>
                  {items.map(item => (
                    <NavLink key={item.to} to={item.to}
                      className={({ isActive }) => `more-menu-item${isActive ? ' active' : ''}`}
                      onClick={() => setMoreOpen(false)}>
                      <item.icon size={17} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      <ChevronRight size={13} style={{ opacity: 0.3 }} />
                    </NavLink>
                  ))}
                </div>
              )
            })}

            {/* Déconnexion */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '6px', paddingTop: '6px' }}>
              <button className="more-menu-item" style={{ color: 'rgba(255,255,255,0.5)', width: '100%' }} onClick={handleSignOut}>
                <LogOut size={17} />
                <span style={{ flex: 1 }}>Déconnexion</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
