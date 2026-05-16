import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckSquare, Coffee, Package, TrendingUp, AlertTriangle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Avatar, Badge } from '../components/UI'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function Dashboard() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    openingDone: false,
    closingDone: false,
    todayReport: null,
    lowStock: [],
    recentReports: [],
    openingProgress: 0,
    closingProgress: 0,
  })

  useEffect(() => { fetchDashboard() }, [])

  async function fetchDashboard() {
    const today = format(new Date(), 'yyyy-MM-dd')

    const [sessionsRes, stockRes, reportsRes, templatesRes] = await Promise.all([
      supabase.from('checklist_sessions').select('*, profiles(name, avatar_color)').eq('date', today),
      supabase.from('stock_items').select('*').eq('active', true),
      supabase.from('shift_reports').select('*, profiles(name, avatar_color)').order('created_at', { ascending: false }).limit(5),
      supabase.from('checklist_templates').select('*').eq('active', true),
    ])

    const sessions = sessionsRes.data || []
    const items = stockRes.data || []
    const templates = templatesRes.data || []

    // Progress for today's sessions
    const openingSession = sessions.find(s => s.type === 'opening')
    const closingSession = sessions.find(s => s.type === 'closing')
    const openingTotal = templates.filter(t => t.type === 'opening').length
    const closingTotal = templates.filter(t => t.type === 'closing').length

    let openingProgress = 0, closingProgress = 0
    if (openingSession) {
      const { count } = await supabase.from('checklist_items')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', openingSession.id)
      openingProgress = openingTotal > 0 ? Math.round((count / openingTotal) * 100) : 0
    }
    if (closingSession) {
      const { count } = await supabase.from('checklist_items')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', closingSession.id)
      closingProgress = closingTotal > 0 ? Math.round((count / closingTotal) * 100) : 0
    }

    const lowStock = items.filter(i => i.current_qty <= i.min_qty)
    const todayReport = (reportsRes.data || []).find(r => r.date === today)

    setData({
      openingDone: openingSession?.validated_at != null,
      closingDone: closingSession?.validated_at != null,
      todayReport,
      lowStock,
      recentReports: reportsRes.data || [],
      openingProgress,
      closingProgress,
    })
    setLoading(false)
  }

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  const dateStr = format(now, "EEEE d MMMM yyyy", { locale: fr })

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <Spinner size={32} />
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">{greeting}, {profile?.name?.split(' ')[0]} ☕</h1>
            <p className="page-subtitle" style={{ textTransform: 'capitalize' }}>{dateStr}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link to="/rapport" className="btn btn-primary">
              <Coffee size={15} />
              Rapport de shift
            </Link>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* ALERTS */}
        {data.lowStock.length > 0 && (
          <div style={{
            background: '#FEF3DC', border: '1px solid #F5C96E', borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem', display: 'flex', gap: '10px', alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <AlertTriangle size={18} color="var(--warning)" />
            <div>
              <strong style={{ fontSize: '0.875rem', color: '#7A5000' }}>
                {data.lowStock.length} produit{data.lowStock.length > 1 ? 's' : ''} en stock bas
              </strong>
              <span style={{ fontSize: '0.8rem', color: '#7A5000', marginLeft: '8px' }}>
                {data.lowStock.map(i => i.name).join(', ')}
              </span>
            </div>
            <Link to="/stock" className="btn btn-sm" style={{ marginLeft: 'auto', background: 'white', borderColor: 'var(--warning)', color: '#7A5000' }}>
              Voir le stock
            </Link>
          </div>
        )}

        {/* STAT CARDS */}
        <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="stat-label">Ouverture</span>
              {data.openingDone
                ? <Badge color="green">Validée</Badge>
                : data.openingProgress > 0
                  ? <Badge color="amber">En cours</Badge>
                  : <Badge color="gray">À faire</Badge>
              }
            </div>
            <div className="progress"><div className="progress-bar" style={{ width: `${data.openingProgress}%` }} /></div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '6px' }}>{data.openingProgress}% complété</div>
          </div>

          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="stat-label">Fermeture</span>
              {data.closingDone
                ? <Badge color="green">Validée</Badge>
                : data.closingProgress > 0
                  ? <Badge color="amber">En cours</Badge>
                  : <Badge color="gray">À faire</Badge>
              }
            </div>
            <div className="progress"><div className="progress-bar" style={{ width: `${data.closingProgress}%` }} /></div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '6px' }}>{data.closingProgress}% complété</div>
          </div>

          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="stat-label">Rapport shift</span>
              {data.todayReport
                ? <Badge color="green">Rempli</Badge>
                : <Badge color="gray">À faire</Badge>
              }
            </div>
            <div className="stat-value">{data.todayReport ? `${data.todayReport.ca}€` : '–'}</div>
            <div className="stat-label" style={{ marginTop: '4px' }}>{data.todayReport ? `${data.todayReport.covers} passages` : 'Pas encore de rapport'}</div>
          </div>

          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="stat-label">Alertes stock</span>
              {data.lowStock.length > 0
                ? <Badge color="red">{data.lowStock.length}</Badge>
                : <Badge color="green">OK</Badge>
              }
            </div>
            <div className="stat-value">{data.lowStock.length}</div>
            <div className="stat-label" style={{ marginTop: '4px' }}>produits sous le seuil</div>
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="section-label">Actions rapides</div>
        <div className="grid-2" style={{ marginBottom: '2rem' }}>
          <Link to="/ouverture" className="card" style={{ textDecoration: 'none', display: 'flex', gap: '1rem', padding: '1.25rem', alignItems: 'center', transition: 'box-shadow 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--brown-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckSquare size={20} color="var(--brown-600)" />
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Checklist ouverture</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Tâches du matin</div>
            </div>
          </Link>

          <Link to="/fermeture" className="card" style={{ textDecoration: 'none', display: 'flex', gap: '1rem', padding: '1.25rem', alignItems: 'center', transition: 'box-shadow 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--brown-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckSquare size={20} color="var(--brown-600)" />
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Checklist fermeture</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Tâches du soir</div>
            </div>
          </Link>

          <Link to="/stock" className="card" style={{ textDecoration: 'none', display: 'flex', gap: '1rem', padding: '1.25rem', alignItems: 'center', transition: 'box-shadow 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--brown-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={20} color="var(--brown-600)" />
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Contrôle stock</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                {data.lowStock.length > 0 ? `${data.lowStock.length} alerte(s)` : 'Tout est OK'}
              </div>
            </div>
          </Link>

          <Link to="/recettes" className="card" style={{ textDecoration: 'none', display: 'flex', gap: '1rem', padding: '1.25rem', alignItems: 'center', transition: 'box-shadow 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--brown-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Coffee size={20} color="var(--brown-600)" />
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Recettes</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Standards & grammages</div>
            </div>
          </Link>
        </div>

        {/* RECENT REPORTS */}
        {data.recentReports.length > 0 && (
          <>
            <div className="section-label">Derniers rapports de shift</div>
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Barista</th>
                      <th>Shift</th>
                      <th>CA</th>
                      <th>Passages</th>
                      <th>Caisse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentReports.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                          {format(new Date(r.date), 'dd/MM')}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {r.profiles && <Avatar name={r.profiles.name} color={r.profiles.avatar_color} size="sm" />}
                            <span style={{ fontSize: '0.875rem' }}>{r.profiles?.name || '–'}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                          {{ morning: 'Matin', afternoon: 'Après-midi', full: 'Journée' }[r.shift] || r.shift}
                        </td>
                        <td style={{ fontWeight: 500 }}>{r.ca ? `${r.ca}€` : '–'}</td>
                        <td>{r.covers || '–'}</td>
                        <td>
                          {r.cash_status === 'ok' && <Badge color="green">OK</Badge>}
                          {r.cash_status === 'surplus' && <Badge color="blue">Excédent</Badge>}
                          {r.cash_status === 'missing' && <Badge color="red">Manquant</Badge>}
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
