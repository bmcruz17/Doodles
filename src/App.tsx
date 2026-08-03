import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { registerPush } from './lib/push'
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
import CreatePetChat from './pages/CreatePetChat'
import Partner from './pages/Partner'
import Feed from './pages/Feed'
import Sitters from './pages/Sitters'
import Friends from './pages/Friends'
import Admin from './pages/Admin'
import Creator from './pages/Creator'
import WearableHealth from './pages/WearableHealth'
import Shop from './pages/Shop'
import Account from './pages/Account'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import PackProfileEdit from './pages/PackProfileEdit'
import PackProfileView from './pages/PackProfileView'

export default function App() {
  const { loading, user } = useAuth()

  // Register for push notifications on the native app once signed in (no-op on web).
  useEffect(() => {
    if (user) registerPush(user.id)
  }, [user])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-brand-700">
        Loading…
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/profile" element={<PackProfileEdit />} />
        <Route path="/u/:handle" element={<PackProfileView />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/creator" element={<Creator />} />
        <Route path="/pets/new" element={<CreatePetChat />} />
        <Route path="/pets/new/form" element={<CreatePet />} />
        <Route path="/pets/:petId" element={<PetDetail />} />
        <Route path="/pets/:petId/vault" element={<HealthVault />} />
        <Route path="/pets/:petId/companion" element={<AICompanion />} />
        <Route path="/pets/:petId/health" element={<WearableHealth />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/partner" element={<Partner />} />
        <Route path="/sitters" element={<Sitters />} />
        <Route path="/travel" element={<Travel />} />
        <Route path="/membership" element={<Membership />} />
        <Route path="/account" element={<Account />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
