import { useText } from '../lib/language-context'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useWorkshop } from './workshop-context'
import AppShell from './AppShell'
import JobsScreen from '../features/jobs/JobsScreen'
import EstimatesScreen from '../features/estimates/EstimatesScreen'
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
  return <BrowserRouter><Routes><Route element={<AppShell />}><Route index element={<JobsScreen overview />} /><Route path="jobs" element={<JobsScreen />} /><Route path="estimates" element={<EstimatesScreen />} /><Route path="parts" element={<PartsScreen />} /><Route path="customers" element={<CustomersScreen />} /><Route path="reports" element={<ReportsScreen />} /><Route path="settings" element={<SettingsScreen />} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes></BrowserRouter>
}
