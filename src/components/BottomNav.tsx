import { NavLink } from 'react-router-dom'

// App-style bottom tab bar for phones (hidden on >= sm, where the top nav shows).
const tabs = [
  { to: '/feed', label: 'Home', icon: FeedIcon, end: true },
  { to: '/dashboard', label: 'Pets', icon: PawIcon, end: true },
  { to: '/marketplace', label: 'Services', icon: ShopIcon },
  { to: '/travel', label: 'Travel', icon: PlaneIcon },
  { to: '/membership', label: 'Member', icon: StarIcon },
]

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-200 bg-white/95 backdrop-blur sm:hidden">
      <ul className="mx-auto flex max-w-md">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                  isActive ? 'text-sky-600' : 'text-brand-500'
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

const svg = 'h-6 w-6'

function PawIcon() {
  return (
    <svg className={svg} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="7" cy="9" r="1.8" />
      <circle cx="11" cy="6.5" r="1.8" />
      <circle cx="15.5" cy="7.5" r="1.8" />
      <circle cx="18" cy="11.5" r="1.6" />
      <path d="M12 12c-2.6 0-4.7 1.9-4.7 4 0 1.6 1.3 2.4 2.8 2.4.9 0 1.3-.3 1.9-.3s1 .3 1.9.3c1.5 0 2.8-.8 2.8-2.4 0-2.1-2.1-4-4.7-4Z" />
    </svg>
  )
}
function FeedIcon() {
  return (
    <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M4 15l4-3 3 2 4-4 5 4" />
      <circle cx="9" cy="9" r="1.4" />
    </svg>
  )
}
function ShopIcon() {
  return (
    <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M5 8h14l-1 11H6L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  )
}
function PlaneIcon() {
  return (
    <svg className={svg} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 13.5 13 12V6.2a1.2 1.2 0 0 0-2.4 0V12l-8 1.5V15l8-1v3.6L8.5 19v1.4L12 19.6l3.5.8V19l-2.1-1.4V14l8 1v-1.5Z" />
    </svg>
  )
}
function StarIcon() {
  return (
    <svg className={svg} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9L12 3Z" />
    </svg>
  )
}
