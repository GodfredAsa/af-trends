import { useEffect, useState } from 'react'
import { request } from '../../api.js'

function asHex(value) {
  const raw = String(value || '#888888')
  return raw.startsWith('#') ? raw : `#${raw}`
}

export default function StaffSettings({ session }) {
  const [settings, setSettings] = useState(null)
  const [zones, setZones] = useState([])
  const [zone, setZone] = useState({ name: '', fee: '20.00' })
  const [colors, setColors] = useState([])
  const [drafts, setDrafts] = useState({})
  const [color, setColor] = useState({ name: '', hex: '#2A3B30' })
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  function load() {
    request('/staff/settings', { token: session.token }).then(setSettings).catch((err) => setError(err.message))
    request('/staff/delivery-zones', { token: session.token })
      .then((data) => setZones(data.items || []))
      .catch((err) => setError(err.message))
    request('/staff/palette/colors', { token: session.token })
      .then((data) => {
        const items = data.items || []
        setColors(items)
        setDrafts(
          Object.fromEntries(items.map((item) => [item.id, { name: item.name, hex: asHex(item.hex) }])),
        )
      })
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

  function patchDraft(id, next) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...next } }))
  }

  async function addColor(event) {
    event.preventDefault()
    setError('')
    setBusyId('new')
    try {
      await request('/staff/palette/colors', { method: 'POST', token: session.token, body: color })
      setColor({ name: '', hex: '#2A3B30' })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  async function saveColor(item) {
    const draft = drafts[item.id]
    if (!draft?.name?.trim()) {
      setError('Give the colour a name.')
      return
    }
    setError('')
    setBusyId(item.id)
    try {
      await request(`/staff/palette/colors/${item.id}`, {
        method: 'PATCH',
        token: session.token,
        body: { name: draft.name.trim(), hex: draft.hex },
      })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  async function removeColor(item) {
    if (!window.confirm(`Remove ${item.name} from the palette?`)) return
    setError('')
    setBusyId(item.id)
    try {
      await request(`/staff/palette/colors/${item.id}`, { method: 'DELETE', token: session.token })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  if (!settings) return <p className="muted">{error || 'Loading…'}</p>

  return (
    <div className="dash settings-page">
      <header className="dash-head">
        <div>
          <h1>Settings</h1>
          <p>Store copy, delivery zones, and the shirt colour palette.</p>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <form className="edit-card" onSubmit={saveSettings}>
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
      <section className="edit-card">
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
      </section>
      <section className="edit-card">
        <h2>Shirt colours</h2>
        <p className="muted qty-hint">
          You can delete a colour that is not selected on any shirt. Selected colourways stay until you turn them off on those shirts.
        </p>
        <ul className="palette-admin">
          {colors.map((item) => {
            const draft = drafts[item.id] || { name: item.name, hex: asHex(item.hex) }
            const dirty = draft.name !== item.name || asHex(draft.hex).toUpperCase() !== asHex(item.hex).toUpperCase()
            return (
              <li key={item.id} className="palette-admin-row">
                <span className="swatch" style={{ background: draft.hex }} />
                <input
                  value={draft.name}
                  onChange={(event) => patchDraft(item.id, { name: event.target.value })}
                  aria-label={`${item.name} name`}
                />
                <input
                  type="color"
                  value={asHex(draft.hex)}
                  onChange={(event) => patchDraft(item.id, { hex: event.target.value })}
                  aria-label={`${item.name} hex`}
                />
                <button
                  type="button"
                  className="btn ghost"
                  disabled={!dirty || busyId === item.id}
                  onClick={() => saveColor(item)}
                >
                  {busyId === item.id ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busyId === item.id || item.in_use}
                  title={item.in_use ? 'Turn this colour off on shirts first' : 'Delete colour'}
                  onClick={() => removeColor(item)}
                >
                  Delete
                </button>
              </li>
            )
          })}
        </ul>
        <form className="palette-admin-add" onSubmit={addColor}>
          <span className="swatch" style={{ background: color.hex }} />
          <input
            placeholder="Name"
            value={color.name}
            onChange={(e) => setColor({ ...color, name: e.target.value })}
            required
          />
          <input type="color" value={color.hex} onChange={(e) => setColor({ ...color, hex: e.target.value })} />
          <button className="btn" type="submit" disabled={busyId === 'new'}>
            {busyId === 'new' ? 'Adding…' : 'Add colour'}
          </button>
        </form>
      </section>
    </div>
  )
}
