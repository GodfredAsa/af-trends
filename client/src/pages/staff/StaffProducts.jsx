import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { money, request } from '../../api.js'
import { PRIV, can } from '../../privileges.js'
import AddShirtModal from '../../components/AddShirtModal.jsx'
import { IconSearch, IconShirt } from '../../components/Icons.jsx'

const PAGE_SIZES = [8, 16, 24]
const TABS = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Draft' },
]

function unitsMeta(count) {
  if (count <= 0) return { key: 'out_of_stock', text: 'Out of stock' }
  if (count <= 8) return { key: 'low_stock', text: `${count} left` }
  return { key: 'in_stock', text: `${count} units` }
}

export default function StaffProducts({ session }) {
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const navigate = useNavigate()
  const canWrite = can(session.user, PRIV.CATALOG_WRITE)

  function load() {
    setLoading(true)
    request('/staff/products?page_size=100', { token: session.token })
      .then((data) => setProducts(data.items || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [session.token])

  const counts = useMemo(() => {
    const published = products.filter((item) => item.is_published).length
    return {
      all: products.length,
      published,
      draft: products.length - published,
    }
  }, [products])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return products.filter((item) => {
      if (tab === 'published' && !item.is_published) return false
      if (tab === 'draft' && item.is_published) return false
      if (!term) return true
      return `${item.name} ${item.slug}`.toLowerCase().includes(term)
    })
  }, [products, query, tab])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function changeTab(next) {
    setTab(next)
    setPage(1)
  }

  function changePageSize(size) {
    setPageSize(size)
    setPage(1)
  }

  return (
    <div className="dash shirts">
      <header className="dash-head">
        <div>
          <h1>Shirts</h1>
          <p>
            {canWrite
              ? 'Photos, prices, colors, and publish status for the catalog.'
              : 'Read-only catalog. Managers change shirts, stock, and photos.'}
          </p>
        </div>
        <div className="dash-tools">
          <label className="dash-search">
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Search shirts"
              aria-label="Search shirts"
            />
            <button type="button" tabIndex={-1} aria-hidden="true">
              <IconSearch />
            </button>
          </label>
          {canWrite ? (
            <button type="button" className="btn" onClick={() => setAdding(true)}>
              New shirt
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <section className="shirt-metrics">
        <button
          type="button"
          className={`dash-card${tab === 'all' ? ' active-metric' : ''}`}
          onClick={() => changeTab('all')}
        >
          <p>In catalog</p>
          <strong>{counts.all}</strong>
        </button>
        <button
          type="button"
          className={`dash-card${tab === 'published' ? ' active-metric' : ''}`}
          onClick={() => changeTab('published')}
        >
          <p>On the store</p>
          <strong>{counts.published}</strong>
        </button>
        <button
          type="button"
          className={`dash-card accent${tab === 'draft' ? ' active-metric' : ''}`}
          onClick={() => changeTab('draft')}
        >
          <p>Still drafts</p>
          <strong>{counts.draft}</strong>
        </button>
      </section>

      <div className="shirts-toolbar">
        <div className="status-tabs" role="tablist" aria-label="Publish status">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={!adding && tab === item.id}
              className={!adding && tab === item.id ? 'active' : ''}
              onClick={() => {
                setAdding(false)
                changeTab(item.id)
              }}
            >
              {item.label}
              <span className="count">{counts[item.id]}</span>
            </button>
          ))}
          {canWrite ? (
            <button
              type="button"
              role="tab"
              aria-selected={adding}
              className={adding ? 'active' : ''}
              onClick={() => setAdding(true)}
            >
              New shirt
            </button>
          ) : null}
        </div>
        <div className="page-sizes" role="group" aria-label="Cards per page">
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

      {loading ? <p className="muted">Loading shirts…</p> : null}

      {!loading && visible.length === 0 ? (
        <div className="shirts-empty">
          <IconShirt />
          <h2>{products.length === 0 ? 'No shirts yet' : 'Nothing in this view'}</h2>
          <p className="muted">
            {products.length === 0
              ? canWrite
                ? 'Add a shirt to start the catalog. You can publish it after photos are ready.'
                : 'No shirts in the catalog yet.'
              : 'Try another tab or a different search.'}
          </p>
          {products.length === 0 && canWrite ? (
            <button type="button" className="btn" onClick={() => setAdding(true)}>
              New shirt
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="shirt-grid">
        {visible.map((product) => {
          const stock = unitsMeta(product.total_units || 0)
          return (
            <article key={product.id} className="shirt-card">
              <Link className="shirt-photo" to={`/staff/products/${product.id}`}>
                {product.primary_image ? (
                  <img src={product.primary_image.url} alt="" />
                ) : (
                  <span className="shirt-ph">
                    <IconShirt />
                  </span>
                )}
                <span className={`shirt-status ${product.is_published ? 'live' : 'draft'}`}>
                  {product.is_published ? 'Published' : 'Draft'}
                </span>
                {product.is_new_arrival ? <span className="shirt-status live">New</span> : null}
                <span className={`stock-label ${stock.key}`}>{stock.text}</span>
              </Link>
              <div className="shirt-body">
                <h2>
                  <Link to={`/staff/products/${product.id}`}>{product.name}</Link>
                </h2>
                <div className="swatches" aria-label="Colors">
                  {(product.colors || []).map((color) => (
                    <span key={color.id} className="swatch" style={{ background: color.hex }} title={color.name} />
                  ))}
                </div>
                <div className="shirt-sizes">
                  {(product.sizes || []).map((size) => (
                    <span key={size} className="size-chip">
                      {size}
                    </span>
                  ))}
                </div>
                <div className="shirt-meta">
                  <div>
                    <strong>{money(product.base_price, product.currency)}</strong>
                    <span className="muted">Cost {money(product.cost_price, product.currency)}</span>
                  </div>
                </div>
                <div className="shirt-actions">
                  <Link className="btn ghost" to={`/staff/products/${product.id}`}>
                    {canWrite ? 'Edit' : 'View'}
                  </Link>
                  {product.is_published ? (
                    <Link className="btn ghost" to={`/shirts/${product.slug}`} target="_blank" rel="noreferrer">
                      View store
                    </Link>
                  ) : (
                    <span className="muted">Add photos to publish</span>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {filtered.length > 0 ? (
        <div className="pager">
          <button type="button" className="btn ghost" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
            Previous
          </button>
          <span>
            Page {currentPage} of {pages}
          </span>
          <button
            type="button"
            className="btn ghost"
            disabled={currentPage >= pages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
      {adding && canWrite ? (
        <AddShirtModal
          session={session}
          mode="catalog"
          onClose={() => setAdding(false)}
          onCreated={(saved) => {
            load()
            if (saved?.id) navigate(`/staff/products/${saved.id}`)
          }}
        />
      ) : null}
    </div>
  )
}
