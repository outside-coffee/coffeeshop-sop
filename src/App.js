import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { AuthProvider, useAuth, hasRole } from './hooks/useAuth'
import { ToastContainer } from './components/UI'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/Login'
import Dashboard from './pages/Dashboard'
import ChecklistPage from './pages/Checklist'
import ShiftReport from './pages/ShiftReport'
import Stock from './pages/Stock'
import Recipes from './pages/Recipes'
import Standards from './pages/Standards'
import Team from './pages/Team'
import Ecarts from './pages/Ecarts'
import Performance from './pages/Performance'
import ChecklistAdmin from './pages/ChecklistAdmin'
import AdminTasks from './pages/ChecklistAdmin2'
import Staff from './pages/Staff'
import Factures from './pages/Factures'
import Finance from './pages/Finance'
import Catalogue from './pages/Catalogue'
import Objectifs from './pages/Objectifs'
import { Spinner } from './components/UI'

function ProtectedLayout() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--cream)' }}>
      <Spinner size={40} />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ouverture" element={<ChecklistPage type="opening" />} />
          <Route path="/shift-matin" element={<ChecklistPage type="shift_end_morning" />} />
          <Route path="/fermeture" element={<ChecklistPage type="closing" />} />
          <Route path="/rapport" element={<ShiftReport />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/recettes" element={<Recipes />} />
          <Route path="/standards" element={<Standards />} />
          <Route path="/equipe" element={<RequireRole minRole="admin"><Team /></RequireRole>} />
          <Route path="/ecarts" element={<RequireRole minRole="manager"><Ecarts /></RequireRole>} />
          <Route path="/checklist-admin" element={<RequireRole minRole="admin"><ChecklistAdmin /></RequireRole>} />
          <Route path="/admin-tasks" element={<RequireRole minRole="manager"><AdminTasks /></RequireRole>} />
          <Route path="/staff" element={<RequireRole minRole="manager"><Staff /></RequireRole>} />
          <Route path="/factures" element={<RequireRole minRole="manager"><Factures /></RequireRole>} />
          <Route path="/finance" element={<RequireRole minRole="manager"><Finance /></RequireRole>} />
          <Route path="/catalogue" element={<RequireRole minRole="manager"><Catalogue /></RequireRole>} />
          <Route path="/performance" element={<RequireRole minRole="manager"><Performance /></RequireRole>} />
          <Route path="/objectifs" element={<RequireRole minRole="manager"><Objectifs /></RequireRole>} />
        </Routes>
      </main>
      <ToastContainer />
    </div>
  )
}

function RequireRole({ minRole, children }) {
  const { profile, loading } = useAuth()
  if (loading) return <Spinner size={32} />
  if (!hasRole(profile, minRole)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--cream)' }}>
      <Spinner size={40} />
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
