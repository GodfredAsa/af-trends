import { useEffect, useState } from 'react'
import { formatPlacedAt, money, request, statusLabel } from '../../api.js'
import { PRIV, can } from '../../privileges.js'
import OrderModal from '../../components/OrderModal.jsx'
import { IconTrash } from '../../components/Icons.jsx'

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

const PAGE_SIZES = [10, 25, 50]

export default function StaffOrders({ session }) {
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState({})
  const [openId, setOpenId] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const isSuperadmin = session.user.role === 'superadmin'
  const canDelete = can(session.user, PRIV.ORDERS_DELETE)

  function load(nextPage = page, nextSize = pageSize, nextStatus = status, nextQuery = q) {
    const params = new URLSearchParams({
      page: String(nextPage),
      page_size: String(nextSize),
    })
    if (nextQuery.trim()) params.set('q', nextQuery.trim())
    if (nextStatus) params.set('status', nextStatus)
    request(`/staff/orders?${params}`, { token: session.token })
      .then((data) => {
        setOrders(data.items || [])
        setTotal(data.total || 0)
        setPage(data.page || nextPage)
        setPageSize(data.page_size || nextSize)
        setCounts(data.counts || {})
      })
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    load(page, pageSize, status, q)
  }, [session.token, q, status, page, pageSize])

  const pages = Math.max(1, Math.ceil(total / pageSize))
  const selected = orders.find((order) => order.id === openId)

  function changeStatus(value) {
    setStatus(value)
    setPage(1)
  }

  function changeQuery(value) {
    setQ(value)
    setPage(1)
  }

  function changePageSize(size) {
    setPageSize(size)
    setPage(1)
  }

  async function removeOrder(order) {
    const held = !['delivered', 'cancelled'].includes(order.status)
    const ok = window.confirm(
      held
        ? `Delete ${order.order_number} permanently? Held stock will be returned.`
        : `Delete ${order.order_number} permanently? This cannot be undone.`,
    )
    if (!ok) return
    setBusyId(order.id)
    setError('')
    try {
      await request(`/staff/orders/${order.id}`, { method: 'DELETE', token: session.token })
      if (openId === order.id) setOpenId(null)
      const nextTotal = Math.max(0, total - 1)
      const nextPages = Math.max(1, Math.ceil(nextTotal / pageSize))
      const nextPage = Math.min(page, nextPages)
      setPage(nextPage)
      load(nextPage, pageSize, status, q)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  return (
    <div>
      <h1>Orders</h1>
      {error ? <p className="error">{error}</p> : null}
      <div className="filters">
        <input
          value={q}
          onChange={(e) => changeQuery(e.target.value)}
          placeholder="Search name, phone, order no."
        />
      </div>
      <div className="status-tabs" role="tablist" aria-label="Order status">
        {STATUSES.map((value) => (
          <button
            key={value || 'all'}
            type="button"
            role="tab"
            aria-selected={status === value}
            className={status === value ? 'active' : ''}
            onClick={() => changeStatus(value)}
          >
            {value ? statusLabel(value) : 'All'}
            <span className="count">{counts[value] || 0}</span>
          </button>
        ))}
      </div>
      {orders.length > 0 ? (
        <div className="stock-toolbar">
          <p className="muted">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="page-sizes" role="group" aria-label="Rows per page">
            {PAGE_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className={pageSize === size ? 'btn' : 'btn ghost'}
                onClick={() => changePageSize(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <table className="table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Customer</th>
            <th>Placed</th>
            <th>Status</th>
            <th>Payment</th>
            <th>Total</th>
            {isSuperadmin ? <th> </th> : null}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="order-row" onClick={() => setOpenId(order.id)}>
              <td>{order.order_number}</td>
              <td>
                {order.customer.full_name}
                <div className="muted">{order.customer.phone}</div>
              </td>
              <td>{formatPlacedAt(order.created_at)}</td>
              <td>
                <span className={`order-chip ${order.status}`}>{statusLabel(order.status)}</span>
              </td>
              <td>
                <span className={`order-chip pay-${order.payment_status}`}>{statusLabel(order.payment_status)}</span>
              </td>
              <td>{money(order.total, order.currency)}</td>
              {isSuperadmin ? (
                <td className="order-delete-cell">
                  <button
                    type="button"
                    className="trash-btn"
                    aria-label={busyId === order.id ? 'Deleting order' : `Delete ${order.order_number}`}
                    title="Delete order"
                    disabled={busyId === order.id || !canDelete}
                    onClick={(event) => {
                      event.stopPropagation()
                      removeOrder(order)
                    }}
                  >
                    <IconTrash />
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 ? <p className="muted">No orders in this tab.</p> : null}
      {orders.length > 0 ? (
        <div className="pager">
          <button type="button" className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button type="button" className="btn ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      ) : null}
      {selected ? (
        <OrderModal order={selected} onClose={() => setOpenId(null)} manageHref={`/staff/orders/${selected.id}`} />
      ) : null}
    </div>
  )
}
