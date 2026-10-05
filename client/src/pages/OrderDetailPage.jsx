import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { money, request, statusLabel } from '../api.js'
import FileDropzone from '../components/FileDropzone.jsx'

const NETWORKS = ['MTN', 'Telecel', 'AirtelTigo', 'Bank', 'Other']

export default function OrderDetailPage({ session }) {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [proof, setProof] = useState({
    payment_network: 'MTN',
    payment_number: '',
    transaction_id: '',
    note: '',
    files: [],
  })

  function load() {
    request(`/orders/${id}`, { token: session.token })
      .then(setOrder)
      .catch((err) => setError(err.message))
  }

  useEffect(load, [id, session.token])

  async function cancel() {
    try {
      const next = await request(`/orders/${id}/cancel`, { method: 'POST', token: session.token })
      setOrder(next)
    } catch (err) {
      setError(err.message)
    }
  }

  async function submitProof(event) {
    event.preventDefault()
    if (!proof.files.length) {
      setError('Upload at least one receipt image.')
      return
    }
    setBusy(true)
    setError('')
    const payload = new FormData()
    payload.append('transaction_id', proof.transaction_id)
    payload.append('payment_number', proof.payment_number)
    payload.append('payment_network', proof.payment_network)
    payload.append('note', proof.note)
    proof.files.forEach((file) => payload.append('files', file))
    try {
      const next = await request(`/orders/${id}/payment-proof`, {
        method: 'POST',
        token: session.token,
        form: payload,
      })
      setOrder(next)
      setProof({ payment_network: 'MTN', payment_number: '', transaction_id: '', note: '', files: [] })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!order && error) return <p className="error wrap">{error}</p>
  if (!order) return <p className="wrap muted">Loading…</p>

  const latestProof = (order.payment_proofs || []).at(-1)
  const canSubmitProof =
    order.payment_status !== 'paid' &&
    order.status !== 'cancelled' &&
    latestProof?.status !== 'pending'

  return (
    <main className="panel wide">
      <p>
        <Link to="/account/orders">All orders</Link>
      </p>
      <h1>{order.order_number}</h1>
      {error ? <p className="error">{error}</p> : null}
      <p>
        <span className="badge">{statusLabel(order.status)}</span>{' '}
        <span className="badge">{statusLabel(order.payment_status)}</span>
      </p>
      {order.items.map((item) => (
        <div className="order-line" key={item.id}>
          <img src={item.image_url} alt="" />
          <div>
            <strong>{item.product_name}</strong>
            <p className="muted">
              {item.color_name} · {item.size} · qty {item.quantity}
            </p>
          </div>
          <div>{money(item.unit_price, order.currency)}</div>
        </div>
      ))}
      <p>
        {order.delivery_address.line1}, {order.delivery_address.city}
      </p>
      <p>
        Total <strong>{money(order.total, order.currency)}</strong>
      </p>

      {latestProof ? (
        <section className="proof-box">
          <h2>Payment proof</h2>
          <p>
            {latestProof.payment_network} · {latestProof.payment_number} · ID {latestProof.transaction_id}
          </p>
          <p className="badge">{statusLabel(latestProof.status)}</p>
          {latestProof.review_note ? <p className="muted">{latestProof.review_note}</p> : null}
          <div className="proof-thumbs">
            {(latestProof.images || []).map((image) => (
              <a key={image.id} href={image.url} target="_blank" rel="noreferrer">
                <img src={image.url} alt="Receipt" />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {canSubmitProof ? (
        <form className="proof-form" onSubmit={submitProof}>
          <h2>Paid outside the app?</h2>
          <p className="muted">Upload receipt photos and MoMo or bank details. Superadmin and managers review and approve.</p>
          <label htmlFor="pay-network">Payment network</label>
          <select
            id="pay-network"
            value={proof.payment_network}
            onChange={(event) => setProof({ ...proof, payment_network: event.target.value })}
            required
          >
            {NETWORKS.map((network) => (
              <option key={network} value={network}>
                {network}
              </option>
            ))}
          </select>
          <label htmlFor="pay-number">Payment number</label>
          <input
            id="pay-number"
            value={proof.payment_number}
            onChange={(event) => setProof({ ...proof, payment_number: event.target.value })}
            placeholder="024XXXXXXX"
            required
          />
          <label htmlFor="pay-txn">Transaction ID</label>
          <input
            id="pay-txn"
            value={proof.transaction_id}
            onChange={(event) => setProof({ ...proof, transaction_id: event.target.value })}
            placeholder="MoMo or bank reference"
            required
          />
          <label htmlFor="pay-note">Note (optional)</label>
          <textarea
            id="pay-note"
            value={proof.note}
            onChange={(event) => setProof({ ...proof, note: event.target.value })}
          />
          <FileDropzone
            files={proof.files}
            onChange={(files) => setProof({ ...proof, files })}
            title="Drop your receipt here or browse"
          />
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      ) : null}

      {order.status === 'pending' ? (
        <button type="button" className="btn ghost" onClick={cancel}>
          Cancel order
        </button>
      ) : null}
    </main>
  )
}
