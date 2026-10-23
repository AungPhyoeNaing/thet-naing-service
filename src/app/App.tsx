import { useText } from '../lib/language-context'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useOutletContext } from 'react-router-dom'
import { useWorkshop } from './workshop-context'
import AppShell, { type AppActions } from './AppShell'
import JobsScreen from '../features/jobs/JobsScreen'
import PartsScreen from '../features/parts/PartsScreen'
import CustomersScreen from '../features/customers/CustomersScreen'
import ReportsScreen from '../features/reports/ReportsScreen'
import SettingsScreen from '../features/settings/SettingsScreen'
import LoginScreen from '../features/auth/LoginScreen'
import { Wrench } from 'lucide-react'
export default function App() {
  const tr = useText()

  const { signedIn, loading } = useWorkshop()
  if (!signedIn && !loading) return <LoginScreen />
  if (loading) return <div className="splash"><Wrench size={36} /><p>{tr("Opening the workshop…")}</p></div>
  return <BrowserRouter><Routes><Route element={<AppShell />}><Route index element={<JobsScreen key="today" overview />} /><Route path="jobs" element={<JobsScreen key="repairs" />} /><Route path="estimates" element={<Navigate to="/jobs" replace />} /><Route element={<AdminRoute />}><Route path="parts" element={<PartsScreen />} /><Route path="customers" element={<CustomersScreen />} /><Route path="reports" element={<ReportsScreen />} /><Route path="settings" element={<SettingsScreen />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes></BrowserRouter>
}
function AdminRoute() {
  const { isAdmin } = useWorkshop()
  const actions = useOutletContext<AppActions>()
  return isAdmin ? <Outlet context={actions} /> : <Navigate to="/" replace />
}
