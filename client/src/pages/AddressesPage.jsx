import { useEffect, useState } from 'react'
import { request } from '../api.js'

export default function AddressesPage({ session }) {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({
    label: 'Home',
    line1: '',
    city: '',
    region: '',
    notes: '',
    is_default: false,
  })
  const [error, setError] = useState('')

  function load() {
    request('/addresses', { token: session.token }).then(setRows).catch((err) => setError(err.message))
  }

  useEffect(load, [session.token])

  async function create(event) {
    event.preventDefault()
    try {
      await request('/addresses', { method: 'POST', token: session.token, body: form })
      setForm({ label: 'Home', line1: '', city: '', region: '', notes: '', is_default: false })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    await request(`/addresses/${id}`, { method: 'DELETE', token: session.token })
    load()
  }

  return (
    <main className="panel wide">
      <h1>Addresses</h1>
      {error ? <p className="error">{error}</p> : null}
      {rows.map((row) => (
        <div key={row.id} className="cart-line" style={{ gridTemplateColumns: '1fr auto' }}>
          <div>
            <strong>{row.label}</strong>
            {row.is_default ? ' · default' : ''}
            <p className="muted">
              {row.line1}, {row.city}, {row.region}
            </p>
          </div>
          <button type="button" className="btn ghost" onClick={() => remove(row.id)}>
            Remove
          </button>
        </div>
      ))}
      <form onSubmit={create}>
        <h2>Add address</h2>
        <input placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        <input placeholder="Street" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} required />
        <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
        <input placeholder="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} required />
        <button className="btn" type="submit" style={{ marginTop: 12 }}>
          Save
        </button>
      </form>
    </main>
  )
}
