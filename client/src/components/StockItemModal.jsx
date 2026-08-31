import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { money, request } from '../api.js'
import { PRIV, can } from '../privileges.js'

const LABELS = {
  out_of_stock: 'Out of stock',
  low_stock: 'Low stock',
  in_stock: 'In stock',
}

export default function StockItemModal({ session, item, onClose }) {
  const [product, setProduct] = useState(null)

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    request(`/staff/products/${item.id}`, { token: session.token })
      .then(setProduct)
      .catch(() => setProduct(null))
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [item.id, onClose, session.token])

  const sizes = product?.sizes || []
  const stockMap = useMemo(() => {
    const map = {}
    ;(product?.variants || []).forEach((variant) => {
      map[`${variant.color.id}:${variant.size}`] = Number(variant.stock || 0)
    })
    return map
  }, [product])

  const colourways = product?.colors || item.color_stocks || item.colors || []

  return (
    <div className="modal-back sheet" onClick={onClose} role="presentation">
      <div
        className="modal-card form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-item-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <p className="eyebrow">Inventory</p>
            <h2 id="stock-item-title">{item.name}</h2>
            <div className="modal-chips">
              <span className={`stock-label ${item.label}`}>{LABELS[item.label] || item.label}</span>
              <span className={`status-pill ${item.is_published ? 'live' : 'draft'}`}>
                {item.is_published ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="form-scroll">
          <div className="stock-modal-hero">
            {item.primary_image ? <img src={item.primary_image.url} alt="" /> : <span className="shirt-ph" />}
            <dl className="stock-stats">
              <div>
                <dt>Units</dt>
                <dd>{item.total_units}</dd>
              </div>
              <div>
                <dt>Cost</dt>
                <dd>{money(item.cost_price, item.currency)}</dd>
              </div>
              <div>
                <dt>Selling</dt>
                <dd>{money(item.selling_price, item.currency)}</dd>
              </div>
            </dl>
          </div>

          <section className="form-block">
            <p className="form-kicker">Colourways</p>
            {sizes.length ? (
              <div className="qty-board">
                {colourways.map((color) => (
                  <div className="qty-group" key={color.id}>
                    <div className="qty-group-head">
                      <span className="swatch" style={{ background: color.hex }} />
                      <strong>{color.name}</strong>
                    </div>
                    <div className="qty-sizes">
                      {sizes.map((size) => (
                        <div className="qty-cell qty-read" key={size}>
                          <span>{size}</span>
                          <b>{stockMap[`${color.id}:${size}`] ?? 0}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="colourway-list">
                {(item.color_stocks || []).map((color) => (
                  <li key={color.id}>
                    <span className="swatch" style={{ background: color.hex }} />
                    <span>{color.name}</span>
                    <b>{color.units} units</b>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
          <Link className="btn" to={`/staff/products/${item.id}`} onClick={onClose}>
            {can(session.user, PRIV.CATALOG_WRITE) ? 'Adjust stock' : 'View shirt'}
          </Link>
        </div>
      </div>
    </div>
  )
}
