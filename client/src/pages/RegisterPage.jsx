import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { request, writeSession } from '../api.js'
import AuthShell from '../components/AuthShell.jsx'

export default function RegisterPage({ onLogin }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await request('/auth/register', { method: 'POST', body: form })
      const session = { token: data.access_token, user: data.user }
      writeSession(session)
      onLogin(session)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      kicker="Join the shop"
      title="Create your AF Trends account"
      lede="A customer account lets you checkout on delivery and follow every drop."
    >
      <form className="auth-card" onSubmit={submit}>
        <p className="eyebrow">Customer</p>
        <h1>Create account</h1>
        <p className="muted">Staff accounts are created by a superadmin.</p>
        {error ? <p className="error">{error}</p> : null}
        <label htmlFor="full_name">Full name</label>
        <input
          id="full_name"
          autoComplete="name"
          value={form.full_name}
          onChange={(e) => set('full_name', e.target.value)}
          placeholder="Ama Mensah"
          required
        />
        <label htmlFor="phone">Phone</label>
        <input
          id="phone"
          autoComplete="tel"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="024 000 0000"
          required
        />
        <label htmlFor="reg-email">Email</label>
        <input
          id="reg-email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="you@email.com"
          required
        />
        <label htmlFor="reg-password">Password</label>
        <input
          id="reg-password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          placeholder="At least 8 characters"
          minLength={8}
          required
        />
        <button className="btn block" type="submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="auth-foot">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  )
}
