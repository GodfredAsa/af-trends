import { useEffect, useMemo, useState } from 'react'
import { money, request } from '../../api.js'
import { PRIV, can } from '../../privileges.js'
import AddShirtModal from '../../components/AddShirtModal.jsx'
import StockItemModal from '../../components/StockItemModal.jsx'
import { IconShirt } from '../../components/Icons.jsx'

const PAGE_SIZES = [5, 15, 25]

const LABELS = {
  out_of_stock: 'Out of stock',
  low_stock: 'Low stock',
  in_stock: 'In stock',
}

export default function StaffStock({ session }) {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [total, setTotal] = useState(0)
  const [palette, setPalette] = useState([])
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState(null)
  const canWrite = can(session.user, PRIV.CATALOG_WRITE)

  function load(nextPage = page, nextSize = pageSize) {
    request(`/staff/stock?page=${nextPage}&page_size=${nextSize}`, { token: session.token })
      .then((data) => {
        setItems(data.items || [])
        setTotal(data.total || 0)
        setPage(data.page || nextPage)
        setPageSize(data.page_size || nextSize)
      })
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    load(1, pageSize)
    request('/staff/palette/colors', { token: session.token })
      .then((data) => setPalette(data.items || []))
      .catch(() => {})
  }, [session.token])

  const pages = Math.max(1, Math.ceil(total / pageSize))
  const selected = useMemo(() => items.find((item) => item.id === openId), [items, openId])

  function changePageSize(size) {
    setPageSize(size)
    load(1, size)
  }

  return (
    <div className="dash stock-page">
      <header className="dash-head">
        <div>
          <h1>Stock</h1>
          <p>
            {canWrite
              ? 'Receive t-shirts into inventory. Open a row for colourways, cost, and sizes.'
              : 'Inventory on hand. Open a row to see colourways, cost, and sizes.'}
          </p>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <div className="status-tabs" role="tablist" aria-label="Stock views">
        <button
          type="button"
          role="tab"
          aria-selected={!adding}
          className={adding ? '' : 'active'}
          onClick={() => setAdding(false)}
        >
          Inventory
          <span className="count">{total}</span>
        </button>
        {canWrite ? (
          <button
            type="button"
            role="tab"
            aria-selected={adding}
            className={adding ? 'active' : ''}
            onClick={() => setAdding(true)}
          >
            Add t-shirt
          </button>
        ) : null}
      </div>

      {items.length > 0 ? (
        <div className="stock-toolbar">
          <p className="muted">Select a shirt to see colourway counts.</p>
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

      {items.length === 0 ? (
        <div className="shirts-empty">
          <IconShirt />
          <h2>No shirts in stock yet</h2>
          <p className="muted">
            {canWrite ? 'Use the Add t-shirt tab to receive the first batch.' : 'No shirts in inventory yet.'}
          </p>
          {canWrite ? (
            <button type="button" className="btn" onClick={() => setAdding(true)}>
              Add t-shirt
            </button>
          ) : null}
        </div>
      ) : (
        <div className="dash-card table-card">
          <div className="table-wrap">
            <table className="table stock-table">
              <thead>
                <tr>
                  <th>Shirt</th>
                  <th>Colourways</th>
                  <th>Units</th>
                  <th>Availability</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="order-row" onClick={() => setOpenId(item.id)}>
                    <td>
                      <div className="stock-name">
                        {item.primary_image ? <img src={item.primary_image.url} alt="" /> : <span className="stock-ph" />}
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="swatches" aria-label="Colourways">
                        {item.color_stocks.map((color) => (
                          <span
                            key={color.id}
                            className="swatch"
                            style={{ background: color.hex }}
                            title={`${color.name}: ${color.units}`}
                          />
                        ))}
                      </div>
                    </td>
                    <td>{item.total_units}</td>
                    <td>
                      <span className={`stock-label ${item.label}`}>{LABELS[item.label] || item.label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {items.length > 0 ? (
        <div className="pager">
          <button type="button" className="btn ghost" disabled={page <= 1} onClick={() => load(page - 1, pageSize)}>
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button type="button" className="btn ghost" disabled={page >= pages} onClick={() => load(page + 1, pageSize)}>
            Next
          </button>
        </div>
      ) : null}

      {adding && canWrite ? (
        <AddShirtModal
          session={session}
          palette={palette}
          mode="stock"
          onClose={() => setAdding(false)}
          onCreated={() => load(1, pageSize)}
          onPaletteChange={setPalette}
        />
      ) : null}

      {selected ? <StockItemModal session={session} item={selected} onClose={() => setOpenId(null)} /> : null}
    </div>
  )
}
