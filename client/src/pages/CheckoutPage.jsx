import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { money, request } from '../api.js'

export default function CheckoutPage({ session }) {
  const navigate = useNavigate()
  const [cart, setCart] = useState(null)
  const [addresses, setAddresses] = useState([])
  const [zones, setZones] = useState([])
  const [addressId, setAddressId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [note, setNote] = useState('')
  const [payAccount, setPayAccount] = useState('024 903 9110')
  const [payNetwork, setPayNetwork] = useState('MTN MoMo')
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({
    label: 'Home',
    line1: '',
    city: '',
    region: 'Greater Accra',
    notes: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    request('/cart', { token: session.token }).then(setCart).catch((err) => setError(err.message))
    request('/addresses', { token: session.token })
      .then((rows) => {
        setAddresses(rows)
        const fallback = rows.find((row) => row.is_default) || rows[0]
        if (fallback) setAddressId(fallback.id)
      })
      .catch((err) => setError(err.message))
    request('/delivery-zones')
      .then((data) => {
        setZones(data.items || [])
        if (data.items?.[0]) setZoneId(data.items[0].id)
      })
      .catch((err) => setError(err.message))
    request('/storefront')
      .then((data) => {
        if (data.payment_account) setPayAccount(data.payment_account)
        if (data.payment_network) setPayNetwork(data.payment_network)
      })
      .catch(() => {})
  }, [session.token])

  async function addAddress(event) {
    event.preventDefault()
    try {
      const created = await request('/addresses', {
        method: 'POST',
        token: session.token,
        body: { ...form, is_default: addresses.length === 0 },
      })
      const rows = [...addresses, created]
      setAddresses(rows)
      setAddressId(created.id)
    } catch (err) {
      setError(err.message)
    }
  }

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(payAccount.replaceAll(' ', ''))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  async function placeOrder(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const order = await request('/orders', {
        method: 'POST',
        token: session.token,
        body: {
          address_id: addressId,
          delivery_zone_id: zoneId,
          customer_note: note,
        },
      })
      navigate(`/account/orders/${order.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const total = cart?.subtotal

  if (!cart) return <p className="wrap muted">{error || 'Loading checkout…'}</p>
  if (cart.items.length === 0) {
    return (
      <main className="panel">
        <p>
          Cart is empty. <Link to="/">Shop</Link>
        </p>
      </main>
    )
  }

  return (
    <main className="panel wide checkout">
      <h1>Checkout</h1>
      <p className="muted">Pay to the account below, then submit the order.</p>
      {error ? <p className="error">{error}</p> : null}

      <section className="pay-card">
        <p className="pay-kicker">Pay to account</p>
        <p className="pay-network">{payNetwork}</p>
        <p className="pay-number">{payAccount}</p>
        <button type="button" className="btn ghost" onClick={copyAccount}>
          {copied ? 'Copied' : 'Copy number'}
        </button>
      </section>

      <h2>Delivery address</h2>
      {addresses.length ? (
        <select value={addressId} onChange={(e) => setAddressId(e.target.value)}>
          {addresses.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label} — {row.line1}, {row.city}
            </option>
          ))}
        </select>
      ) : (
        <p className="muted">Add an address to continue.</p>
      )}
      <form onSubmit={addAddress} style={{ marginTop: 16 }}>
        <label>New address</label>
        <input placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        <input placeholder="Street" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} required />
        <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
        <input placeholder="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} required />
        <button className="btn ghost" type="submit" style={{ marginTop: 10 }}>
          Save address
        </button>
      </form>

      <h2>Zone</h2>
      <form className="checkout-pay" onSubmit={placeOrder}>
        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
          {zones.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
        <label>Note for the rider</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        <p>
          <strong>Total {money(total)}</strong>
        </p>
        <button className="btn" type="submit" disabled={busy || !addressId || !zoneId}>
          {busy ? 'Submitting…' : 'Submit Order'}
        </button>
      </form>
    </main>
  )
}
