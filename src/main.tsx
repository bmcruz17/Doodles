import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './hooks/useAuth'
import { supabaseConfigured } from './lib/supabase'
import { BRAND } from './version'
import './index.css'

const root = createRoot(document.getElementById('root')!)

if (!supabaseConfigured) {
  // Clear, actionable screen instead of a blank page when the deployment is
  // missing its Supabase keys.
  root.render(
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-md text-center">
        <img src="/doodle.svg" alt="" className="mx-auto mb-4 h-14 w-14" />
        <h1 className="text-xl font-semibold text-brand-900">
          {BRAND} is deployed 🎉
        </h1>
        <p className="mt-2 text-sm text-brand-600">
          …but it's missing its Supabase keys. Add these as environment
          variables in your hosting project (Production), then redeploy:
        </p>
        <ul className="mt-3 space-y-1 text-left font-mono text-xs text-brand-700">
          <li>• VITE_SUPABASE_URL</li>
          <li>• VITE_SUPABASE_ANON_KEY</li>
        </ul>
        <p className="mt-3 text-xs text-brand-500">
          They come from your Supabase project → Settings → API (Project URL +
          publishable/anon key).
        </p>
      </div>
    </div>,
  )
} else {
  root.render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}
