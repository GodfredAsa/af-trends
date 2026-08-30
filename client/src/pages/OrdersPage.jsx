import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { money, request, statusLabel } from '../api.js'
import OrderModal from '../components/OrderModal.jsx'

const STATUSES = [
  '',
  'pending',
  'confirmed',
  'packed',
  'out_for_delivery',
  'delivered',
  'failed_delivery',
  'cancelled',
]

export default function OrdersPage({ session }) {
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState('')
  const [openId, setOpenId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    request('/orders', { token: session.token })
      .then((data) => setOrders(data.items || []))
      .catch((err) => setError(err.message))
  }, [session.token])

  const counts = useMemo(() => {
    const next = { '': orders.length }
    STATUSES.slice(1).forEach((value) => {
      next[value] = orders.filter((order) => order.status === value).length
    })
    return next
  }, [orders])

  const visible = status ? orders.filter((order) => order.status === status) : orders
  const selected = orders.find((order) => order.id === openId)

  return (
    <main className="panel wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <h1>Your orders</h1>
        <Link to="/account/addresses">Addresses</Link>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="status-tabs" role="tablist" aria-label="Order status">
        {STATUSES.map((value) => (
          <button
            key={value || 'all'}
            type="button"
            role="tab"
            aria-selected={status === value}
            className={status === value ? 'active' : ''}
            onClick={() => setStatus(value)}
          >
            {value ? statusLabel(value) : 'All'}
            <span className="count">{counts[value] || 0}</span>
          </button>
        ))}
      </div>
      {visible.length === 0 ? <p className="muted">No orders in this tab.</p> : null}
      <table className="table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Status</th>
            <th>Payment</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((order) => (
            <tr key={order.id} className="order-row" onClick={() => setOpenId(order.id)}>
              <td>{order.order_number}</td>
              <td>
                <span className={`order-chip ${order.status}`}>{statusLabel(order.status)}</span>
              </td>
              <td>
                <span className={`order-chip pay-${order.payment_status}`}>{statusLabel(order.payment_status)}</span>
              </td>
              <td>{money(order.total, order.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected ? <OrderModal order={selected} onClose={() => setOpenId(null)} /> : null}
    </main>
  )
}
