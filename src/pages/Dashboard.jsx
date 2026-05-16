import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckSquare, Coffee, Package, TrendingUp, TrendingDown, AlertTriangle, Target } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Avatar, Badge } from '../components/UI'
import { format, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function Dashboard() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    openingProgress: 0, closingProgress: 0,
    openingDone: false, closingDone: false,
    lowStock: [], todayReport: null,
    sales: null, objective: null,
    topProducts: [], weekSales: [],
    recentReports: [],
  })

  useEffect(() => { fetchDashboard() }, [])

  async function fetchDashboard() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const day7ago = format(subDays(new Date(), 6), 'yyyy-MM-dd')

    const [sessionsRes, stockRes, reportsRes, templatesRes, salesRes, objectifRes, topRes, weekRes] = await Promise.all([
      supabase.from('checklist_sessions').select('*, profiles(name, avatar_color)').eq('date', today),
      supabase.from('stock_items').select('*').eq('active', true),
      supabase.from('shift_reports').select('*, profiles(name, avatar_color)').order('created_at', { ascending: false }).limit(5),
      supabase.from('checklist_templates').select('*').eq('active', true),
      // CA du jour depuis transaction
      supabase.from('transaction')
        .select('total_ticket, qte_totale, id_ticket_compact')
        .eq('date_vente', today),
      // Objectif du jour
      supabase.from('objectifs_journaliers')
        .select('objectif_ca')
        .eq('date_objectif', today)
        .maybeSingle(),
      // Top produits du jour
      supabase.from('transaction_line')
        .select('produit, qte, total_ttc')
        .eq('date_vente', today),
      // CA 7 derniers jours
      supabase.from('v_ca_journalier')
        .select('date_vente, nb_tickets, ca_total')
        .gte('date_vente', day7ago)
        .order('date_vente', { ascending: true }),
    ])

    // Checklists
    const sessions = sessionsRes.data || []
    const templates = templatesRes.data || []
    const openingSession = sessions.find(s => s.type === 'opening')
    const closingSession = sessions.find(s => s.type === 'closing')
    const openingTotal = templates.filter(t => t.type === 'opening').length
    const closingTotal = templates.filter(t => t.type === 'closing').length

    let openingProgress = 0, closingProgress = 0
    if (openingSession) {
      const { count } = await supabase.from('checklist_items')
        .select('*', { count: 'exact', head: true }).eq('session_id', openingSession.id)
      openingProgress = openingTotal > 0 ? Math.round((count / openingTotal) * 100) : 0
    }
    if (closingSession) {
      const { count } = await supabase.from('checklist_items')
        .select('*', { count: 'exact', head: true }).eq('session_id', closingSession.id)
      closingProgress = closingTotal > 0 ? Math.round((count / closingTotal) * 100) : 0
    }

    // Ventes du jour
    const txLines = salesRes.data || []
    const sales = txLines.length > 0 ? {
      ca: txLines.reduce((s, r) => s + parseFloat(r.total_ticket || 0), 0),
      tickets: txLines.length,
      articles: txLines.reduce((s, r) => s + parseInt(r.qte_totale || 0), 0),
    } : null

    // Top produits du jour
    const lineMap = {}
    for (const l of (topRes.data || [])) {
      if (!lineMap[l.produit]) lineMap[l.produit] = { qte: 0, ca: 0 }
      lineMap[l.produit].qte += l.qte
      lineMap[l.produit].ca  += parseFloat(l.total_ttc || 0)
    }
    const topProducts = Object.entries(lineMap)
      .map(([produit, v]) => ({ produit, ...v }))
      .sort((a, b) => b.ca - a.ca)
      .slice(0, 5)

    setData({
      openingProgress, closingProgress,
      openingDone: openingSession?.validated_at != null,
      closingDone:  closingSession?.validated_at != null,
      lowStock: (stockRes.data || []).filter(i => i.current_qty <= i.min_qty),
      todayReport: (reportsRes.data || []).find(r => r.date === today) || null,
      recentReports: reportsRes.data || [],
      sales,
      objective: objectifRes.data?.objectif_ca || null,
      topProducts,
      weekSales: weekRes.data || [],
    })
    setLoading(false)
  }

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon apres-midi' : 'Bonsoir'
  const dateStr = format(now, "EEEE d MMMM yyyy", { locale: fr })

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <Spinner size={32} />
    </div>
  )

  const { sales, objective, topProducts, weekSales, lowStock } = data
  const caToday = sales?.ca || 0
  const objPct  = objective ? Math.min(100, Math.round((caToday / objective) * 100)) : null
  const maxWeekCA = weekSales.length ? Math.max(...weekSales.map(d => parseFloat(d.ca_total || 0))) : 1

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">{greeting}, {profile?.name?.split(' ')[0]} ☕</h1>
            <p className="page-subtitle" style={{ textTransform: 'capitalize' }}>{dateStr}</p>
          </div>
          <Link to="/rapport" className="btn btn-primary">
            <Coffee size={15} /> Rapport de shift
          </Link>
        </div>
      </div>

      <div className="page-content">

        {/* ALERTES */}
        {lowStock.length > 0 && (
          <div style={{ background: '#FEF3DC', border: '1px solid #F5C96E', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '1.5rem' }}>
            <AlertTriangle size={18} color="var(--warning)" />
            <div>
              <strong style={{ fontSize: '0.875rem', color: '#7A5000' }}>{lowStock.length} produit{lowStock.length > 1 ? 's' : ''} en stock bas</strong>
              <span style={{ fontSize: '0.8rem', color: '#7A5000', marginLeft: '8px' }}>{lowStock.map(i => i.name).join(', ')}</span>
            </div>
            <Link to="/stock" className="btn btn-sm" style={{ marginLeft: 'auto', background: 'white', borderColor: 'var(--warning)', color: '#7A5000' }}>Voir</Link>
          </div>
        )}

        {/* CA DU JOUR */}
        <div className="section-label">Ventes du jour</div>
        <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>

          {/* CA */}
          <div className="stat-card" style={{ gridColumn: 'span 1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="stat-label">CA du jour</span>
              {objective && (
                <span style={{ fontSize: '0.72rem', color: objPct >= 100 ? 'var(--success)' : 'var(--muted)' }}>
                  {objPct}% obj.
                </span>
              )}
            </div>
            <div className="stat-value">
              {caToday > 0 ? caToday.toFixed(1) : '—'}
              {caToday > 0 && <span style={{ fontSize: '0.9rem', color: 'var(--muted)', marginLeft: '4px' }}>DT</span>}
            </div>
            {objective && (
              <div style={{ marginTop: '8px' }}>
                <div className="progress" style={{ height: '4px' }}>
                  <div className="progress-bar" style={{ width: `${objPct}%`, background: objPct >= 100 ? 'var(--success)' : 'var(--accent)' }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '3px' }}>
                  Objectif : {objective} DT
                </div>
              </div>
            )}
          </div>

          {/* TICKETS */}
          <div className="stat-card">
            <span className="stat-label">Tickets</span>
            <div className="stat-value">{sales?.tickets ?? '—'}</div>
            <div className="stat-label" style={{ marginTop: '4px' }}>
              {sales?.tickets ? `moy. ${(caToday / sales.tickets).toFixed(1)} DT` : 'Pas de ventes'}
            </div>
          </div>

          {/* ARTICLES */}
          <div className="stat-card">
            <span className="stat-label">Articles vendus</span>
            <div className="stat-value">{sales?.articles ?? '—'}</div>
            <div className="stat-label" style={{ marginTop: '4px' }}>
              {sales?.articles && sales?.tickets ? `${(sales.articles / sales.tickets).toFixed(1)} / ticket` : ''}
            </div>
          </div>

          {/* CHECKLISTS */}
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span className="stat-label">Ouverture</span>
              <Badge color={data.openingDone ? 'green' : data.openingProgress > 0 ? 'amber' : 'gray'}>
                {data.openingDone ? 'OK' : `${data.openingProgress}%`}
              </Badge>
            </div>
            <div className="progress" style={{ marginBottom: '8px' }}>
              <div className="progress-bar" style={{ width: `${data.openingProgress}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="stat-label">Fermeture</span>
              <Badge color={data.closingDone ? 'green' : data.closingProgress > 0 ? 'amber' : 'gray'}>
                {data.closingDone ? 'OK' : `${data.closingProgress}%`}
              </Badge>
            </div>
            <div className="progress" style={{ marginTop: '6px' }}>
              <div className="progress-bar" style={{ width: `${data.closingProgress}%` }} />
            </div>
          </div>
        </div>

        {/* CA 7 JOURS */}
        {weekSales.length > 0 && (
          <>
            <div className="section-label">7 derniers jours</div>
            <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
                {weekSales.map((d, i) => {
                  const ca    = parseFloat(d.ca_total || 0)
                  const pct   = maxWeekCA > 0 ? Math.round((ca / maxWeekCA) * 100) : 0
                  const isToday = d.date_vente === format(new Date(), 'yyyy-MM-dd')
                  const label = format(new Date(d.date_vente + 'T00:00:00'), 'EEE', { locale: fr })
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ fontSize: '0.62rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {ca > 0 ? `${ca.toFixed(0)}` : ''}
                      </div>
                      <div style={{
                        width: '100%', height: `${Math.max(pct, 4)}%`,
                        background: isToday ? 'var(--accent)' : 'var(--brown-200)',
                        borderRadius: '3px 3px 0 0',
                        minHeight: '4px',
                        transition: 'height 0.3s',
                      }} />
                      <div style={{ fontSize: '0.65rem', color: isToday ? 'var(--accent)' : 'var(--muted)', fontWeight: isToday ? 600 : 400, textTransform: 'capitalize' }}>
                        {label}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>

          {/* TOP PRODUITS */}
          {topProducts.length > 0 && (
            <div>
              <div className="section-label">Top produits aujourd'hui</div>
              <div className="card">
                <div style={{ padding: '0.25rem 1.5rem' }}>
                  {topProducts.map((p, i) => {
                    const maxCa = topProducts[0].ca
                    const pct   = maxCa > 0 ? Math.round((p.ca / maxCa) * 100) : 0
                    return (
                      <div key={i} style={{ padding: '0.6rem 0', borderBottom: i < topProducts.length - 1 ? '1px solid var(--brown-50)' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600, width: '14px' }}>{i + 1}</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{p.produit}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--brown-700)' }}>{p.ca.toFixed(1)} DT</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: '6px' }}>x{p.qte}</span>
                          </div>
                        </div>
                        <div className="stock-bar">
                          <div className="stock-fill ok" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ACTIONS RAPIDES */}
          <div>
            <div className="section-label">Actions rapides</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { to: '/ouverture', icon: CheckSquare, label: 'Checklist ouverture', sub: 'Tâches du matin' },
                { to: '/fermeture', icon: CheckSquare, label: 'Checklist fermeture', sub: 'Tâches du soir' },
                { to: '/stock',     icon: Package,     label: 'Contrôle stock',      sub: lowStock.length > 0 ? `${lowStock.length} alerte(s)` : 'Tout OK' },
                { to: '/menu',      icon: Coffee,      label: 'Menu & Tarifs',        sub: 'Carte Outside' },
              ].map(item => (
                <Link key={item.to} to={item.to} className="card"
                  style={{ textDecoration: 'none', display: 'flex', gap: '12px', padding: '0.9rem 1.25rem', alignItems: 'center', transition: 'box-shadow 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--brown-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <item.icon size={17} color="var(--brown-600)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{item.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.sub}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* DERNIERS RAPPORTS */}
        {data.recentReports.length > 0 && (
          <>
            <div className="section-label">Derniers rapports de shift</div>
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th><th>Barista</th><th>Shift</th>
                      <th>CA</th><th>Passages</th><th>Caisse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentReports.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{format(new Date(r.date), 'dd/MM')}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {r.profiles && <Avatar name={r.profiles.name} color={r.profiles.avatar_color} size="sm" />}
                            <span style={{ fontSize: '0.875rem' }}>{r.profiles?.name || '—'}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                          {{ morning: 'Matin', afternoon: 'Apres-midi', full: 'Journee' }[r.shift] || r.shift}
                        </td>
                        <td style={{ fontWeight: 500 }}>{r.ca ? `${r.ca} DT` : '—'}</td>
                        <td>{r.covers || '—'}</td>
                        <td>
                          {r.cash_status === 'ok'      && <Badge color="green">OK</Badge>}
                          {r.cash_status === 'surplus'  && <Badge color="blue">Excedent</Badge>}
                          {r.cash_status === 'missing'  && <Badge color="red">Manquant</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
