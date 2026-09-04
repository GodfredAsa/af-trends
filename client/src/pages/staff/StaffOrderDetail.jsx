import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { money, request, statusLabel } from '../../api.js'
import { PRIV, can } from '../../privileges.js'
import { IconTrash } from '../../components/Icons.jsx'

const NEXT = {
  support: {
    pending: ['cancelled'],
    packed: ['out_for_delivery'],
    out_for_delivery: ['failed_delivery'],
  },
  manager: {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['packed', 'cancelled'],
    packed: ['out_for_delivery', 'cancelled'],
    out_for_delivery: ['delivered', 'failed_delivery', 'cancelled'],
    failed_delivery: ['out_for_delivery', 'cancelled'],
  },
}

NEXT.superadmin = NEXT.manager

export default function StaffOrderDetail({ session }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const role = session.user.role
  const canPay = can(session.user, PRIV.ORDERS_COLLECT)
  const canDeleteOrder = can(session.user, PRIV.ORDERS_DELETE)
  const isSuperadmin = session.user.role === 'superadmin'

  function load() {
    request(`/staff/orders/${id}`, { token: session.token })
      .then(setOrder)
      .catch((err) => setError(err.message))
  }

  useEffect(load, [id, session.token])

  async function setStatus(status) {
    try {
      const next = await request(`/staff/orders/${id}/status`, {
        method: 'PATCH',
        token: session.token,
        body: { status },
      })
      setOrder(next)
    } catch (err) {
      setError(err.message)
    }
  }

  async function collect() {
    try {
      const next = await request(`/staff/orders/${id}/payment`, {
        method: 'PATCH',
        token: session.token,
        body: { payment_status: 'paid' },
      })
      setOrder(next)
    } catch (err) {
      setError(err.message)
    }
  }

  async function addNote(event) {
    event.preventDefault()
    try {
      const next = await request(`/staff/orders/${id}/notes`, {
        method: 'POST',
        token: session.token,
        body: { body: note },
      })
      setNote('')
      setOrder(next)
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeOrder() {
    const held = !['delivered', 'cancelled'].includes(order.status)
    if (
      !window.confirm(
        held
          ? 'Delete this order permanently? Held stock will be returned.'
          : 'Delete this order permanently?',
      )
    ) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await request(`/staff/orders/${id}`, { method: 'DELETE', token: session.token })
      navigate('/staff/orders')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!order) return <p className="muted">{error || 'Loading…'}</p>
  const actions = NEXT[role]?.[order.status] || []
  const waitingDelete =
    canDeleteOrder &&
    !isSuperadmin &&
    (order.status === 'delivered' || order.status === 'cancelled') &&
    !order.can_delete
  const showDelete = canDeleteOrder && (isSuperadmin || order.can_delete)

  return (
    <div>
      <p>
        <Link to="/staff/orders">All orders</Link>
      </p>
      <h1>{order.order_number}</h1>
      {error ? <p className="error">{error}</p> : null}
      <p>
        <span className="badge">{statusLabel(order.status)}</span>{' '}
        <span className="badge">{statusLabel(order.payment_status)}</span>
      </p>
      <p>
        {order.customer.full_name} · {order.customer.phone} · {order.customer.email}
      </p>
      <p>
        {order.delivery_address.line1}, {order.delivery_address.city} · {order.delivery_zone.name}
      </p>
      {order.items.map((item) => (
        <div className="order-line" key={item.id}>
          <img src={item.image_url} alt="" />
          <div>
            {item.product_name}
            <div className="muted">
              {item.color_name} / {item.size} × {item.quantity}
            </div>
          </div>
          <div>{money(item.unit_price, order.currency)}</div>
        </div>
      ))}
      <p>
        Total <strong>{money(order.total, order.currency)}</strong> due on delivery
      </p>
      <div className="row-actions">
        {actions.map((value) => (
          <button key={value} type="button" className="btn ghost" onClick={() => setStatus(value)}>
            Mark {statusLabel(value)}
          </button>
        ))}
        {canPay && order.status === 'delivered' && order.payment_status !== 'paid' ? (
          <button type="button" className="btn" onClick={collect}>
            Cash collected
          </button>
        ) : null}
        {showDelete ? (
          <button type="button" className="trash-btn labeled" onClick={removeOrder} disabled={busy}>
            <IconTrash />
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        ) : null}
      </div>
      {waitingDelete && order.deletable_after ? (
        <p className="muted">
          This {statusLabel(order.status)} order can be deleted after{' '}
          {new Date(order.deletable_after).toLocaleString()}.
        </p>
      ) : null}
      <h2>Notes</h2>
      {order.notes?.map((row) => (
        <p key={row.id} className="muted">
          {row.author_name}: {row.body}
        </p>
      ))}
      <form onSubmit={addNote}>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} required />
        <button className="btn ghost" type="submit" style={{ marginTop: 8 }}>
          Add note
        </button>
      </form>
    </div>
  )
}
