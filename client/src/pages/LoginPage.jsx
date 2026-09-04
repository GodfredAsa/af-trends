import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { isStaff, request, writeSession } from '../api.js'
import AuthShell from '../components/AuthShell.jsx'

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await request('/auth/login', {
        method: 'POST',
        body: { email, password },
      })
      const session = { token: data.access_token, user: data.user }
      writeSession(session)
      onLogin(session)
      const dest = location.state?.from
      if (dest) navigate(dest)
      else navigate(isStaff(data.user.role) ? '/staff' : '/')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      kicker="Welcome back"
      title="Sign in to AF Trends"
      lede="Shop custom tees, pay before delivery, or open the staff dashboard."
    >
      <form className="auth-card" onSubmit={submit}>
        <p className="eyebrow">Account</p>
        <h1>Sign in</h1>
        <p className="muted">Use your customer or staff email.</p>
        {error ? <p className="error">{error}</p> : null}
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          required
        />
        <button className="btn block" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="auth-foot">
          New here? <Link to="/register">Create a customer account</Link>
        </p>
      </form>
    </AuthShell>
  )
}
