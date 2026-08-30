import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { money, statusLabel } from '../api.js'

function lineTotal(item) {
  return (Number(item.unit_price) * Number(item.quantity)).toFixed(2)
}

export default function OrderModal({ order, onClose, manageHref }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!order) return null

  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <p className="eyebrow">Order</p>
            <h2 id="order-modal-title">{order.order_number}</h2>
            <div className="modal-chips">
              <span className={`order-chip ${order.status}`}>{statusLabel(order.status)}</span>
              <span className={`order-chip pay-${order.payment_status}`}>{statusLabel(order.payment_status)}</span>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {order.customer ? (
          <p className="muted modal-meta">
            {order.customer.full_name}
            {order.customer.phone ? ` · ${order.customer.phone}` : ''}
          </p>
        ) : null}
        {order.delivery_address ? (
          <p className="muted modal-meta">
            {order.delivery_address.line1}, {order.delivery_address.city}
            {order.delivery_zone?.name ? ` · ${order.delivery_zone.name}` : ''}
          </p>
        ) : null}

        <ul className="modal-items">
          {(order.items || []).map((item) => (
            <li key={item.id}>
              {item.image_url ? <img src={item.image_url} alt="" /> : <span className="stock-ph" />}
              <div>
                <strong>{item.product_name}</strong>
                <span>
                  {item.color_name} · {item.size}
                </span>
                <span>
                  {item.quantity} × {money(item.unit_price, order.currency)}
                </span>
              </div>
              <b>{money(lineTotal(item), order.currency)}</b>
            </li>
          ))}
        </ul>

        <dl className="modal-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{money(order.subtotal, order.currency)}</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd>{money(order.delivery_fee, order.currency)}</dd>
          </div>
          <div className="grand">
            <dt>Total due on delivery</dt>
            <dd>{money(order.total, order.currency)}</dd>
          </div>
        </dl>

        {manageHref ? (
          <Link className="btn block" to={manageHref} onClick={onClose}>
            Manage order
          </Link>
        ) : null}
      </div>
    </div>
  )
}
