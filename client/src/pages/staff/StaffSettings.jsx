import { useEffect, useState } from 'react'
import { request } from '../../api.js'

export default function StaffSettings({ session }) {
  const [settings, setSettings] = useState(null)
  const [zones, setZones] = useState([])
  const [zone, setZone] = useState({ name: '', fee: '20.00' })
  const [color, setColor] = useState({ name: '', hex: '#888888' })
  const [error, setError] = useState('')

  function load() {
    request('/staff/settings', { token: session.token }).then(setSettings).catch((err) => setError(err.message))
    request('/staff/delivery-zones', { token: session.token })
      .then((data) => setZones(data.items || []))
      .catch((err) => setError(err.message))
  }

  useEffect(load, [session.token])

  async function saveSettings(event) {
    event.preventDefault()
    try {
      const next = await request('/staff/settings', {
        method: 'PATCH',
        token: session.token,
        body: settings,
      })
      setSettings(next)
    } catch (err) {
      setError(err.message)
    }
  }

  async function addZone(event) {
    event.preventDefault()
    try {
      await request('/staff/delivery-zones', { method: 'POST', token: session.token, body: zone })
      setZone({ name: '', fee: '20.00' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function addColor(event) {
    event.preventDefault()
    try {
      await request('/staff/palette/colors', { method: 'POST', token: session.token, body: color })
      setColor({ name: '', hex: '#888888' })
    } catch (err) {
      setError(err.message)
    }
  }

  if (!settings) return <p className="muted">{error || 'Loading…'}</p>

  return (
    <div>
      <h1>Settings</h1>
      {error ? <p className="error">{error}</p> : null}
      <form onSubmit={saveSettings}>
        <label>Store name</label>
        <input value={settings.store_name} onChange={(e) => setSettings({ ...settings, store_name: e.target.value })} />
        <label>Support email</label>
        <input value={settings.support_email} onChange={(e) => setSettings({ ...settings, support_email: e.target.value })} />
        <label>Support phone</label>
        <input value={settings.support_phone} onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })} />
        <label>Cash on delivery note</label>
        <textarea
          value={settings.cod_instructions}
          onChange={(e) => setSettings({ ...settings, cod_instructions: e.target.value })}
        />
        <button className="btn" type="submit" style={{ marginTop: 12 }}>
          Save settings
        </button>
      </form>
      <h2>Delivery zones</h2>
      <ul>
        {zones.map((row) => (
          <li key={row.id}>
            {row.name} — GHS {row.fee} {row.is_active ? '' : '(inactive)'}
          </li>
        ))}
      </ul>
      <form onSubmit={addZone}>
        <input placeholder="Zone name" value={zone.name} onChange={(e) => setZone({ ...zone, name: e.target.value })} />
        <input placeholder="Fee" value={zone.fee} onChange={(e) => setZone({ ...zone, fee: e.target.value })} />
        <button className="btn ghost" type="submit">
          Add zone
        </button>
      </form>
      <h2>New shirt color</h2>
      <form onSubmit={addColor}>
        <input placeholder="Name" value={color.name} onChange={(e) => setColor({ ...color, name: e.target.value })} />
        <input type="color" value={color.hex} onChange={(e) => setColor({ ...color, hex: e.target.value })} />
        <button className="btn ghost" type="submit">
          Add color
        </button>
      </form>
    </div>
  )
}
