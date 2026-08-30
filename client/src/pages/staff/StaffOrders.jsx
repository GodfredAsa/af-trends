import { useEffect, useMemo, useState } from 'react'
import { money, request, statusLabel } from '../../api.js'
import OrderModal from '../../components/OrderModal.jsx'

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

export default function StaffOrders({ session }) {
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams({ page_size: '100' })
    if (q.trim()) params.set('q', q.trim())
    request(`/staff/orders?${params}`, { token: session.token })
      .then((data) => setOrders(data.items || []))
      .catch(() => {})
  }, [session.token, q])

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
    <div>
      <h1>Orders</h1>
      <div className="filters">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, order no." />
      </div>
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
      <table className="table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Customer</th>
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
                {order.customer.full_name}
                <div className="muted">{order.customer.phone}</div>
              </td>
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
      {visible.length === 0 ? <p className="muted">No orders in this tab.</p> : null}
      {selected ? (
        <OrderModal order={selected} onClose={() => setOpenId(null)} manageHref={`/staff/orders/${selected.id}`} />
      ) : null}
    </div>
  )
}
