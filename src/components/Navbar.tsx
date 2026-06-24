import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { BUILD_VERSION, BRAND } from '../version'

const links = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/travel', label: 'Travel' },
  { to: '/membership', label: 'Membership' },
]

export default function Navbar() {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-20 border-b border-brand-200 bg-brand-50/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src="/doodle.svg" alt={BRAND} className="h-8 w-8" />
          <span className="text-lg font-semibold tracking-tight text-brand-900">
            {BRAND}
          </span>
        </Link>

        <ul className="ml-4 hidden items-center gap-1 sm:flex">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-brand-100 text-brand-900'
                      : 'text-brand-700 hover:bg-white hover:text-brand-900'
                  }`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-3">
          {/* BUILD_VERSION — confirm what Cloudflare is serving */}
          <span
            title="Build version"
            className="rounded-md border border-brand-200 bg-white px-2 py-1 font-mono text-xs text-brand-600"
          >
            {BUILD_VERSION}
          </span>
          <span className="hidden text-sm text-brand-600 md:inline">
            {user?.email}
          </span>
          <button onClick={handleSignOut} className="btn-ghost text-sm">
            Sign out
          </button>
        </div>
      </nav>
    </header>
  )
}
