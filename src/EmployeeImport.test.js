import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { EmployeeImport } from './App'
import { useAuth } from './hooks/useAuth'

jest.mock('./hooks/useAuth', () => ({
  useAuth: jest.fn(),
  hasRole: (profile) => ['barista', 'manager', 'admin'].includes(profile?.role),
}))
jest.mock('./lib/supabase', () => ({ supabase: {} }))
jest.mock('./pages/ImportSales', () => () => <p>Import XML</p>)

global.IS_REACT_ACT_ENVIRONMENT = true
let container, root
beforeEach(() => { container = document.createElement('div'); root = createRoot(container) })
afterEach(() => { act(() => root.unmount()) })
function render(auth) {
  useAuth.mockReturnValue(auth)
  act(() => root.render(<MemoryRouter initialEntries={['/employes/importation']}>
    <Routes>
      <Route path="/employes/importation" element={<EmployeeImport />} />
      <Route path="/employes/connexion" element={<p>Connexion employés</p>} />
    </Routes>
  </MemoryRouter>))
}
test('visiteur redirigé vers la connexion dédiée', () => {
  render({ user: null, loading: false })
  expect(container.textContent).toContain('Connexion employés')
  expect(container.textContent).not.toContain('Import XML')
})
test.each(['barista', 'manager', 'admin'])('compte actif %s autorisé', role => {
  render({ user: { id: '1' }, profile: { role, name: 'Test', actif: true }, loading: false })
  expect(container.textContent).toContain('Import XML')
  expect(container.textContent).not.toContain('Finance')
})
test.each([{ role: 'barista', actif: false }, { role: 'unknown', actif: true }, null])('compte non autorisé bloqué', profile => {
  render({ user: { id: '1' }, profile, loading: false })
  expect(container.textContent).toContain('Compte non autorisé')
  expect(container.textContent).not.toContain('Import XML')
})
