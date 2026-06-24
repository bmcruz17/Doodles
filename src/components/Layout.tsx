import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import BottomNav from './BottomNav'

export default function Layout() {
  return (
    <div className="min-h-screen bg-brand-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:pb-8">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
