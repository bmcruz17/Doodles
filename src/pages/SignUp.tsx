import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function SignUp() {
  const { signUp, signIn } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signUp(email, password, name)
      // If email confirmation is disabled, sign straight in and onboard a pet.
      try {
        await signIn(email, password)
        navigate('/pets/new')
      } catch {
        navigate('/login')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img src="/doodle.svg" alt="Doodles" className="h-12 w-12" />
          <h1 className="text-2xl font-semibold text-brand-50">
            Create your account
          </h1>
          <p className="text-sm text-brand-300">
            The operating system for doodle ownership
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-brand-300">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-300 underline hover:text-brand-100">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
