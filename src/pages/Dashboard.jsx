import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckSquare, AlertTriangle, Coffee, Package,
  ChevronRight, Check, Clock, MessageSquare, Sun, Moon
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Avatar, Badge } from '../components/UI'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function Dashboard() {
  const { profile } = useAuth()
  const [loading, setLoading]   = useState(true)
  const [data, setData]         = useState(null)

  useEffect(() => { fetchDashboard() }, [])

  async function fetchDashboard() {
    const today = format(new Date(), 'yyyy-MM-dd')

    const [sessionsRes, templatesRes, stockRes, reportsRes] = await Promise.all([
      supabase.from('checklist_sessions')
        .select('*, profiles(name, avatar_color)')
        .eq('date', today),
      supabase.from('checklist_templates')
        .select('id, type')
        .eq('active', true),
      supabase.from('stock_items')
        .select('id, name, current_qty, min_qty, unit')
        .eq('active', true),
      supabase.from('shift_reports')
        .select('*, profiles(name, avatar_color)')
        .eq('date', today)
        .order('created_at', { ascending: false }),
    ])

    const sessions  = sessionsRes.data  || []
    const templates = templatesRes.data || []
    const items     = stockRes.data     || []
    const reports   = reportsRes.data   || []

    const openingSession = sessions.find(s => s.type === 'opening')
    const closingSession = sessions.find(s => s.type === 'closing')
    const openingTotal   = templates.filter(t => t.type === 'opening').length
    const closingTotal   = templates.filter(t => t.type === 'closing').length

    // Compter les items cochés
    let openingChecked = 0, closingChecked = 0
    if (openingSession) {
      const { count } = await supabase.from('checklist_items')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', openingSession.id)
      openingChecked = count || 0
    }
    if (closingSession) {
      const { count } = await supabase.from('checklist_items')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', closingSession.id)
      closingChecked = count || 0
    }

    // Stock bas
    const lowStock = items.filter(i => i.current_qty <= i.min_qty)

    // Rapport du jour + consignes passation
    const latestReport = reports[0] || null

    setData({
      today,
      opening: {
        session:  openingSession,
        total:    openingTotal,
        checked:  openingChecked,
        done:     openingSession?.validated_at != null,
        by:       openingSession?.profiles,
      },
      closing: {
        session:  closingSession,
        total:    closingTotal,
        checked:  closingChecked,
        done:     closingSession?.validated_at != null,
        by:       closingSession?.profiles,
      },
      lowStock,
      reports,
      latestReport,
    })
    setLoading(false)
  }

  const now   = new Date()
  const hour  = now.getHours()
  const isMorning = hour < 14

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <Spinner size={32} />
    </div>
  )

  const { opening, closing, lowStock, latestReport, reports } = data

  return (
    <>
      {/* HEADER */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">
              {isMorning ? <Sun size={22} style={{ display: 'inline', marginRight: 8, color: 'var(--outside-amber)' }} /> : <Moon size={22} style={{ display: 'inline', marginRight: 8, color: 'var(--outside-teal)' }} />}
              {format(now, "EEEE d MMMM", { locale: fr })}
            </h1>
            <p className="page-subtitle">
              {isMorning ? 'Shift matin' : 'Shift soir'} · {format(now, 'HH:mm')}
            </p>
          </div>
          <Link to="/rapport" className="btn btn-primary btn-sm">
            <Coffee size={14} /> Rapport
          </Link>
        </div>
      </div>

      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* ── ALERTES STOCK ─────────────────────────────────────────── */}
        {lowStock.length > 0 && (
          <Link to="/stock" style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#FEF3DC',
              border: '1.5px solid #F5C96E',
              borderRadius: 'var(--radius-lg)',
              padding: '0.9rem 1.1rem',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <AlertTriangle size={20} color="var(--outside-amber)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.875rem', color: '#7A5000' }}>
                  {lowStock.length} produit{lowStock.length > 1 ? 's' : ''} en stock bas
                </div>
                <div style={{ fontSize: '0.78rem', color: '#9A6800', marginTop: '2px' }}>
                  {lowStock.slice(0, 3).map(i => i.name).join(', ')}
                  {lowStock.length > 3 && ` +${lowStock.length - 3} autres`}
                </div>
              </div>
              <ChevronRight size={16} color="var(--outside-amber)" />
            </div>
          </Link>
        )}

        {/* ── CHECKLISTS ────────────────────────────────────────────── */}
        <div className="section-label">Checklists du jour</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <ChecklistCard
            icon={<Sun size={16} />}
            label="Ouverture"
            data={opening}
            to="/ouverture"
            color="var(--outside-amber)"
          />
          <ChecklistCard
            icon={<Moon size={16} />}
            label="Fermeture"
            data={closing}
            to="/fermeture"
            color="var(--outside-teal)"
          />
        </div>

        {/* ── RAPPORT DU JOUR ───────────────────────────────────────── */}
        <div className="section-label">Rapport de shift</div>

        {latestReport ? (
          <div className="card">
            <div style={{ padding: '1rem 1.25rem' }}>
              {/* Header rapport */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {latestReport.profiles && (
                    <Avatar name={latestReport.profiles.name} color={latestReport.profiles.avatar_color} />
                  )}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{latestReport.profiles?.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                      {{ morning: 'Matin', afternoon: 'Apres-midi', full: 'Journee' }[latestReport.shift]}
                    </div>
                  </div>
                </div>
                <Badge color={latestReport.cash_status === 'ok' ? 'green' : latestReport.cash_status === 'missing' ? 'red' : 'blue'}>
                  Caisse {latestReport.cash_status === 'ok' ? 'OK' : latestReport.cash_status === 'missing' ? 'Manquant' : 'Excedent'}
                </Badge>
              </div>

              {/* Incidents */}
              {(latestReport.stock_issues || latestReport.equipment_issues || latestReport.customer_incidents) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '0.875rem' }}>
                  {latestReport.stock_issues && (
                    <IncidentRow icon="📦" label="Stock" text={latestReport.stock_issues} color="#FEF3DC" />
                  )}
                  {latestReport.equipment_issues && (
                    <IncidentRow icon="⚙️" label="Equipement" text={latestReport.equipment_issues} color="#FDEEEC" />
                  )}
                  {latestReport.customer_incidents && (
                    <IncidentRow icon="👤" label="Client" text={latestReport.customer_incidents} color="#EBF2FD" />
                  )}
                </div>
              )}

              {/* Consignes passation */}
              {latestReport.handover_notes && (
                <div style={{
                  background: 'var(--outside-cream)',
                  border: '1.5px solid var(--outside-cream2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 1rem',
                  display: 'flex', gap: '8px', alignItems: 'flex-start'
                }}>
                  <MessageSquare size={15} color="var(--outside-green)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--outside-green)', marginBottom: '3px' }}>
                      Consignes passation
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5 }}>
                      {latestReport.handover_notes}
                    </div>
                  </div>
                </div>
              )}

              {!latestReport.stock_issues && !latestReport.equipment_issues && !latestReport.customer_incidents && !latestReport.handover_notes && (
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                  Aucun incident signale
                </div>
              )}
            </div>
          </div>
        ) : (
          <Link to="/rapport" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'white',
              border: '1.5px dashed var(--outside-cream2)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              display: 'flex', alignItems: 'center', gap: '12px',
              color: 'var(--muted)',
            }}>
              <Coffee size={20} style={{ opacity: 0.4 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Rapport non rempli</div>
                <div style={{ fontSize: '0.78rem', marginTop: '2px' }}>Appuie pour remplir le rapport du shift</div>
              </div>
              <ChevronRight size={16} />
            </div>
          </Link>
        )}

        {/* ── HISTORIQUE PASSATIONS ─────────────────────────────────── */}
        {reports.length > 1 && (
          <>
            <div className="section-label">Passations recentes</div>
            <div className="card">
              {reports.slice(0, 4).map((r, i) => (
                <div key={r.id} style={{
                  padding: '0.75rem 1.25rem',
                  borderBottom: i < Math.min(reports.length, 4) - 1 ? '1.5px solid var(--outside-cream)' : 'none',
                  display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                  {r.profiles && <Avatar name={r.profiles.name} color={r.profiles.avatar_color} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{r.profiles?.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.handover_notes || 'Aucune consigne'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                      {{ morning: 'Matin', afternoon: 'Soir', full: 'Journee' }[r.shift]}
                    </div>
                    {(r.stock_issues || r.equipment_issues || r.customer_incidents) && (
                      <div style={{ marginTop: '2px' }}>
                        <Badge color="amber">Incidents</Badge>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── ACTIONS RAPIDES ───────────────────────────────────────── */}
        <div className="section-label">Acces rapide</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { to: '/stock',     icon: Package,     label: 'Stock',     sub: lowStock.length > 0 ? `${lowStock.length} alerte(s)` : 'Tout OK' },
            { to: '/recettes',  icon: Coffee,      label: 'Recettes',  sub: 'Preparations' },
            { to: '/standards', icon: CheckSquare, label: 'Standards', sub: 'SOP Outside' },
          ].map(item => (
            <Link key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: '0.9rem 1rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--outside-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <item.icon size={16} color="var(--outside-dark)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{item.sub}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </>
  )
}

// ── COMPOSANTS ────────────────────────────────────────────────────────────

function ChecklistCard({ icon, label, data, to, color }) {
  const pct    = data.total > 0 ? Math.round((data.checked / data.total) * 100) : 0
  const status = data.done ? 'done' : data.checked > 0 ? 'inprogress' : 'todo'

  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ padding: '1rem', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color, fontWeight: 800, fontSize: '0.8rem' }}>
            {icon} {label}
          </div>
          {status === 'done' && (
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--outside-green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={12} color="white" />
            </div>
          )}
          {status === 'inprogress' && <Clock size={16} color="var(--outside-amber)" />}
          {status === 'todo' && <ChevronRight size={16} color="var(--muted)" />}
        </div>

        <div className="progress" style={{ marginBottom: '6px' }}>
          <div className="progress-bar" style={{
            width: `${pct}%`,
            background: status === 'done' ? 'var(--outside-green)' : status === 'inprogress' ? 'var(--outside-amber)' : 'var(--outside-cream2)'
          }} />
        </div>

        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 700 }}>
          {status === 'done' ? (
            <span style={{ color: 'var(--outside-green)' }}>
              Valide {data.by?.name ? `par ${data.by.name}` : ''}
            </span>
          ) : (
            <span>{data.checked}/{data.total} taches</span>
          )}
        </div>
      </div>
    </Link>
  )
}

function IncidentRow({ icon, label, text, color }) {
  return (
    <div style={{
      background: color,
      borderRadius: 'var(--radius-sm)',
      padding: '6px 10px',
      display: 'flex', gap: '8px', alignItems: 'flex-start',
      fontSize: '0.82rem'
    }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <div>
        <span style={{ fontWeight: 800, marginRight: '6px' }}>{label}</span>
        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{text}</span>
      </div>
    </div>
  )
}
