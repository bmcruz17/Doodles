// Minimal line icons for marketplace category tiles (no emoji).
export default function CategoryIcon({ name }: { name: string }) {
  const cls = 'h-6 w-6'
  const stroke = {
    className: cls,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
    case 'all':
      return (
        <svg {...stroke}>
          <rect x="4" y="4" width="6" height="6" rx="1.5" />
          <rect x="14" y="4" width="6" height="6" rx="1.5" />
          <rect x="4" y="14" width="6" height="6" rx="1.5" />
          <rect x="14" y="14" width="6" height="6" rx="1.5" />
        </svg>
      )
    case 'grooming':
      return (
        <svg {...stroke}>
          <circle cx="6" cy="6" r="2.2" />
          <circle cx="6" cy="18" r="2.2" />
          <path d="M8 7.4 20 17M8 16.6 20 7" />
        </svg>
      )
    case 'mobile_vet':
    case 'vet':
      return (
        <svg {...stroke}>
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <path d="M12 8.5v7M8.5 12h7" />
        </svg>
      )
    case 'sitter':
    case 'boarding':
    case 'daycare':
      return (
        <svg {...stroke}>
          <path d="M4 11.5 12 5l8 6.5" />
          <path d="M6 10.5V19h12v-8.5" />
        </svg>
      )
    case 'walking':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="7" cy="9" r="1.7" />
          <circle cx="11" cy="6.6" r="1.7" />
          <circle cx="15.4" cy="7.6" r="1.7" />
          <circle cx="17.6" cy="11.4" r="1.5" />
          <path d="M12 12c-2.5 0-4.5 1.8-4.5 3.8 0 1.5 1.2 2.3 2.7 2.3.8 0 1.2-.3 1.8-.3s1 .3 1.8.3c1.5 0 2.7-.8 2.7-2.3 0-2-2-3.8-4.5-3.8Z" />
        </svg>
      )
    case 'waste_removal':
      return (
        <svg {...stroke}>
          <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />
        </svg>
      )
    case 'food':
      return (
        <svg {...stroke}>
          <path d="M4 11h16a8 8 0 0 1-16 0Z" />
          <path d="M6.5 11a5.5 5.5 0 0 1 11 0" />
        </svg>
      )
    case 'supplies':
      return (
        <svg {...stroke}>
          <path d="M6 8h12l-1 12H7L6 8Z" />
          <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
        </svg>
      )
    case 'insurance':
      return (
        <svg {...stroke}>
          <path d="M12 3.5 19 6v6c0 4-3 7-7 8.5-4-1.5-7-4.5-7-8.5V6l7-2.5Z" />
          <path d="M9.5 12l1.8 1.8 3.2-3.4" />
        </svg>
      )
    case 'training':
      return (
        <svg {...stroke}>
          <circle cx="12" cy="12" r="8" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      )
    default:
      return (
        <svg {...stroke}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
  }
}
