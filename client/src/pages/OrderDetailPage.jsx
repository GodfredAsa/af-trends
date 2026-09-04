import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { money, request, statusLabel } from '../api.js'

export default function OrderDetailPage({ session }) {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')

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

  if (!order && error) return <p className="error wrap">{error}</p>
  if (!order) return <p className="wrap muted">Loading…</p>

  return (
    <main className="panel wide">
      <p>
        <Link to="/account/orders">All orders</Link>
      </p>
      <h1>{order.order_number}</h1>
      {error ? <p className="error">{error}</p> : null}
      <p>
        <span className="badge">{statusLabel(order.status)}</span>{' '}
        <span className="badge">{statusLabel(order.payment_status)} · payment before delivery</span>
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
        Delivery {money(order.delivery_fee, order.currency)} · Total{' '}
        <strong>{money(order.total, order.currency)}</strong>
      </p>
      {order.status === 'pending' ? (
        <button type="button" className="btn ghost" onClick={cancel}>
          Cancel order
        </button>
      ) : null}
    </main>
  )
}
