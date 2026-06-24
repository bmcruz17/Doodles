import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Dashboard from './pages/Dashboard'
import PetDetail from './pages/PetDetail'
import HealthVault from './pages/HealthVault'
import AICompanion from './pages/AICompanion'
import Marketplace from './pages/Marketplace'
import Travel from './pages/Travel'
import Membership from './pages/Membership'
import CreatePet from './pages/CreatePet'

export default function App() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-brand-200">
        Loading…
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pets/new" element={<CreatePet />} />
        <Route path="/pets/:petId" element={<PetDetail />} />
        <Route path="/pets/:petId/vault" element={<HealthVault />} />
        <Route path="/pets/:petId/companion" element={<AICompanion />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/travel" element={<Travel />} />
        <Route path="/membership" element={<Membership />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
